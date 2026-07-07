/**
 * TCAD situs-address normalization and fuzzy matching.
 *
 * Handles collapsed/double spaces and missing spaces (e.g. "FM812" vs "F M 812")
 * by comparing compact forms after fetching ArcGIS candidates.
 */

const STREET_SUFFIXES = new Set([
  "ALY",
  "AVE",
  "BLVD",
  "CIR",
  "CT",
  "DR",
  "DWY",
  "EXPY",
  "FWY",
  "HWY",
  "LN",
  "LOOP",
  "PKWY",
  "PL",
  "RD",
  "RUN",
  "ST",
  "TER",
  "TRL",
  "WAY",
]);

/** City / state tokens to exclude from street-name ArcGIS LIKE filters and match scoring. */
const CITY_TOKENS = new Set([
  "AUSTIN",
  "TX",
  "TEXAS",
  "CEDAR",
  "PARK",
  "ROUND",
  "ROCK",
  "PFLUGERVILLE",
  "LEANDER",
  "LAKEWAY",
  "BEE",
  "CAVE",
  "MANOR",
  "DEL",
  "VALLE",
  "VALLEY",
  "WEST",
  "LAKE",
  "HILLS",
  "ROLLINGWOOD",
  "SUNSET",
]);

/** Collapse whitespace and punctuation; uppercase for token matching. */
export function normalizeTcadAddressInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove all spaces — used to match "FM812" against "F M 812". */
export function compactTcadAddress(raw: string): string {
  return normalizeTcadAddressInput(raw).replace(/\s+/g, "");
}

export interface TcadAddressTokens {
  streetNumber: string | null;
  zip: string | null;
  /** Significant tokens for ArcGIS LIKE filters (includes street number when present). */
  searchTokens: string[];
}

export function parseTcadAddressTokens(raw: string): TcadAddressTokens {
  const norm = normalizeTcadAddressInput(raw);
  if (!norm) {
    return { streetNumber: null, zip: null, searchTokens: [] };
  }

  let rest = norm;
  // Only treat zip as a trailing 5-digit token (not a leading street number).
  const trailingZip = rest.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = trailingZip?.[1] ?? null;
  if (trailingZip) {
    rest = rest.slice(0, trailingZip.index).replace(/\s+/g, " ").trim();
  }

  const parts = rest.split(/\s+/).filter(Boolean);
  let streetNumber: string | null = null;
  if (parts[0] && /^\d+[A-Z]?$/.test(parts[0])) {
    streetNumber = parts[0];
  }

  const searchTokens = parts.filter((token) => {
    if (token.length < 2 && !/^\d+$/.test(token)) return false;
    return true;
  });

  return { streetNumber, zip, searchTokens };
}

function isAdministrativeToken(token: string): boolean {
  return CITY_TOKENS.has(token.toUpperCase());
}

/** Street tokens for scoring — drops city/state so MLS-style queries match TCAD situs. */
function streetScoringTokens(queryRaw: string): string[] {
  const parsed = parseTcadAddressTokens(queryRaw);
  return parsed.searchTokens
    .filter((t) => !isAdministrativeToken(t))
    .flatMap((t) => {
      const expanded = expandLikeTokens(t);
      return expanded.length > 0 ? expanded : [compactTcadAddress(t)];
    })
    .filter(Boolean);
}

/** Compact street core without zip, city, or state (for MLS vs situs comparison). */
function compactStreetCore(raw: string): string {
  const parsed = parseTcadAddressTokens(raw);
  return parsed.searchTokens
    .filter((t) => !isAdministrativeToken(t))
    .map((t) => compactTcadAddress(t))
    .join("");
}

export function escapeArcGisLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Tokens glued without spaces (e.g. "FM812") are expanded into ArcGIS-friendly
 * LIKE fragments — chiefly numeric runs such as "812".
 */
export function expandLikeTokens(token: string): string[] {
  const upper = token.toUpperCase();
  if (STREET_SUFFIXES.has(upper)) return [upper];

  const numericRuns = upper.match(/\d{2,}/g) ?? [];
  if (numericRuns.length > 0) {
    return Array.from(new Set(numericRuns));
  }
  if (upper.length >= 3) return [upper];
  return [];
}

/**
 * Street-name token for selective `situs_address LIKE` when paired with `situs_num`.
 * Excludes suffixes, cities, and short tokens that would over-match.
 */
export function streetNameLikeToken(tokens: TcadAddressTokens): string | null {
  const candidates = tokens.searchTokens
    .filter((t) => t !== tokens.streetNumber)
    .flatMap((t) => expandLikeTokens(t))
    .filter(
      (t) =>
        t.length >= 3 &&
        !STREET_SUFFIXES.has(t) &&
        !CITY_TOKENS.has(t) &&
        !/^\d+$/.test(t),
    );

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Pick the single most selective non-suffix token for address-only lookups.
 * Avoids stacking multiple leading-wildcard LIKE filters on the full parcel layer.
 */
function mostSelectiveLikeToken(tokens: TcadAddressTokens): string | null {
  return streetNameLikeToken(tokens);
}

/**
 * Build a fast ArcGIS `where` clause from parsed tokens.
 *
 * With a street number, uses indexed `situs_num` plus an optional selective street-name
 * `LIKE` (e.g. `507` + `%HAMMACK%`). Zip narrows further when present.
 */
export function buildTcadAddressWhereClause(tokens: TcadAddressTokens): string | null {
  const { streetNumber, zip, searchTokens } = tokens;
  if (searchTokens.length === 0) return null;

  if (streetNumber) {
    const clauses = [`situs_num = '${escapeArcGisLiteral(streetNumber)}'`];
    const streetLike = streetNameLikeToken(tokens);
    if (streetLike) {
      clauses.push(
        `UPPER(situs_address) LIKE '%${escapeArcGisLiteral(streetLike)}%'`,
      );
    }
    if (zip) {
      clauses.push(`situs_zip = '${escapeArcGisLiteral(zip)}'`);
    }
    return clauses.join(" AND ");
  }

  const clauses: string[] = [];
  if (zip) {
    clauses.push(`situs_zip = '${escapeArcGisLiteral(zip)}'`);
  }

  const likeToken = mostSelectiveLikeToken(tokens);
  if (likeToken) {
    clauses.push(
      `UPPER(situs_address) LIKE '%${escapeArcGisLiteral(likeToken)}%'`,
    );
  }

  return clauses.length > 0 ? clauses.join(" AND ") : null;
}

/** Broader fallback when the indexed clause returns no scored matches. */
export function buildTcadAddressWhereClauseFallback(
  tokens: TcadAddressTokens,
): string | null {
  const { streetNumber, zip } = tokens;

  // Drop zip or street-name LIKE if they over-filtered.
  if (streetNumber) {
    const streetLike = streetNameLikeToken(tokens);
    if (zip && streetLike) {
      return `situs_num = '${escapeArcGisLiteral(streetNumber)}' AND UPPER(situs_address) LIKE '%${escapeArcGisLiteral(streetLike)}%'`;
    }
    if (zip) {
      return `situs_num = '${escapeArcGisLiteral(streetNumber)}'`;
    }
    return null;
  }

  const likeToken = mostSelectiveLikeToken(tokens);
  if (!likeToken) return null;

  if (zip) {
    return `UPPER(situs_address) LIKE '%${escapeArcGisLiteral(likeToken)}%'`;
  }

  return null;
}

export interface TcadAddressMatchScore {
  score: number;
  situsAddress: string;
}

const MIN_ACCEPT_SCORE = 65;

function situsContainsSpacedToken(
  situsAddress: string,
  token: string,
): boolean {
  const padded = ` ${normalizeTcadAddressInput(situsAddress)} `;
  return padded.includes(` ${token} `);
}

/**
 * Score how well a TCAD `situs_address` matches the user query (0–100).
 * Compact comparison tolerates missing/extra spaces.
 */
export function scoreTcadAddressMatch(
  queryRaw: string,
  situsAddress: string | null | undefined,
  zip: string | null = null,
): number {
  if (!situsAddress) return 0;

  const queryStreet = compactStreetCore(queryRaw);
  const situsStreet = compactStreetCore(situsAddress);
  if (!queryStreet || !situsStreet) return 0;

  if (
    situsStreet.includes(queryStreet) ||
    queryStreet.includes(situsStreet)
  ) {
    return 100;
  }

  const tokens = streetScoringTokens(queryRaw);
  if (tokens.length === 0) return 0;

  let matched = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (/^\d+$/.test(token)) {
      if (situsContainsSpacedToken(situsAddress, token)) matched++;
    } else if (compactTcadAddress(situsAddress).includes(compactTcadAddress(token))) {
      matched++;
    }
  }

  const suffixOnly = tokens.every((t) => STREET_SUFFIXES.has(t));
  if (suffixOnly) return 0;

  return Math.round((matched / tokens.length) * 95);
}

export function isAcceptableTcadAddressScore(score: number): boolean {
  return score >= MIN_ACCEPT_SCORE;
}

export { MIN_ACCEPT_SCORE };
