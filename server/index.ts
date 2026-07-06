import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { loadEnvLocal } from "../scripts/load-env-local";
import { createApp } from "./app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  loadEnvLocal();
  const app = createApp();
  const server = createServer(app);

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const apiOnly =
    process.env.API_ONLY === "1" ||
    process.env.NODE_ENV !== "production" ||
    !fs.existsSync(path.join(staticPath, "index.html"));

  if (!apiOnly) {
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT ?? 3000);

  server.listen(port, () => {
    if (apiOnly) {
      console.log(
        `[server] API listening on http://localhost:${port}/ (API-only; static UI not served)`,
      );
      console.log(
        `[server] Example: http://localhost:${port}/api/properties/by-address?address=507%20Hammack%20Dr%20Austin`,
      );
      console.log(
        `[server] Example: http://localhost:${port}/api/properties/suggest?q=507`,
      );
    } else {
      console.log(`[server] Running on http://localhost:${port}/`);
    }
  });
}

startServer().catch(console.error);
