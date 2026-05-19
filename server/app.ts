import express from "express";
import { propertiesRouter } from "./routes/properties";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/properties", propertiesRouter);
  return app;
}
