/** Shared Express query parameter parsers. */

export function parsePropId(raw: unknown): number | null {
  if (raw === undefined || raw === "") return null;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

/** Returns undefined when omitted, null when invalid. */
export function parsePropIdOptional(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  return parsePropId(raw);
}

export function parseAddress(raw: unknown, minLength = 3): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length >= minLength ? trimmed : null;
}

export function parseRadiusMiles(raw: unknown): number | null {
  if (raw === undefined || raw === "") return null;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function parseLimit(raw: unknown, fallback = 50): number | null {
  if (raw === undefined || raw === "") return fallback;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export function parseSuggestLimit(raw: unknown, fallback = 8): number | null {
  if (raw === undefined || raw === "") return fallback;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 25) return null;
  return value;
}

/** Optional recency window in whole months (1–120). Omitted = no filter. */
export function parseMaxAgeMonths(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120) return null;
  return value;
}

export function parseIncludeTcad(raw: unknown): boolean {
  if (raw === undefined || raw === "") return false;
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : raw;
  return value === "true" || value === "1" || value === true;
}
