import { Router } from "express";
import { fetchTcadPropertyByPropId, TcadApiError } from "../../shared/tcad/client";

export const tcadRouter = Router();

function parsePropId(raw: unknown): number | null {
  if (raw === undefined || raw === "") return null;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

/**
 * GET /api/tcad/property?propId=367125
 *
 * Looks up a Travis County parcel by TCAD `PROP_ID` via the public ArcGIS layer.
 * Independent of MLS data.
 */
tcadRouter.get("/property", async (req, res) => {
  const propId = parsePropId(req.query.propId);
  if (propId === null) {
    res.status(400).json({
      error: "Missing or invalid query parameter: propId (positive integer)",
    });
    return;
  }

  try {
    const property = await fetchTcadPropertyByPropId(propId);
    if (!property) {
      res.status(404).json({
        error: "No TCAD property found for that propId",
        propId,
      });
      return;
    }

    res.json(property);
  } catch (err) {
    if (err instanceof TcadApiError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
