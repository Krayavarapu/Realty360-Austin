import express from "express";
import { propertiesRouter } from "./routes/properties";
import { tcadRouter } from "./routes/tcad";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/properties", propertiesRouter);
  app.use("/api/tcad", tcadRouter);
  return app;
}
