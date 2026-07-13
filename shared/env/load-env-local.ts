import fs from "node:fs";
import path from "node:path";
import { resolveRepoRoot } from "./repo-root";

const REPO_ROOT = resolveRepoRoot();

/**
 * Loads `.env.local` from the repo root into `process.env` (does not override
 * variables already set in the environment).
 */
export function loadEnvLocal(): void {
  const envPath = path.join(REPO_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export { REPO_ROOT };
