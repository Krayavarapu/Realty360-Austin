/**
 * Fetch active/pending residential listings from MLS Grid and upsert into
 * `data/mls.sqlite` (same `properties` table as closed sales).
 *
 * Usage (from repo root):
 *   pnpm seed:mls:open
 *
 * Run after `pnpm seed:mls` on first setup, or anytime to refresh open comps.
 * Requires `MLS_GRID_TOKEN` or `VITE_MLS_GRID_TOKEN` in `.env.local` or the shell.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllPages } from "../shared/mls/client";
import {
  buildOpenListingStatusFilter,
  CLOSED_RESIDENTIAL_PROPERTY_SELECT,
  DEFAULT_MAX_OPEN_RECORDS,
  DEFAULT_ORIGINATING_SYSTEM,
  MAX_AGGREGATE_ROWS,
  PAGE_SIZE,
} from "../shared/mls/constants";
import type { RESOProperty } from "../shared/mls/types";
import {
  isUsableListingProperty,
  toCleanProperty,
} from "../shared/mls/transform";
import { resolveMlsDbPath, REPO_ROOT } from "../shared/mls/db-path";
import { loadEnvLocal } from "./load-env-local";
import {
  countOpenListings,
  countProperties,
  openMlsDb,
  upsertProperties,
} from "./mls-db";

const DATA_DIR = path.join(REPO_ROOT, "data");
const DB_PATH = resolveMlsDbPath();
const RAW_PATH = path.join(DATA_DIR, "raw-properties-open.json");

const MAX_RECORDS = Math.min(
  Number(process.env.MLS_SEED_OPEN_MAX_RECORDS ?? DEFAULT_MAX_OPEN_RECORDS),
  MAX_AGGREGATE_ROWS,
);

const ORIGINATING_SYSTEM =
  process.env.MLS_ORIGINATING_SYSTEM ?? DEFAULT_ORIGINATING_SYSTEM;

async function fetchOpenResidential(): Promise<RESOProperty[]> {
  const filter = [
    `OriginatingSystemName eq '${ORIGINATING_SYSTEM}'`,
    `PropertyType eq 'Residential'`,
    `(${buildOpenListingStatusFilter()})`,
  ].join(" and ");

  return fetchAllPages<RESOProperty>(
    "/Property",
    {
      $filter: filter,
      $top: String(Math.min(PAGE_SIZE, MAX_RECORDS)),
      $select: CLOSED_RESIDENTIAL_PROPERTY_SELECT,
    },
    MAX_RECORDS,
  );
}

async function main(): Promise<void> {
  loadEnvLocal();

  console.log(
    `[seed-mls-open] Fetching up to ${MAX_RECORDS} active/pending residential rows (${ORIGINATING_SYSTEM})…`,
  );
  const raw = await fetchOpenResidential();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RAW_PATH, JSON.stringify(raw, null, 2));
  console.log(`[seed-mls-open] Wrote ${raw.length} raw rows → ${RAW_PATH}`);

  const clean = raw.filter(isUsableListingProperty).map(toCleanProperty);
  const skipped = raw.length - clean.length;
  if (skipped > 0) {
    console.log(
      `[seed-mls-open] Skipped ${skipped} rows (missing key, list price, living area, or status).`,
    );
  }

  const db = openMlsDb(DB_PATH);
  upsertProperties(db, clean);
  const total = countProperties(db);
  const openTotal = countOpenListings(db);
  db.close();

  console.log(`[seed-mls-open] Upserted ${clean.length} rows → ${DB_PATH}`);
  console.log(`[seed-mls-open] Open listings in DB: ${openTotal}`);
  console.log(`[seed-mls-open] Table row count: ${total}`);
}

main().catch((err: unknown) => {
  console.error("[seed-mls-open] Failed:", err);
  process.exit(1);
});
