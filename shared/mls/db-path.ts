import path from "node:path";
import { resolveRepoRoot } from "../env/repo-root";

const REPO_ROOT = resolveRepoRoot();

/** Default SQLite path produced by `pnpm seed:mls`. */
export function resolveMlsDbPath(): string {
  return (
    process.env.MLS_DB_PATH ?? path.join(REPO_ROOT, "data", "mls.sqlite")
  );
}

export { REPO_ROOT };
