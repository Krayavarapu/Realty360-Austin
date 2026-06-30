import {
  buildTcadAddressWhereClause,
  buildTcadAddressWhereClauseFallback,
  isAcceptableTcadAddressScore,
  normalizeTcadAddressInput,
  parseTcadAddressTokens,
  scoreTcadAddressMatch,
} from "./address-query";
import { TCAD_ARCGIS_QUERY_URL, TCAD_ARCGIS_WGS84_SR, TCAD_PROPERTY_OUT_FIELDS } from "./constants";
import { centroidFromEsriPolygon, type TcadParcelCentroid } from "./geometry";
import { haversineMiles } from "../comparables/geo";
import { toTcadPropertyDto } from "./transform";
import type {
  TcadArcGisAttributes,
  TcadArcGisFeature,
  TcadArcGisQueryResponse,
  TcadPropertyDto,
} from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
/** Retries after the first attempt (2 retries = 3 total tries). */
const TCAD_MAX_RETRIES = 2;
const TCAD_RETRY_BACKOFF_MS = [750, 2000] as const;
/** Max rows when filtering by situs_num (multi-unit buildings can share a number). */
const ADDRESS_CANDIDATE_LIMIT = 50;

export class TcadApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TcadApiError";
  }
}

export class TcadAddressAmbiguousError extends Error {
  constructor(
    message: string,
    public readonly candidates: TcadPropertyDto[],
  ) {
    super(message);
    this.name = "TcadAddressAmbiguousError";
  }
}

function rankTcadAddressCandidates(
  candidates: TcadArcGisAttributes[],
  rawAddress: string,
  zip: string | null,
) {
  const seenPropIds = new Set<number>();
  return candidates
    .filter((attrs) => {
      if (seenPropIds.has(attrs.PROP_ID)) return false;
      seenPropIds.add(attrs.PROP_ID);
      return true;
    })
    .map((attrs) => ({
      attrs,
      score: scoreTcadAddressMatch(rawAddress, attrs.situs_address, zip),
    }))
    .filter((row) => isAcceptableTcadAddressScore(row.score))
    .sort((a, b) => b.score - a.score);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTcadError(err: unknown): boolean {
  if (err instanceof TcadApiError) {
    return err.statusCode === 504;
  }
  return err instanceof Error && err.name === "AbortError";
}

async function withTcadRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  const maxAttempts = 1 + TCAD_MAX_RETRIES;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry =
        attempt < maxAttempts - 1 && isRetryableTcadError(err);
      if (!canRetry) throw err;
      await sleep(TCAD_RETRY_BACKOFF_MS[attempt] ?? 2000);
    }
  }

  throw lastErr;
}

async function fetchTcadArcGisUrl(
  url: URL,
  timeoutMessage: string,
): Promise<TcadArcGisQueryResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new TcadApiError(
        `TCAD ArcGIS request failed (${res.status})`,
        502,
      );
    }

    const body = (await res.json()) as TcadArcGisQueryResponse;

    if (body.error?.message) {
      throw new TcadApiError(
        `TCAD ArcGIS error: ${body.error.message}`,
        502,
      );
    }

    return body;
  } catch (err) {
    if (err instanceof TcadApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TcadApiError(timeoutMessage, 504);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new TcadApiError(`TCAD ArcGIS request failed: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function queryTcadArcGisFeatures(
  where: string,
  recordCount = 1,
  opts: { includeGeometry?: boolean } = {},
): Promise<TcadArcGisFeature[]> {
  const url = new URL(TCAD_ARCGIS_QUERY_URL);
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", TCAD_PROPERTY_OUT_FIELDS);
  const includeGeometry = opts.includeGeometry === true;
  url.searchParams.set("returnGeometry", String(includeGeometry));
  if (includeGeometry) {
    url.searchParams.set("outSR", String(TCAD_ARCGIS_WGS84_SR));
  }
  url.searchParams.set("f", "json");
  url.searchParams.set("resultRecordCount", String(recordCount));

  const body = await withTcadRetry(() =>
    fetchTcadArcGisUrl(url, "TCAD ArcGIS request timed out"),
  );
  return body.features ?? [];
}

async function queryTcadArcGis(
  where: string,
  recordCount = 1,
): Promise<TcadArcGisAttributes[]> {
  const features = await queryTcadArcGisFeatures(where, recordCount);
  return features
    .map((f) => f.attributes)
    .filter((attrs): attrs is TcadArcGisAttributes => attrs != null);
}

async function fetchTcadParcelCentroid(
  propId: number,
): Promise<TcadParcelCentroid | null> {
  const features = await queryTcadArcGisFeatures(`PROP_ID=${propId}`, 1, {
    includeGeometry: true,
  });
  return centroidFromEsriPolygon(features[0]?.geometry?.rings);
}

async function toTcadPropertyDtoWithCentroid(
  attrs: TcadArcGisAttributes,
  fetchedAt: string,
): Promise<TcadPropertyDto> {
  const centroid = await fetchTcadParcelCentroid(attrs.PROP_ID);
  return toTcadPropertyDto(attrs, fetchedAt, centroid);
}

/**
 * Query the Travis County TCAD ArcGIS layer for a single parcel by `PROP_ID`.
 *
 * Upstream endpoint:
 * {@link TCAD_ARCGIS_QUERY_URL}
 */
export async function fetchTcadPropertyByPropId(
  propId: number,
): Promise<TcadPropertyDto | null> {
  const features = await queryTcadArcGisFeatures(`PROP_ID=${propId}`, 1, {
    includeGeometry: true,
  });
  const feature = features[0];
  const attrs = feature?.attributes;
  if (!attrs) return null;
  const centroid = centroidFromEsriPolygon(feature.geometry?.rings);
  return toTcadPropertyDto(attrs, new Date().toISOString(), centroid);
}

export interface TcadAddressLookupResult {
  property: TcadPropertyDto;
  matchScore: number;
  query: string;
  matchedSitusAddress: string;
}

export type TcadAddressLookupStatus = "none" | "single" | "ambiguous";

export interface TcadAddressLookupOutcome {
  status: TcadAddressLookupStatus;
  query: string;
  property: TcadPropertyDto | null;
  matchScore: number | null;
  matchedSitusAddress: string | null;
  candidates: TcadPropertyDto[];
}

function isAmbiguousTcadRank(
  ranked: Array<{ attrs: TcadArcGisAttributes; score: number }>,
): boolean {
  if (ranked.length <= 1) return false;
  const best = ranked[0]!.score;
  const topTier = ranked.filter((row) => row.score >= best - 3);
  return topTier.length > 1;
}

async function resolveTcadAddressLookup(
  rawAddress: string,
): Promise<TcadAddressLookupOutcome> {
  const query = normalizeTcadAddressInput(rawAddress);
  if (query.length < 3) {
    return {
      status: "none",
      query,
      property: null,
      matchScore: null,
      matchedSitusAddress: null,
      candidates: [],
    };
  }

  const tokens = parseTcadAddressTokens(rawAddress);
  let where = buildTcadAddressWhereClause(tokens);
  if (!where) {
    return {
      status: "none",
      query,
      property: null,
      matchScore: null,
      matchedSitusAddress: null,
      candidates: [],
    };
  }

  let candidates = await queryTcadArcGis(where, ADDRESS_CANDIDATE_LIMIT);
  const fetchedAt = new Date().toISOString();
  let ranked = rankTcadAddressCandidates(candidates, rawAddress, tokens.zip);

  if (ranked.length === 0) {
    const fallbackWhere = buildTcadAddressWhereClauseFallback(tokens);
    if (fallbackWhere && fallbackWhere !== where) {
      candidates = await queryTcadArcGis(fallbackWhere, ADDRESS_CANDIDATE_LIMIT);
      ranked = rankTcadAddressCandidates(candidates, rawAddress, tokens.zip);
    }
  }

  if (ranked.length === 0) {
    return {
      status: "none",
      query,
      property: null,
      matchScore: null,
      matchedSitusAddress: null,
      candidates: [],
    };
  }

  if (isAmbiguousTcadRank(ranked)) {
    const topTier = ranked.filter((row) => row.score >= ranked[0]!.score - 3);
    const dtos = await Promise.all(
      topTier
        .slice(0, 10)
        .map((row) => toTcadPropertyDtoWithCentroid(row.attrs, fetchedAt)),
    );
    return {
      status: "ambiguous",
      query,
      property: null,
      matchScore: null,
      matchedSitusAddress: null,
      candidates: dtos,
    };
  }

  const best = ranked[0]!;
  const property = await toTcadPropertyDtoWithCentroid(best.attrs, fetchedAt);
  return {
    status: "single",
    query,
    property,
    matchScore: best.score,
    matchedSitusAddress:
      best.attrs.situs_address ?? property.situsAddress ?? "",
    candidates: [],
  };
}

/**
 * Address lookup without throwing on ambiguity — for profile enrichment.
 */
export async function fetchTcadAddressLookupOutcome(
  rawAddress: string,
): Promise<TcadAddressLookupOutcome> {
  return resolveTcadAddressLookup(rawAddress);
}

/**
 * Fuzzy situs-address lookup. Tolerates double spaces and missing spaces
 * (e.g. "13903 FM812 RD" matches "13903 F M 812 RD 78617").
 */
export async function fetchTcadPropertyByAddress(
  rawAddress: string,
): Promise<TcadAddressLookupResult | null> {
  const outcome = await resolveTcadAddressLookup(rawAddress);
  if (outcome.status === "none") return null;
  if (outcome.status === "ambiguous") {
    throw new TcadAddressAmbiguousError(
      "Multiple TCAD properties match that address; refine the query",
      outcome.candidates,
    );
  }
  return {
    property: outcome.property!,
    matchScore: outcome.matchScore!,
    query: outcome.query,
    matchedSitusAddress: outcome.matchedSitusAddress!,
  };
}

export type TcadParcelWithDistance = TcadPropertyDto & { distanceMiles: number };

/**
 * Parcels whose geometry intersects a buffer around a WGS-84 point.
 * Tax values are reference only — not sale comps.
 */
export async function fetchTcadParcelsWithinRadius(opts: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  excludePropId?: number;
  limit?: number;
}): Promise<TcadParcelWithDistance[]> {
  const {
    latitude,
    longitude,
    radiusMiles,
    excludePropId,
    limit = 50,
  } = opts;

  const url = new URL(TCAD_ARCGIS_QUERY_URL);
  url.searchParams.set(
    "geometry",
    JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: TCAD_ARCGIS_WGS84_SR },
    }),
  );
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", String(TCAD_ARCGIS_WGS84_SR));
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("distance", String(radiusMiles));
  url.searchParams.set("units", "esriSRUnit_StatuteMile");
  url.searchParams.set("outFields", TCAD_PROPERTY_OUT_FIELDS);
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", String(TCAD_ARCGIS_WGS84_SR));
  url.searchParams.set("f", "json");
  url.searchParams.set("resultRecordCount", String(Math.min(limit * 3, 200)));

  const body = await withTcadRetry(() =>
    fetchTcadArcGisUrl(url, "TCAD ArcGIS radius request timed out"),
  );

  const fetchedAt = new Date().toISOString();
  const features = body.features ?? [];

  return features
      .map((feature) => {
        const attrs = feature.attributes;
        if (!attrs) return null;
        const centroid = centroidFromEsriPolygon(feature.geometry?.rings);
        if (!centroid) return null;
        const distanceMiles = haversineMiles(
          latitude,
          longitude,
          centroid.latitude,
          centroid.longitude,
        );
        if (distanceMiles > radiusMiles) return null;
        if (excludePropId != null && attrs.PROP_ID === excludePropId) {
          return null;
        }
        return {
          ...toTcadPropertyDto(attrs, fetchedAt, centroid),
          distanceMiles,
        };
      })
      .filter((row): row is TcadParcelWithDistance => row != null)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, limit);
}
