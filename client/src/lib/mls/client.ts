import type { ODataResponse } from "./types";

const DEFAULT_BASE_URL = "https://api-demo.mlsgrid.com/v2";

/**
 * MLS Grid only allows a small set of fields in `$filter` on the replication
 * API. Anything outside this set must be filtered client-side after fetch.
 */
export const SERVER_FILTERABLE_FIELDS = [
  "OriginatingSystemName",
  "StandardStatus",
  "PropertyType",
  "ListingId",
  "MlgCanView",
  "ModificationTimestamp",
  "ListOfficeMlsId",
] as const;

function readToken(): string {
  const tok = import.meta.env.VITE_MLS_GRID_TOKEN;
  if (!tok) {
    throw new Error(
      "[mls] VITE_MLS_GRID_TOKEN is not set. Add it to .env.local at the repo root and restart the dev server.",
    );
  }
  return tok;
}

function readBaseUrl(): string {
  return import.meta.env.VITE_MLS_GRID_BASE_URL ?? DEFAULT_BASE_URL;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${readToken()}`,
    Accept: "application/json",
  };
}

/**
 * Single-page OData fetch. `query` keys should be OData params like `$filter`,
 * `$top`, `$select`, `$expand` — passed verbatim into the query string.
 */
export async function fetchOData<T>(
  path: string,
  query: Record<string, string> = {},
): Promise<ODataResponse<T>> {
  const url = new URL(`${readBaseUrl()}${path}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[mls] ${res.status} ${res.statusText} for ${url.pathname}${url.search}${body ? ` — ${body}` : ""}`,
    );
  }
  return (await res.json()) as ODataResponse<T>;
}

/**
 * Walk `@odata.nextLink` pages until either the link runs out or `maxRecords`
 * is reached. The demo feed is small but production replication needs paging.
 */
export async function fetchAllPages<T>(
  path: string,
  query: Record<string, string> = {},
  maxRecords = 1000,
): Promise<T[]> {
  let page = await fetchOData<T>(path, query);
  const out: T[] = [...page.value];

  while (page["@odata.nextLink"] && out.length < maxRecords) {
    const res = await fetch(page["@odata.nextLink"], { headers: authHeaders() });
    if (!res.ok) break;
    page = (await res.json()) as ODataResponse<T>;
    out.push(...page.value);
  }

  return out.slice(0, maxRecords);
}
