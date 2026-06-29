import { Router } from "express";
import {
  fetchUnifiedComparables,
  UnifiedComparablesError,
} from "../../shared/comparables/unified-search";
import { TcadApiError } from "../../shared/tcad/client";

export const comparablesRouter = Router();

function parseRadiusMiles(raw: unknown): number | null {
  if (raw === undefined || raw === "") return null;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseLimit(raw: unknown, fallback = 50): number | null {
  if (raw === undefined || raw === "") return fallback;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parseMaxAgeMonths(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120) return null;
  return value;
}

function parsePropId(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parseIncludeTcad(raw: unknown): boolean {
  if (raw === undefined || raw === "") return false;
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : raw;
  return value === "true" || value === "1" || value === true;
}

/**
 * GET /api/comparables/unified?address=507 Hammack Dr Austin&radiusMiles=2
 *
 * Returns MLS closed sales, MLS active/pending listings, and optionally TCAD
 * tax-reference parcels within `radiusMiles` of the subject.
 *
 * Query params:
 * - address and/or propId (at least one required)
 * - radiusMiles (required)
 * - maxAgeMonths (optional, closed sales only)
 * - limit (optional, default 50 per section)
 * - includeTcad=true (optional, fetches nearby TCAD parcels)
 */
comparablesRouter.get("/unified", async (req, res) => {
  const address =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  const propId = parsePropId(req.query.propId);

  if (!address && propId === undefined) {
    res.status(400).json({
      error: "Missing required query parameter: address and/or propId",
    });
    return;
  }

  if (propId === null) {
    res.status(400).json({
      error: "Invalid query parameter: propId (positive integer)",
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

  try {
    const result = await fetchUnifiedComparables({
      address: address || null,
      propId,
      radiusMiles,
      limit,
      maxAgeMonths,
      includeTcad: parseIncludeTcad(req.query.includeTcad),
    });
    res.json(result);
  } catch (err) {
    if (err instanceof UnifiedComparablesError) {
      res.status(err.statusCode).json({ error: err.message, ...err.body });
      return;
    }
    if (err instanceof TcadApiError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Database not found") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});
