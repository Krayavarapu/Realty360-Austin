/**
 * Fetch closed residential listings from MLS Grid and load `data/mls.sqlite`.
 *
 * Usage (from repo root):
 *   pnpm seed:mls
 *
 * Requires `MLS_GRID_TOKEN` or `VITE_MLS_GRID_TOKEN` in `.env.local` or the shell.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllPages } from "../shared/mls/client";
import {
  CLOSED_RESIDENTIAL_PROPERTY_SELECT,
  DEFAULT_MAX_RECORDS,
  DEFAULT_ORIGINATING_SYSTEM,
  MAX_AGGREGATE_ROWS,
  PAGE_SIZE,
} from "../shared/mls/constants";
import type { RESOProperty } from "../shared/mls/types";
import {
  isUsableProperty,
  toCleanProperty,
} from "../shared/mls/transform";
import { loadEnvLocal, REPO_ROOT } from "./load-env-local";
import { countProperties, openMlsDb, upsertProperties } from "./mls-db";

const DATA_DIR = path.join(REPO_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "mls.sqlite");
const RAW_PATH = path.join(DATA_DIR, "raw-properties.json");

const MAX_RECORDS = Math.min(
  Number(process.env.MLS_SEED_MAX_RECORDS ?? DEFAULT_MAX_RECORDS),
  MAX_AGGREGATE_ROWS,
);

const ORIGINATING_SYSTEM =
  process.env.MLS_ORIGINATING_SYSTEM ?? DEFAULT_ORIGINATING_SYSTEM;

async function fetchClosedResidential(): Promise<RESOProperty[]> {
  const filter = [
    `OriginatingSystemName eq '${ORIGINATING_SYSTEM}'`,
    `StandardStatus eq 'Closed'`,
    `PropertyType eq 'Residential'`,
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
    `[seed-mls] Fetching up to ${MAX_RECORDS} closed residential rows (${ORIGINATING_SYSTEM})…`,
  );
  const raw = await fetchClosedResidential();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RAW_PATH, JSON.stringify(raw, null, 2));
  console.log(`[seed-mls] Wrote ${raw.length} raw rows → ${RAW_PATH}`);

  const clean = raw.filter(isUsableProperty).map(toCleanProperty);
  const skipped = raw.length - clean.length;
  if (skipped > 0) {
    console.log(
      `[seed-mls] Skipped ${skipped} rows (missing key, close price, or living area).`,
    );
  }

  const db = openMlsDb(DB_PATH);
  upsertProperties(db, clean);
  const total = countProperties(db);
  db.close();

  console.log(`[seed-mls] Upserted ${clean.length} rows → ${DB_PATH}`);
  console.log(`[seed-mls] Table row count: ${total}`);
}

main().catch((err: unknown) => {
  console.error("[seed-mls] Failed:", err);
  process.exit(1);
});
