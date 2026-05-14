/**
 * Thin MLS data layer.
 *
 * Replaces the hardcoded `NEIGHBORHOODS` and `COMPARABLES` constants in
 * `client/src/pages/Home.tsx` with live data fetched from the MLS Grid demo
 * API (https://api-demo.mlsgrid.com/v2). Output shapes are intentionally
 * identical to the original constants so callers do not change.
 *
 * Env vars (read from the repo root, see `vite.config.ts` -> envDir):
 *   - VITE_MLS_GRID_TOKEN     (required) Bearer token for the demo feed
 *   - VITE_MLS_GRID_BASE_URL  (optional) Override the base URL
 *
 * Notes on MLS Grid replication API limits:
 *   - Only the fields in `SERVER_FILTERABLE_FIELDS` (see `client.ts`) can appear
 *     in `$filter`. Beds, baths, and city are filtered client-side via
 *     `applyPropertyFilter` after fetch.
 *   - The default originating system is `actris` (Austin Board of Realtors).
 */

import { fetchAllPages } from "./client";
import type {
  Comparable,
  Neighborhood,
  PropertyFilter,
  RESOProperty,
} from "./types";

export type {
  Comparable,
  Neighborhood,
  PropertyFilter,
  RESOProperty,
} from "./types";

const DEFAULT_ORIGINATING_SYSTEM = "actris";
const DEFAULT_BEDROOMS = 3;
/** Default rows to pull across OData pages before client-side filtering. */
const DEFAULT_MAX_RECORDS = 2000;
const DEFAULT_MIN_GROUP_SIZE = 5;
const PAGE_SIZE = 1000;
const MAX_AGGREGATE_ROWS = 5000;

/**
 * `$select` keeps payloads small. Only fields used by mappers / filters.
 * Must stay in sync with `RESOProperty` usage in this file.
 */
const PROPERTY_SELECT = [
  "ListingId",
  "ListingKey",
  "UnparsedAddress",
  "StreetNumber",
  "StreetName",
  "StreetSuffix",
  "City",
  "PostalCity",
  "CountyOrParish",
  "PropertyType",
  "PropertySubType",
  "StandardStatus",
  "PropertyCondition",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "BathroomsFull",
  "BathroomsHalf",
  "LivingArea",
  "YearBuilt",
  "ListPrice",
  "OriginalListPrice",
  "ClosePrice",
  "CloseDate",
  "DaysOnMarket",
  "CumulativeDaysOnMarket",
  "PoolPrivateYN",
  "PoolFeatures",
  "GarageSpaces",
  "CoveredSpaces",
].join(",");

export interface RawFetchOptions {
  /** MLS Grid originating system name. Defaults to `actris` (Austin). */
  originatingSystem?: string;
  /**
   * Max rows to accumulate across `@odata.nextLink` pages (hard cap 5000).
   * Larger values give client-side filters more candidates.
   */
  maxRecords?: number;
}

export interface FetchOptions extends RawFetchOptions, PropertyFilter {}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Returns one neighborhood row per city in the **filtered** cohort, plus a
 * synthetic `Austin Metro Overall` row for the same cohort. This matches the
 * comparables table (same beds / min baths / cities) so Market Data and
 * Recent Sales stay consistent.
 */
export async function fetchNeighborhoods(
  opts: FetchOptions = {},
): Promise<Neighborhood[]> {
  const raw = await fetchClosedResidentialRaw({
    originatingSystem: opts.originatingSystem,
    maxRecords: opts.maxRecords,
  });
  const props = applyPropertyFilter(raw, propertyFilterFrom(opts));

  const byCity = groupBy(props, (p) => p.City ?? "");
  byCity.delete("");

  const groups = Array.from(byCity.entries())
    .filter(([, recs]) => recs.length >= DEFAULT_MIN_GROUP_SIZE)
    .sort((a, b) => b[1].length - a[1].length);

  const result: Neighborhood[] = groups.map(([city, recs]) => ({
    id: slugify(city),
    label: `${city}, TX`,
    basePrice: Math.round(median(recs.map((r) => r.ClosePrice!))),
    pricePerSqft: Math.round(
      median(recs.map((r) => r.ClosePrice! / r.LivingArea!)),
    ),
    trend: trendFromDataset(recs),
    dom: Math.round(avg(recs.map((r) => r.DaysOnMarket ?? 0))),
  }));

  if (props.length >= DEFAULT_MIN_GROUP_SIZE) {
    result.unshift({
      id: "overall",
      label: "Austin Metro Overall",
      basePrice: Math.round(median(props.map((p) => p.ClosePrice!))),
      pricePerSqft: Math.round(
        median(props.map((p) => p.ClosePrice! / p.LivingArea!)),
      ),
      trend: trendFromDataset(props),
      dom: Math.round(avg(props.map((p) => p.DaysOnMarket ?? 0))),
    });
  }

  return result;
}

/**
 * Returns the N most recent closed sales after client-side filter, sorted by
 * `CloseDate` descending.
 */
export async function fetchComparables(
  opts: FetchOptions & { limit?: number } = {},
): Promise<Comparable[]> {
  const raw = await fetchClosedResidentialRaw({
    originatingSystem: opts.originatingSystem,
    maxRecords: opts.maxRecords,
  });
  const props = applyPropertyFilter(raw, propertyFilterFrom(opts));
  const limit = opts.limit ?? 6;

  const recent = props
    .filter((p) => p.CloseDate)
    .sort((a, b) => b.CloseDate!.localeCompare(a.CloseDate!))
    .slice(0, limit);

  return recent.map(mapToComparable);
}

// -----------------------------------------------------------------------------
// Client-side filtering (MLS Grid v2 — not allowed in `$filter`)
// -----------------------------------------------------------------------------

function totalBaths(p: RESOProperty): number {
  return (
    p.BathroomsTotalInteger ??
    (p.BathroomsFull ?? 0) + 0.5 * (p.BathroomsHalf ?? 0)
  );
}

/**
 * Pure client-side filter for beds, baths, and city. Call on the cached raw
 * closed-residential slice — does not hit the network.
 */
export function applyPropertyFilter(
  props: RESOProperty[],
  filter: PropertyFilter,
): RESOProperty[] {
  const bedList =
    filter.bedrooms === undefined
      ? null
      : Array.isArray(filter.bedrooms)
        ? filter.bedrooms
        : [filter.bedrooms];

  const cities = (filter.cities ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  return props.filter((p) => {
    if ((p.ClosePrice ?? 0) <= 0 || (p.LivingArea ?? 0) <= 0) return false;

    if (bedList !== null && !bedList.includes(p.BedroomsTotal ?? -1)) {
      return false;
    }

    if (
      filter.minBathrooms !== undefined &&
      filter.minBathrooms > 0 &&
      totalBaths(p) + 1e-9 < filter.minBathrooms
    ) {
      return false;
    }

    if (cities.length > 0) {
      const city = (p.City ?? "").trim().toLowerCase();
      const postal = (p.PostalCity ?? "").trim().toLowerCase();
      if (!cities.some((c) => c === city || c === postal)) return false;
    }

    return true;
  });
}

function propertyFilterFrom(opts: FetchOptions): PropertyFilter {
  return {
    bedrooms: opts.bedrooms ?? DEFAULT_BEDROOMS,
    minBathrooms: opts.minBathrooms,
    cities: opts.cities,
  };
}

// -----------------------------------------------------------------------------
// Network + cache
// -----------------------------------------------------------------------------

/**
 * In-memory promise cache: one entry per (originating system × aggregate cap).
 * Bedrooms / baths / city are NOT part of the key — they are applied after
 * `await` via `applyPropertyFilter`.
 */
const propertyCache = new Map<string, Promise<RESOProperty[]>>();

/** Reset the in-memory MLS cache. Useful for tests or a manual "refresh" UI. */
export function clearMlsCache(): void {
  propertyCache.clear();
}

/**
 * Fetches closed residential rows from MLS Grid using **only** allowlisted
 * `$filter` predicates, walks `@odata.nextLink` up to `maxRecords`, then
 * applies structural guards (`ClosePrice` / `LivingArea` present and positive).
 */
async function fetchClosedResidentialRaw(
  opts: RawFetchOptions,
): Promise<RESOProperty[]> {
  const os = opts.originatingSystem ?? DEFAULT_ORIGINATING_SYSTEM;
  const totalCap = Math.min(
    Math.max(1, opts.maxRecords ?? DEFAULT_MAX_RECORDS),
    MAX_AGGREGATE_ROWS,
  );
  const cacheKey = `${os}|${totalCap}`;

  let pending = propertyCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const filter = [
        `OriginatingSystemName eq '${os}'`,
        `StandardStatus eq 'Closed'`,
        `PropertyType eq 'Residential'`,
      ].join(" and ");

      const rows = await fetchAllPages<RESOProperty>(
        "/Property",
        {
          $filter: filter,
          $top: String(Math.min(PAGE_SIZE, totalCap)),
          $select: PROPERTY_SELECT,
        },
        totalCap,
      );

      return rows.filter(
        (p) => (p.LivingArea ?? 0) > 0 && (p.ClosePrice ?? 0) > 0,
      );
    })();

    propertyCache.set(cacheKey, pending);
    pending.catch(() => propertyCache.delete(cacheKey));
  }

  return pending;
}

function mapToComparable(p: RESOProperty): Comparable {
  const baths = totalBaths(p);

  const hasPool =
    Boolean(p.PoolPrivateYN) ||
    (p.PoolFeatures?.some((f) => !/none/i.test(f)) ?? false);

  return {
    address: buildAddress(p),
    neighborhood: p.City ?? p.CountyOrParish ?? "Austin",
    beds: p.BedroomsTotal ?? 0,
    baths,
    sqft: p.LivingArea ?? 0,
    soldPrice: p.ClosePrice ?? 0,
    listPrice: p.ListPrice ?? p.OriginalListPrice ?? p.ClosePrice ?? 0,
    soldDate: formatCloseDate(p.CloseDate),
    dom: p.DaysOnMarket ?? p.CumulativeDaysOnMarket ?? 0,
    yearBuilt: p.YearBuilt ?? 0,
    hasPool,
    hasGarage: (p.GarageSpaces ?? p.CoveredSpaces ?? 0) > 0,
    condition: deriveCondition(p),
  };
}

function buildAddress(p: RESOProperty): string {
  if (p.UnparsedAddress) return p.UnparsedAddress.replace(/\s+/g, " ").trim();
  return [p.StreetNumber, p.StreetName, p.StreetSuffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Maps the RESO `PropertyCondition` array (free-text values like "Resale",
 * "Updated/Remodeled", "New Construction") onto the calculator's condition
 * tiers. Falls back to a property-age heuristic when the field is missing,
 * since `PropertyCondition` is not consistently populated in the demo feed.
 */
function deriveCondition(p: RESOProperty): string {
  const conds = p.PropertyCondition ?? [];
  if (conds.some((c) => /new construction/i.test(c))) return "Excellent";
  if (conds.some((c) => /updated|remodeled/i.test(c))) return "Excellent";
  if (conds.some((c) => /tear[- ]?down|fixer/i.test(c))) return "Poor";
  if (conds.some((c) => /resale/i.test(c))) {
    // Resale is the default vendor value; refine by age below.
  }

  if (p.YearBuilt && p.YearBuilt > 1500) {
    const age = new Date().getUTCFullYear() - p.YearBuilt;
    if (age <= 5) return "Excellent";
    if (age <= 25) return "Good";
    if (age <= 40) return "Fair";
    return "Poor";
  }
  return "Good";
}

function formatCloseDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Synthetic trend %: compares median ClosePrice in the earliest half of the
 * sample (by CloseDate) vs the latest half. The demo feed has no real YoY
 * field, so this is the most honest stand-in we can compute from a snapshot.
 */
function trendFromDataset(records: RESOProperty[]): number {
  const sorted = records
    .filter((r) => r.CloseDate && r.ClosePrice)
    .sort((a, b) => a.CloseDate!.localeCompare(b.CloseDate!));
  if (sorted.length < 4) return 0;

  const half = Math.floor(sorted.length / 2);
  const older = median(sorted.slice(0, half).map((r) => r.ClosePrice!));
  const newer = median(sorted.slice(-half).map((r) => r.ClosePrice!));
  if (!older) return 0;
  return Number((((newer - older) / older) * 100).toFixed(1));
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function median(nums: number[]): number {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(nums: number[]): number {
  const s = nums.filter((n) => Number.isFinite(n));
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
