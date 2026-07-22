import { resolveMlsBaseUrl, resolveMlsToken } from "./env";
import type { ODataResponse } from "./types";

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${resolveMlsToken()}`,
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
  const url = new URL(`${resolveMlsBaseUrl()}${path}`);
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
 * is reached.
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
