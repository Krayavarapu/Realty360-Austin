import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Default SQLite path produced by `pnpm seed:mls`. */
export function resolveMlsDbPath(): string {
  return (
    process.env.MLS_DB_PATH ?? path.join(REPO_ROOT, "data", "mls.sqlite")
  );
}

export { REPO_ROOT };
