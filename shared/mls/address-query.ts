import { normalizeAddress } from "./transform";

export interface ParsedAddressQuery {
  /** Full normalized input string. */
  rawNorm: string;
  /** Street line (number + name + suffix). */
  streetPart: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

function extractZip(s: string): { zip: string | null; rest: string } {
  const match = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!match) return { zip: null, rest: s };
  return {
    zip: match[1]!,
    rest: s.replace(match[0], "").replace(/\s+/g, " ").trim(),
  };
}

function extractTrailingState(s: string): { state: string | null; rest: string } {
  const match = s.match(/\b([a-z]{2})$/);
  if (!match) return { state: null, rest: s };
  return {
    state: match[1]!,
    rest: s.slice(0, -match[1]!.length).trim(),
  };
}

function splitStreetAndCity(rest: string): { streetPart: string; city: string | null } {
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return { streetPart: rest, city: null };
  }
  return {
    streetPart: tokens.slice(0, -1).join(" "),
    city: tokens[tokens.length - 1]!,
  };
}

function parseCommaSeparated(raw: string, norm: string): ParsedAddressQuery {
  const parts = raw.split(",").map((p) => normalizeAddress(p)).filter(Boolean);
  const streetPart = parts[0] ?? norm;
  let city: string | null = parts[1] ?? null;
  let state: string | null = null;
  let postalCode: string | null = null;

  if (parts.length >= 3) {
    const tail = parts.slice(2).join(" ");
    const zipPart = extractZip(tail);
    postalCode = zipPart.zip;
    const statePart = extractTrailingState(zipPart.rest);
    state = statePart.state;
  }

  if (city) {
    const zipInCity = extractZip(city);
    if (zipInCity.zip) {
      postalCode = postalCode ?? zipInCity.zip;
      const stateInCity = extractTrailingState(zipInCity.rest);
      state = state ?? stateInCity.state;
      city = stateInCity.rest || null;
    } else {
      const stateInCity = extractTrailingState(city);
      if (stateInCity.state && stateInCity.rest) {
        state = state ?? stateInCity.state;
        city = stateInCity.rest;
      }
    }
  }

  return { rawNorm: norm, streetPart, city, state, postalCode };
}

function parseSpaceSeparated(norm: string): ParsedAddressQuery {
  let rest = norm;
  const zipPart = extractZip(rest);
  let postalCode = zipPart.zip;
  rest = zipPart.rest;

  const statePart = extractTrailingState(rest);
  let state = statePart.state;
  rest = statePart.rest;

  const { streetPart, city } = splitStreetAndCity(rest);
  return { rawNorm: norm, streetPart, city, state, postalCode };
}

/**
 * Best-effort parse of free-form US address input.
 * Stored MLS norms use: `{street} {city} {zip} {state}`.
 */
export function parseAddressQuery(raw: string): ParsedAddressQuery {
  const norm = normalizeAddress(raw);
  if (!norm) {
    return {
      rawNorm: "",
      streetPart: "",
      city: null,
      state: null,
      postalCode: null,
    };
  }

  if (raw.includes(",")) {
    return parseCommaSeparated(raw, norm);
  }

  return parseSpaceSeparated(norm);
}

/** Canonical stored shape: street, city, zip, state. */
export function buildCanonicalAddressNorm(
  parsed: ParsedAddressQuery,
): string | null {
  if (!parsed.city) return null;
  return normalizeAddress(
    [parsed.streetPart, parsed.city, parsed.postalCode, parsed.state]
      .filter(Boolean)
      .join(" "),
  );
}

/** Prefix strings to try when exact match fails (most specific first). */
export function buildAddressLookupPrefixes(parsed: ParsedAddressQuery): string[] {
  const prefixes = new Set<string>();
  const add = (s: string | null | undefined) => {
    const v = s?.trim();
    if (v) prefixes.add(v);
  };

  add(parsed.rawNorm);
  add(buildCanonicalAddressNorm(parsed));

  if (parsed.city) {
    add(`${parsed.streetPart} ${parsed.city}`);
  }

  // Avoid prefixing on a bare street number (e.g. "300" → wrong first match).
  if (!/^\d+$/.test(parsed.streetPart)) {
    add(parsed.streetPart);
  }

  return Array.from(prefixes);
}

/** Significant tokens from the user query that must appear in a stored `address_norm`. */
export function significantAddressTokens(rawNorm: string): string[] {
  return rawNorm
    .split(/\s+/)
    .filter((t) => t.length > 1 || /^\d+$/.test(t));
}

/** Reject loose matches when the user typed extra tokens that are not in the DB row. */
export function addressQueryMatchesProperty(
  rawNorm: string,
  propertyAddressNorm: string,
): boolean {
  const tokens = significantAddressTokens(rawNorm);
  if (tokens.length === 0) return false;
  return tokens.every((token) => propertyAddressNorm.includes(token));
}
