/**
 * Paginate the full Travis County TCAD parcel layer into Postgres (`tcad_parcels`).
 *
 * Usage (from repo root):
 *   pnpm seed:tcad
 *   pnpm seed:tcad -- --fresh          # truncate before load
 *   TCAD_SEED_MAX_PAGES=5 pnpm seed:tcad   # smoke / partial load
 *
 * Requires `DATABASE_URL` in `.env.local` or the environment.
 */
import { loadEnvLocal } from "./load-env-local";
import {
  TCAD_ARCGIS_QUERY_URL,
  TCAD_ARCGIS_WGS84_SR,
} from "../shared/tcad/constants";
import {
  closeTcadPool,
  countTcadParcels,
  ensureTcadSchema,
  truncateTcadParcels,
  upsertTcadParcels,
  type TcadParcelUpsert,
} from "../shared/tcad/db";
import { centroidFromEsriPolygon } from "../shared/tcad/geometry";
import type {
  TcadArcGisAttributes,
  TcadArcGisFeature,
  TcadArcGisQueryResponse,
} from "../shared/tcad/types";

const PAGE_SIZE = Number(process.env.TCAD_SEED_PAGE_SIZE ?? 500);
const MAX_PAGES = process.env.TCAD_SEED_MAX_PAGES
  ? Number(process.env.TCAD_SEED_MAX_PAGES)
  : null;
const REQUEST_TIMEOUT_MS = 60_000;
const PAGE_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 3000, 8000] as const;

const SEED_OUT_FIELDS = [
  "OBJECTID",
  "PROP_ID",
  "geo_id",
  "situs_address",
  "situs_num",
  "situs_city",
  "situs_zip",
  "appraised_val",
  "market_value",
  "assessed_val",
  "deed_date",
  "imprv_homesite_val",
  "land_homesite_val",
  "tcad_acres",
  "GIS_acres",
].join(",");

type SeedAttrs = TcadArcGisAttributes & {
  OBJECTID?: number;
  situs_num?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDeedDate(raw: number | string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function featureToUpsert(feature: TcadArcGisFeature): TcadParcelUpsert | null {
  const attrs = feature.attributes as SeedAttrs | undefined;
  if (!attrs?.PROP_ID) return null;

  const centroid = centroidFromEsriPolygon(feature.geometry?.rings);

  return {
    prop_id: attrs.PROP_ID,
    geo_id: attrs.geo_id ?? null,
    situs_address: attrs.situs_address ?? null,
    situs_num: attrs.situs_num ?? null,
    situs_city: attrs.situs_city ?? null,
    situs_zip: attrs.situs_zip ?? null,
    appraised_val: attrs.appraised_val ?? null,
    market_value: attrs.market_value ?? null,
    assessed_val: attrs.assessed_val ?? null,
    deed_date: formatDeedDate(attrs.deed_date),
    imprv_homesite_val: attrs.imprv_homesite_val ?? null,
    land_homesite_val: attrs.land_homesite_val ?? null,
    tcad_acres: attrs.tcad_acres ?? null,
    gis_acres: attrs.GIS_acres ?? null,
    latitude: centroid?.latitude ?? null,
    longitude: centroid?.longitude ?? null,
  };
}

async function fetchPage(
  offset: number,
  pageSize: number,
): Promise<{ features: TcadArcGisFeature[]; exceededTransferLimit: boolean }> {
  const url = new URL(TCAD_ARCGIS_QUERY_URL);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", SEED_OUT_FIELDS);
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", String(TCAD_ARCGIS_WGS84_SR));
  url.searchParams.set("orderByFields", "OBJECTID");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(pageSize));
  url.searchParams.set("f", "json");

  let lastErr: unknown;
  for (let attempt = 0; attempt < PAGE_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as TcadArcGisQueryResponse & {
        exceededTransferLimit?: boolean;
      };
      if (body.error?.message) {
        throw new Error(body.error.message);
      }
      return {
        features: body.features ?? [],
        exceededTransferLimit: body.exceededTransferLimit === true,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < PAGE_RETRIES - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 5000);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`TCAD page fetch failed at offset ${offset}`);
}

async function fetchFeatureCount(): Promise<number | null> {
  const url = new URL(TCAD_ARCGIS_QUERY_URL);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("f", "json");
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { count?: number };
    return typeof body.count === "number" ? body.count : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required (set in .env.local)");
  }

  const fresh = process.argv.includes("--fresh");
  const pageSize = Number.isFinite(PAGE_SIZE) && PAGE_SIZE > 0 ? PAGE_SIZE : 500;

  console.log("[seed:tcad] Ensuring schema…");
  await ensureTcadSchema();

  if (fresh) {
    console.log("[seed:tcad] Truncating tcad_parcels (--fresh)…");
    await truncateTcadParcels();
  }

  const upstreamCount = await fetchFeatureCount();
  if (upstreamCount != null) {
    console.log(`[seed:tcad] Upstream feature count: ${upstreamCount}`);
  }

  let offset = 0;
  let page = 0;
  let upserted = 0;
  const started = Date.now();

  for (;;) {
    if (MAX_PAGES != null && page >= MAX_PAGES) {
      console.log(`[seed:tcad] Stopping after TCAD_SEED_MAX_PAGES=${MAX_PAGES}`);
      break;
    }

    const { features, exceededTransferLimit } = await fetchPage(offset, pageSize);
    if (features.length === 0) break;

    const rows = features
      .map(featureToUpsert)
      .filter((row): row is TcadParcelUpsert => row != null);

    // Batch upserts in chunks of 100 to keep query size reasonable.
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await upsertTcadParcels(rows.slice(i, i + chunkSize));
    }

    upserted += rows.length;
    page += 1;
    offset += features.length;

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    const progress =
      upstreamCount != null
        ? ` (${((offset / upstreamCount) * 100).toFixed(1)}%)`
        : "";
    console.log(
      `[seed:tcad] page ${page}: +${rows.length} rows (offset ${offset}${progress}, ${elapsedSec}s)`,
    );

    if (!exceededTransferLimit && features.length < pageSize) break;
  }

  const total = await countTcadParcels();
  const elapsedMin = ((Date.now() - started) / 60_000).toFixed(2);
  console.log(
    `[seed:tcad] Done. Upserted ${upserted} rows this run; table has ${total} parcels (${elapsedMin} min).`,
  );

  await closeTcadPool();
}

main().catch(async (err) => {
  console.error("[seed:tcad] Failed:", err);
  await closeTcadPool().catch(() => undefined);
  process.exit(1);
});
