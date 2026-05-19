import { Router } from "express";
import { normalizeAddress } from "../../shared/mls/transform";
import {
  findPropertyByAddressNorm,
  findPropertyByAddressPrefix,
  openDefaultMlsDb,
  searchPropertiesByAddress,
  type PropertyRow,
} from "../../scripts/mls-db";

export const propertiesRouter = Router();

function toDto(row: PropertyRow) {
  return {
    listingKey: row.listing_key,
    listingId: row.listing_id,
    addressLine: row.address_line,
    addressNorm: row.address_norm,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    livingAreaSqft: row.living_area_sqft,
    closePrice: row.close_price,
    closeDate: row.close_date,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/**
 * GET /api/properties/by-address?address=507 Hammack Dr, Austin
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
      const exact = findPropertyByAddressNorm(db, addressNorm);
      if (exact) {
        res.json({ match: "exact", property: toDto(exact) });
        return;
      }

      const prefix = findPropertyByAddressPrefix(db, addressNorm);
      if (prefix) {
        res.json({ match: "prefix", property: toDto(prefix) });
        return;
      }

      const partial = searchPropertiesByAddress(db, addressNorm, 10);
      if (partial.length === 0) {
        res.status(404).json({
          error: "No property found for that address",
          addressNorm,
        });
        return;
      }

      if (partial.length === 1) {
        res.json({ match: "partial", property: toDto(partial[0]!) });
        return;
      }

      res.json({
        match: "multiple",
        addressNorm,
        properties: partial.map(toDto),
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
