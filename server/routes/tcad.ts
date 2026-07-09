import { Router } from "express";
import {
  fetchTcadPropertyByAddress,
  fetchTcadPropertyByPropId,
  TcadAddressAmbiguousError,
  TcadApiError,
} from "../../shared/tcad/client";
import { parseAddress, parsePropId } from "../lib/query-params";

export const tcadRouter = Router();

/**
 * GET /api/tcad/property?propId=367125
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
    res.json({ property });
  } catch (err) {
    if (err instanceof TcadApiError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/tcad/property/by-address?address=504 Bramble Dr Austin
 */
tcadRouter.get("/property/by-address", async (req, res) => {
  const address = parseAddress(req.query.address);
  if (!address) {
    res.status(400).json({
      error: "Missing or invalid query parameter: address (min 3 characters)",
    });
    return;
  }

  try {
    const property = await fetchTcadPropertyByAddress(address);
    res.json({ property });
  } catch (err) {
    if (err instanceof TcadAddressAmbiguousError) {
      res.status(409).json({
        error: err.message,
        query: err.query,
        candidates: err.candidates,
      });
      return;
    }
    if (err instanceof TcadApiError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
