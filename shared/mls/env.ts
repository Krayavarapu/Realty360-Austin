const DEFAULT_BASE_URL = "https://api-demo.mlsgrid.com/v2";

type ViteEnv = { env?: Record<string, string | undefined> };

function viteEnv(key: string): string | undefined {
  const env = (import.meta as ImportMeta & ViteEnv).env;
  return env?.[key];
}

/** Bearer token — prefers `MLS_GRID_TOKEN`, then `VITE_MLS_GRID_TOKEN`. */
export function resolveMlsToken(): string {
  const tok =
    process.env.MLS_GRID_TOKEN ??
    process.env.VITE_MLS_GRID_TOKEN ??
    viteEnv("VITE_MLS_GRID_TOKEN");
  if (!tok) {
    throw new Error(
      "[mls] MLS_GRID_TOKEN is not set. Add it to .env.local at the repo root (or VITE_MLS_GRID_TOKEN for the browser).",
    );
  }
  return tok;
}

export function resolveMlsBaseUrl(): string {
  return (
    process.env.MLS_GRID_BASE_URL ??
    process.env.VITE_MLS_GRID_BASE_URL ??
    viteEnv("VITE_MLS_GRID_BASE_URL") ??
    DEFAULT_BASE_URL
  );
}

export const MLS_DEFAULT_BASE_URL = DEFAULT_BASE_URL;
