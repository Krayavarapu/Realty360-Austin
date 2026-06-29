import { Router } from "express";
import {
  fetchPropertyProfile,
  PropertyProfileMlsAmbiguousError,
  PropertyProfileNotFoundError,
} from "../../shared/property-profile/fetch-profile";
import { TcadAddressAmbiguousError, TcadApiError } from "../../shared/tcad/client";

export const propertyRouter = Router();

function parsePropId(raw: unknown): number | null {
  if (raw === undefined || raw === "") return null;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parseAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length >= 3 ? trimmed : null;
}

/**
 * GET /api/property/profile?propId=751055
 * GET /api/property/profile?address=4221 THREADGILL ST AUSTIN
 * GET /api/property/profile?propId=751055&address=4221 THREADGILL ST
 *
 * Composes a unified subject profile from TCAD (live ArcGIS) and MLS (SQLite).
 * Partial profiles are OK when only one source matches.
 */
propertyRouter.get("/profile", async (req, res) => {
  const propIdRaw = req.query.propId;
  const addressRaw = req.query.address;

  const hasPropId = propIdRaw !== undefined && propIdRaw !== "";
  const hasAddress =
    typeof addressRaw === "string" && addressRaw.trim().length >= 3;

  if (!hasPropId && !hasAddress) {
    res.status(400).json({
      error:
        "Missing query parameter: provide propId (positive integer) and/or address (min 3 characters)",
    });
    return;
  }

  const propId = hasPropId ? parsePropId(propIdRaw) : null;
  if (hasPropId && propId === null) {
    res.status(400).json({
      error: "Invalid query parameter: propId (positive integer)",
    });
    return;
  }

  const address = hasAddress ? parseAddress(addressRaw) : null;
  if (hasAddress && address === null) {
    res.status(400).json({
      error: "Invalid query parameter: address (min 3 characters)",
    });
    return;
  }

  try {
    const profile = await fetchPropertyProfile({ propId, address });
    res.json(profile);
  } catch (err) {
    if (err instanceof PropertyProfileNotFoundError) {
      res.status(404).json({
        error: err.message,
        query: err.query,
      });
      return;
    }
    if (err instanceof PropertyProfileMlsAmbiguousError) {
      res.status(409).json({
        error: err.message,
        address: err.address,
        candidates: err.candidates,
      });
      return;
    }
    if (err instanceof TcadAddressAmbiguousError) {
      res.status(409).json({
        error: err.message,
        address: address ?? undefined,
        candidates: err.candidates,
      });
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
