import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveRepoRoot(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  // Production bundle lives at `dist/index.js` → project root is one level up.
  if (path.basename(dir) === "dist") {
    return path.resolve(dir, "..");
  }
  // Source: `shared/mls/db-path.ts` → project root is two levels up.
  return path.resolve(dir, "..", "..");
}

const REPO_ROOT = resolveRepoRoot();

/** Default SQLite path produced by `pnpm seed:mls`. */
export function resolveMlsDbPath(): string {
  return (
    process.env.MLS_DB_PATH ?? path.join(REPO_ROOT, "data", "mls.sqlite")
  );
}

export { REPO_ROOT };
