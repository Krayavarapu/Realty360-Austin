/**
 * Build MLS listing_key ↔ TCAD prop_id crosswalk in Neon (`mls_tcad_crosswalk`).
 *
 * Usage (from repo root):
 *   pnpm seed:crosswalk
 *   pnpm seed:crosswalk -- --fresh    # truncate before rebuild
 *
 * Requires `data/mls.sqlite` (pnpm seed:mls) and `tcad_parcels` (pnpm seed:tcad).
 */
import { loadEnvLocal } from "../shared/env/load-env-local";
import { openDefaultMlsDb, type PropertyRow } from "../shared/mls/sqlite";
import { fetchTcadAddressLookupOutcomeFromCache } from "../shared/tcad/client";
import {
  closeTcadPool,
  countTcadParcels,
  ensureTcadSchema,
} from "../shared/tcad/db";
import {
  countCrosswalkLinks,
  countCrosswalkListings,
  ensureCrosswalkSchema,
  truncateCrosswalk,
  upsertCrosswalkLinks,
  type MlsTcadCrosswalkUpsert,
} from "../shared/tcad/crosswalk";

const CONCURRENCY = Number(process.env.CROSSWALK_CONCURRENCY ?? 15);
const BATCH_UPSERT = 200;

function tcadQueryForRow(row: PropertyRow): string {
  const parts = [row.address_line];
  if (row.postal_code && !row.address_line.includes(row.postal_code)) {
    parts.push(row.postal_code);
  }
  return parts.join(" ");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required (set in .env.local)");
  }

  const fresh = process.argv.includes("--fresh");

  await ensureTcadSchema();
  await ensureCrosswalkSchema();

  const parcelCount = await countTcadParcels();
  if (parcelCount === 0) {
    throw new Error("tcad_parcels is empty — run pnpm seed:tcad first");
  }

  const db = openDefaultMlsDb();
  let rows: PropertyRow[];
  try {
    rows = db
      .prepare(
        `SELECT listing_key, listing_id, address_line, address_norm, postal_code,
                latitude, longitude, standard_status
         FROM properties
         ORDER BY listing_key`,
      )
      .all() as unknown as PropertyRow[];
  } finally {
    db.close();
  }

  if (rows.length === 0) {
    throw new Error("MLS SQLite is empty — run pnpm seed:mls first");
  }

  if (fresh) {
    console.log("Truncating mls_tcad_crosswalk…");
    await truncateCrosswalk();
  }

  console.log(
    `Crosswalking ${rows.length.toLocaleString()} MLS listings against ${parcelCount.toLocaleString()} TCAD parcels…`,
  );

  let single = 0;
  let ambiguous = 0;
  let notFound = 0;

  const allLinks: MlsTcadCrosswalkUpsert[] = [];

  const batches = await mapWithConcurrency(rows, CONCURRENCY, async (row, index) => {
    const query = tcadQueryForRow(row);
    const outcome = await fetchTcadAddressLookupOutcomeFromCache(query);
    const batch: MlsTcadCrosswalkUpsert[] = [];
    let outcomeKind: "single" | "ambiguous" | "not_found" = "not_found";

    if (outcome.status === "single" && outcome.property) {
      outcomeKind = "single";
      batch.push({
        listing_key: row.listing_key,
        prop_id: outcome.property.propId,
        address_norm: row.address_norm,
        match_method: "address_single",
        match_score: outcome.matchScore,
      });
    } else if (outcome.status === "ambiguous") {
      outcomeKind = "ambiguous";
      for (const candidate of outcome.candidates) {
        batch.push({
          listing_key: row.listing_key,
          prop_id: candidate.propId,
          address_norm: row.address_norm,
          match_method: "address_ambiguous",
          match_score: null,
        });
      }
    }

    if ((index + 1) % 500 === 0 || index + 1 === rows.length) {
      console.log(`  …${index + 1}/${rows.length} processed`);
    }

    return { batch, outcomeKind };
  });

  for (const { batch, outcomeKind } of batches) {
    allLinks.push(...batch);
    if (outcomeKind === "single") single++;
    else if (outcomeKind === "ambiguous") ambiguous++;
    else notFound++;
  }

  for (let i = 0; i < allLinks.length; i += BATCH_UPSERT) {
    await upsertCrosswalkLinks(allLinks.slice(i, i + BATCH_UPSERT));
  }

  const linksWritten = allLinks.length;

  const totalLinks = await countCrosswalkLinks();
  const linkedListings = await countCrosswalkListings();

  console.log("\nCrosswalk complete:");
  console.log(`  MLS listings processed: ${rows.length.toLocaleString()}`);
  console.log(`  single TCAD match:      ${single.toLocaleString()}`);
  console.log(`  ambiguous:              ${ambiguous.toLocaleString()}`);
  console.log(`  not found:              ${notFound.toLocaleString()}`);
  console.log(`  rows upserted (run):    ${linksWritten.toLocaleString()}`);
  console.log(`  total crosswalk rows:   ${totalLinks.toLocaleString()}`);
  console.log(`  distinct listings:      ${linkedListings.toLocaleString()}`);

  await closeTcadPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
