import { Router } from "express";
import {
  bucketByMileRing,
  computeMatchPercent,
} from "../../shared/comparables/match-score";
import { minCloseDateForMaxAgeMonths } from "../../shared/comparables/recency";
import {
  toPropertyDetailDto,
  toRadiusComparableDto,
} from "../../shared/comparables/property-dto";
import type { RadiusComparableDto } from "../../shared/comparables/types";
import { normalizeAddress } from "../../shared/mls/transform";
import {
  findPropertiesWithinRadius,
  openDefaultMlsDb,
  resolvePropertyByAddress,
  suggestPropertiesByAddress,
  type PropertyRow,
} from "../../shared/mls/sqlite";
import {
  parseLimit,
  parseMaxAgeMonths,
  parseRadiusMiles,
  parseSuggestLimit,
} from "../lib/query-params";
import {
  applyDeprecationHeaders,
  deprecationPayload,
  type DeprecationNotice,
} from "../lib/deprecation";

export const propertiesRouter = Router();

const BY_RADIUS_DEPRECATION: DeprecationNotice = {
  endpoint: "GET /api/properties/by-radius",
  message:
    "Closed-only radius comps are superseded by the unified comparables API (closed + active + optional TCAD, subject profile).",
  successor: "/api/comparables/unified",
  sunset: "2026-12-31",
};

function sortComparables(a: RadiusComparableDto, b: RadiusComparableDto): number {
  if (b.matchPercent !== a.matchPercent) {
    return b.matchPercent - a.matchPercent;
  }
  return a.distanceMiles - b.distanceMiles;
}

/**
 * GET /api/properties/suggest?q=507&limit=8
 *
 * Typeahead address suggestions from the MLS SQLite database.
 */
propertiesRouter.get("/suggest", (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!raw) {
    res.status(400).json({ error: "Missing required query parameter: q" });
    return;
  }

  const limit = parseSuggestLimit(req.query.limit);
  if (limit === null) {
    res.status(400).json({
      error: "Invalid query parameter: limit (integer 1–25)",
    });
    return;
  }

  try {
    const db = openDefaultMlsDb();
    try {
      const rows = suggestPropertiesByAddress(db, raw, limit);
      res.json({
        query: raw,
        suggestions: rows.map(toPropertyDetailDto),
      });
    } finally {
      db.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Database not found") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 *
 * Returns MLS listing identifiers for a normalized address lookup against
 * `data/mls.sqlite`. Exact match first; falls back to partial match list.
 */
propertiesRouter.get("/by-address", (req, res) => {
  const raw =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!raw) {
    res.status(400).json({
      error: "Missing required query parameter: address",
    });
    return;
  }

  const addressNorm = normalizeAddress(raw);
  if (!addressNorm) {
    res.status(400).json({ error: "Address query is empty after normalization" });
    return;
  }

  try {
    const db = openDefaultMlsDb();
    try {
      const resolved = resolvePropertyByAddress(db, raw);
      if (resolved.status === "found") {
        res.json({
          match: resolved.match,
          property: toPropertyDetailDto(resolved.property),
        });
        return;
      }
      if (resolved.status === "not_found") {
        res.status(404).json({
          error: "No property found for that address",
          addressNorm: resolved.addressNorm,
        });
        return;
      }
      res.json({
        match: "multiple",
        addressNorm: resolved.addressNorm,
        properties: resolved.properties.map(toPropertyDetailDto),
      });
    } finally {
      db.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Database not found") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * GET /api/properties/by-radius?address=...&radiusMiles=2&maxAgeMonths=12
 *
 * @deprecated Use `GET /api/comparables/unified` instead. This route remains
 * for backward compatibility and returns `Deprecation` / `Warning` headers plus
 * a `deprecation` object in the JSON body.
 */
propertiesRouter.get("/by-radius", (req, res) => {
  applyDeprecationHeaders(res, BY_RADIUS_DEPRECATION);

  const raw =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!raw) {
    res.status(400).json({
      error: "Missing required query parameter: address",
    });
    return;
  }

  const radiusMiles = parseRadiusMiles(req.query.radiusMiles);
  if (radiusMiles === null) {
    res.status(400).json({
      error: "Missing or invalid query parameter: radiusMiles (positive number)",
    });
    return;
  }

  const limit = parseLimit(req.query.limit);
  if (limit === null) {
    res.status(400).json({
      error: "Invalid query parameter: limit (positive integer)",
    });
    return;
  }

  const maxAgeMonths = parseMaxAgeMonths(req.query.maxAgeMonths);
  if (maxAgeMonths === null) {
    res.status(400).json({
      error: "Invalid query parameter: maxAgeMonths (integer 1–120)",
    });
    return;
  }

  const minCloseDate =
    maxAgeMonths !== undefined
      ? minCloseDateForMaxAgeMonths(maxAgeMonths)
      : undefined;

  const addressNorm = normalizeAddress(raw);
  if (!addressNorm) {
    res.status(400).json({ error: "Address query is empty after normalization" });
    return;
  }

  try {
    const db = openDefaultMlsDb();
    try {
      const resolved = resolvePropertyByAddress(db, raw);
      if (resolved.status === "not_found") {
        res.status(404).json({
          error: "No property found for that address",
          addressNorm: resolved.addressNorm,
        });
        return;
      }
      if (resolved.status === "multiple") {
        res.status(409).json({
          error: "Multiple properties match that address; refine the query",
          addressNorm: resolved.addressNorm,
          properties: resolved.properties.map(toPropertyDetailDto),
        });
        return;
      }

      const subject = resolved.property;
      if (subject.latitude == null || subject.longitude == null) {
        res.status(422).json({
          error: "Subject property has no coordinates for radius search",
          property: toPropertyDetailDto(subject),
        });
        return;
      }
      if (subject.bedrooms == null || subject.bathrooms == null) {
        res.status(422).json({
          error: "Subject property is missing bedroom or bathroom count",
          property: toPropertyDetailDto(subject),
        });
        return;
      }

      const rows = findPropertiesWithinRadius(db, {
        latitude: subject.latitude,
        longitude: subject.longitude,
        radiusMiles,
        minBedrooms: subject.bedrooms,
        minBathrooms: subject.bathrooms,
        excludeListingKey: subject.listing_key,
        minCloseDate,
        limit,
      });

      const matchSubject = {
        bedrooms: subject.bedrooms,
        bathrooms: subject.bathrooms,
      };

      const properties: RadiusComparableDto[] = rows.map((row) =>
        toRadiusComparableDto(row, {
          distanceMiles: row.distance_miles,
          matchPercent: computeMatchPercent(matchSubject, {
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            distanceMiles: row.distance_miles,
          }, radiusMiles),
        }),
      );

      properties.sort(sortComparables);

      const buckets = bucketByMileRing(properties, radiusMiles, sortComparables);

      res.json({
        ...deprecationPayload(BY_RADIUS_DEPRECATION),
        match: resolved.match,
        radiusMiles,
        filters: {
          minBedrooms: subject.bedrooms,
          minBathrooms: subject.bathrooms,
          ...(maxAgeMonths !== undefined
            ? { maxAgeMonths, minCloseDate }
            : {}),
        },
        subject: toPropertyDetailDto(subject),
        count: properties.length,
        buckets,
        properties,
      });
    } finally {
      db.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Database not found") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});
