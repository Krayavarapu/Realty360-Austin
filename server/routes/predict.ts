import { Router } from "express";
import {
  FlipPredictionError,
  predictFlip,
} from "../../shared/flip/predict-flip";
import {
  FlipPredictionValidationError,
  parseFlipPredictionRequest,
} from "../../shared/flip/prediction-schema";
import { TcadApiError } from "../../shared/tcad/client";

export const predictRouter = Router();

/**
 * POST /api/predict/flip
 *
 * Rules-engine flip prediction: ARV from closed-comp median (or `arv` override),
 * rehab from scope tier × sqft, margins from Travis County deal defaults.
 */
predictRouter.post("/flip", async (req, res) => {
  try {
    const request = parseFlipPredictionRequest(req.body);
    const result = await predictFlip(request);
    res.json(result);
  } catch (err) {
    if (err instanceof FlipPredictionValidationError) {
      res.status(400).json({
        error: err.message,
        issues: err.issues,
      });
      return;
    }
    if (err instanceof FlipPredictionError) {
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
