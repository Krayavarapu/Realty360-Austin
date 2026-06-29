import express from "express";
import { comparablesRouter } from "./routes/comparables";
import { propertiesRouter } from "./routes/properties";
import { propertyRouter } from "./routes/property-profile";
import { tcadRouter } from "./routes/tcad";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/comparables", comparablesRouter);
  app.use("/api/properties", propertiesRouter);
  app.use("/api/property", propertyRouter);
  app.use("/api/tcad", tcadRouter);
  return app;
}
