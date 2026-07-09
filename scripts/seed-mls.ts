/**
 * Fetch closed + active/pending residential listings from MLS Grid and load
 * `data/mls.sqlite`.
 *
 * Usage (from repo root):
 *   pnpm seed:mls
 *
 * Requires `MLS_GRID_TOKEN` or `VITE_MLS_GRID_TOKEN` in `.env.local` or the shell.
 *
 * Env (optional):
 *   MLS_SEED_MAX_RECORDS      — max closed rows (default 2000)
 *   MLS_SEED_OPEN_MAX_RECORDS — max active/pending rows (default 5000)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllPages } from "../shared/mls/client";
import {
  buildOpenListingStatusFilter,
  CLOSED_RESIDENTIAL_PROPERTY_SELECT,
  DEFAULT_MAX_OPEN_RECORDS,
  DEFAULT_MAX_RECORDS,
  DEFAULT_ORIGINATING_SYSTEM,
  MAX_AGGREGATE_ROWS,
  PAGE_SIZE,
} from "../shared/mls/constants";
import type { RESOProperty } from "../shared/mls/types";
import {
  isUsableListingProperty,
  isUsableProperty,
  toCleanProperty,
} from "../shared/mls/transform";
import { resolveMlsDbPath, REPO_ROOT } from "../shared/mls/db-path";
import { loadEnvLocal } from "../shared/env/load-env-local";
import {
  countOpenListings,
  countProperties,
  openMlsDb,
  upsertProperties,
} from "../shared/mls/sqlite";

const DATA_DIR = path.join(REPO_ROOT, "data");
const DB_PATH = resolveMlsDbPath();
const RAW_CLOSED_PATH = path.join(DATA_DIR, "raw-properties-closed.json");
const RAW_OPEN_PATH = path.join(DATA_DIR, "raw-properties-open.json");

const MAX_CLOSED = Math.min(
  Number(process.env.MLS_SEED_MAX_RECORDS ?? DEFAULT_MAX_RECORDS),
  MAX_AGGREGATE_ROWS,
);

const MAX_OPEN = Math.min(
  Number(process.env.MLS_SEED_OPEN_MAX_RECORDS ?? DEFAULT_MAX_OPEN_RECORDS),
  MAX_AGGREGATE_ROWS,
);

const ORIGINATING_SYSTEM =
  process.env.MLS_ORIGINATING_SYSTEM ?? DEFAULT_ORIGINATING_SYSTEM;

async function fetchResidential(
  statusFilter: string,
  maxRecords: number,
): Promise<RESOProperty[]> {
  const filter = [
    `OriginatingSystemName eq '${ORIGINATING_SYSTEM}'`,
    `PropertyType eq 'Residential'`,
    `(${statusFilter})`,
  ].join(" and ");

  return fetchAllPages<RESOProperty>(
    "/Property",
    {
      $filter: filter,
      $top: String(Math.min(PAGE_SIZE, maxRecords)),
      $select: CLOSED_RESIDENTIAL_PROPERTY_SELECT,
    },
    maxRecords,
  );
}

function cleanRows(
  raw: RESOProperty[],
  label: string,
  isUsable: (p: RESOProperty) => boolean,
): ReturnType<typeof toCleanProperty>[] {
  const clean = raw.filter(isUsable).map(toCleanProperty);
  const skipped = raw.length - clean.length;
  if (skipped > 0) {
    console.log(`[seed-mls] ${label}: skipped ${skipped} unusable rows.`);
  }
  return clean;
}

async function main(): Promise<void> {
  loadEnvLocal();

  console.log(
    `[seed-mls] Fetching up to ${MAX_CLOSED} closed + ${MAX_OPEN} active/pending residential rows (${ORIGINATING_SYSTEM})…`,
  );

  const closedRaw = await fetchResidential(
    "StandardStatus eq 'Closed'",
    MAX_CLOSED,
  );
  const openRaw = await fetchResidential(
    buildOpenListingStatusFilter(),
    MAX_OPEN,
  );

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RAW_CLOSED_PATH, JSON.stringify(closedRaw, null, 2));
  writeFileSync(RAW_OPEN_PATH, JSON.stringify(openRaw, null, 2));
  console.log(
    `[seed-mls] Wrote ${closedRaw.length} closed → ${RAW_CLOSED_PATH}`,
  );
  console.log(`[seed-mls] Wrote ${openRaw.length} open → ${RAW_OPEN_PATH}`);

  const closedClean = cleanRows(closedRaw, "Closed", isUsableProperty);
  const openClean = cleanRows(openRaw, "Open", isUsableListingProperty);
  const allClean = [...closedClean, ...openClean];

  const db = openMlsDb(DB_PATH);
  upsertProperties(db, allClean);
  const total = countProperties(db);
  const openTotal = countOpenListings(db);
  db.close();

  console.log(
    `[seed-mls] Upserted ${allClean.length} rows (${closedClean.length} closed, ${openClean.length} open) → ${DB_PATH}`,
  );
  console.log(`[seed-mls] Open listings in DB: ${openTotal}`);
  console.log(`[seed-mls] Table row count: ${total}`);
}

main().catch((err: unknown) => {
  console.error("[seed-mls] Failed:", err);
  process.exit(1);
});
