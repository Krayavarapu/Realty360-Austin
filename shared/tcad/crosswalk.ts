/**
 * Precomputed MLS listing_key ↔ TCAD prop_id links (Neon Postgres).
 * Built by `pnpm seed:crosswalk` from MLS SQLite + TCAD address matching.
 */
import { ensureTcadSchema, getTcadPool, isTcadCacheConfigured } from "./db";
import type pg from "pg";

export type MlsTcadCrosswalkMatchMethod = "address_single" | "address_ambiguous";

export interface MlsTcadCrosswalkLink {
  listingKey: string;
  propId: number;
  addressNorm: string | null;
  matchMethod: MlsTcadCrosswalkMatchMethod;
  matchScore: number | null;
}

export interface MlsTcadCrosswalkUpsert {
  listing_key: string;
  prop_id: number;
  address_norm: string | null;
  match_method: MlsTcadCrosswalkMatchMethod;
  match_score: number | null;
}

const CROSSWALK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS mls_tcad_crosswalk (
  listing_key   TEXT NOT NULL,
  prop_id       INTEGER NOT NULL,
  address_norm  TEXT,
  match_method  TEXT NOT NULL,
  match_score   SMALLINT,
  built_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_key, prop_id)
);

CREATE INDEX IF NOT EXISTS idx_mls_tcad_crosswalk_listing_key
  ON mls_tcad_crosswalk (listing_key);

CREATE INDEX IF NOT EXISTS idx_mls_tcad_crosswalk_prop_id
  ON mls_tcad_crosswalk (prop_id);
`;

let crosswalkSchemaReady: Promise<void> | null = null;

export function isCrosswalkConfigured(): boolean {
  return isTcadCacheConfigured();
}

export async function ensureCrosswalkSchema(
  client?: pg.Pool | pg.PoolClient,
): Promise<void> {
  await ensureTcadSchema(client);
  const db = client ?? getTcadPool();
  if (!crosswalkSchemaReady) {
    crosswalkSchemaReady = db.query(CROSSWALK_SCHEMA_SQL).then(() => undefined);
  }
  await crosswalkSchemaReady;
}

function rowToLink(row: {
  listing_key: string;
  prop_id: number;
  address_norm: string | null;
  match_method: string;
  match_score: number | null;
}): MlsTcadCrosswalkLink {
  return {
    listingKey: row.listing_key,
    propId: row.prop_id,
    addressNorm: row.address_norm,
    matchMethod: row.match_method as MlsTcadCrosswalkMatchMethod,
    matchScore: row.match_score,
  };
}

export async function truncateCrosswalk(): Promise<void> {
  await ensureCrosswalkSchema();
  await getTcadPool().query("TRUNCATE mls_tcad_crosswalk");
}

export async function countCrosswalkLinks(): Promise<number> {
  await ensureCrosswalkSchema();
  const result = await getTcadPool().query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM mls_tcad_crosswalk",
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function countCrosswalkListings(): Promise<number> {
  await ensureCrosswalkSchema();
  const result = await getTcadPool().query<{ n: string }>(
    "SELECT COUNT(DISTINCT listing_key)::text AS n FROM mls_tcad_crosswalk",
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function upsertCrosswalkLinks(
  rows: MlsTcadCrosswalkUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  await ensureCrosswalkSchema();
  const pool = getTcadPool();

  const cols = [
    "listing_key",
    "prop_id",
    "address_norm",
    "match_method",
    "match_score",
  ] as const;

  const values: unknown[] = [];
  const tuples: string[] = [];
  let param = 1;

  for (const row of rows) {
    tuples.push(
      `($${param++}, $${param++}, $${param++}, $${param++}, $${param++})`,
    );
    values.push(
      row.listing_key,
      row.prop_id,
      row.address_norm,
      row.match_method,
      row.match_score,
    );
  }

  await pool.query(
    `INSERT INTO mls_tcad_crosswalk (${cols.join(", ")})
     VALUES ${tuples.join(", ")}
     ON CONFLICT (listing_key, prop_id) DO UPDATE SET
       address_norm = EXCLUDED.address_norm,
       match_method = EXCLUDED.match_method,
       match_score = EXCLUDED.match_score,
       built_at = NOW()`,
    values,
  );
}

export async function findCrosswalkLinksByListingKey(
  listingKey: string,
): Promise<MlsTcadCrosswalkLink[]> {
  if (!isCrosswalkConfigured()) return [];
  await ensureCrosswalkSchema();
  const result = await getTcadPool().query<{
    listing_key: string;
    prop_id: number;
    address_norm: string | null;
    match_method: string;
    match_score: number | null;
  }>(
    `SELECT listing_key, prop_id, address_norm, match_method, match_score
     FROM mls_tcad_crosswalk
     WHERE listing_key = $1
     ORDER BY match_score DESC NULLS LAST, prop_id`,
    [listingKey],
  );
  return result.rows.map(rowToLink);
}

/** Batch lookup for comp enrichment — returns all links grouped by listing_key. */
export async function findCrosswalkLinksByListingKeys(
  listingKeys: string[],
): Promise<Map<string, MlsTcadCrosswalkLink[]>> {
  const map = new Map<string, MlsTcadCrosswalkLink[]>();
  if (!isCrosswalkConfigured() || listingKeys.length === 0) return map;

  await ensureCrosswalkSchema();
  const unique = Array.from(new Set(listingKeys.filter(Boolean)));
  const result = await getTcadPool().query<{
    listing_key: string;
    prop_id: number;
    address_norm: string | null;
    match_method: string;
    match_score: number | null;
  }>(
    `SELECT listing_key, prop_id, address_norm, match_method, match_score
     FROM mls_tcad_crosswalk
     WHERE listing_key = ANY($1::text[])
     ORDER BY listing_key, match_score DESC NULLS LAST, prop_id`,
    [unique],
  );

  for (const row of result.rows) {
    const link = rowToLink(row);
    const bucket = map.get(link.listingKey);
    if (bucket) bucket.push(link);
    else map.set(link.listingKey, [link]);
  }
  return map;
}

/** Use crosswalk only when exactly one TCAD parcel is linked to the listing. */
export async function findUniqueCrosswalkPropId(
  listingKey: string,
): Promise<number | null> {
  const links = await findCrosswalkLinksByListingKey(listingKey);
  if (links.length !== 1) return null;
  return links[0]!.propId;
}
