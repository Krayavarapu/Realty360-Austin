import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Project root (`Realty360-Austin/`), whether running from source (tsx) or
 * the production bundle (`dist/index.js`).
 */
export function resolveRepoRoot(fromUrl: string = import.meta.url): string {
  const dir = path.dirname(fileURLToPath(fromUrl));
  // Production bundle: `Realty360-Austin/dist/index.js` → root is one level up.
  if (path.basename(dir) === "dist") {
    return path.resolve(dir, "..");
  }
  // Source: `shared/<module>/file.ts` → root is two levels up.
  return path.resolve(dir, "..", "..");
}
