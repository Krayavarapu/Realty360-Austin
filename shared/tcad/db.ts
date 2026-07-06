/**
 * Postgres cache for Travis County TCAD parcels (Neon or any Postgres).
 * Populated by `pnpm seed:tcad`. Reads fall back to live ArcGIS when unset/empty.
 */
import pg from "pg";
import { haversineMiles } from "../comparables/geo";
import type { TcadPropertyDto } from "./types";

const { Pool } = pg;

export interface TcadParcelRow {
  prop_id: number;
  geo_id: string | null;
  situs_address: string | null;
  situs_num: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  appraised_val: number | null;
  market_value: number | null;
  assessed_val: number | null;
  deed_date: string | null;
  imprv_homesite_val: number | null;
  land_homesite_val: number | null;
  tcad_acres: number | null;
  gis_acres: number | null;
  latitude: number | null;
  longitude: number | null;
  seeded_at: Date | string;
}

export interface TcadParcelUpsert {
  prop_id: number;
  geo_id: string | null;
  situs_address: string | null;
  situs_num: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  appraised_val: number | null;
  market_value: number | null;
  assessed_val: number | null;
  deed_date: string | null;
  imprv_homesite_val: number | null;
  land_homesite_val: number | null;
  tcad_acres: number | null;
  gis_acres: number | null;
  latitude: number | null;
  longitude: number | null;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tcad_parcels (
  prop_id INTEGER PRIMARY KEY,
  geo_id TEXT,
  situs_address TEXT,
  situs_num TEXT,
  situs_city TEXT,
  situs_zip TEXT,
  appraised_val DOUBLE PRECISION,
  market_value DOUBLE PRECISION,
  assessed_val DOUBLE PRECISION,
  deed_date TEXT,
  imprv_homesite_val DOUBLE PRECISION,
  land_homesite_val DOUBLE PRECISION,
  tcad_acres DOUBLE PRECISION,
  gis_acres DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcad_parcels_situs_num ON tcad_parcels (situs_num);
CREATE INDEX IF NOT EXISTS idx_tcad_parcels_situs_zip ON tcad_parcels (situs_zip);
CREATE INDEX IF NOT EXISTS idx_tcad_parcels_lat_lon
  ON tcad_parcels (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
`;

let pool: pg.Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function isTcadCacheConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getTcadPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "[tcad-db] DATABASE_URL is not set. Add it to .env.local and run pnpm seed:tcad.",
    );
  }
  if (!pool) {
    const needsSsl =
      /neon\.tech|sslmode=require/i.test(connectionString) ||
      process.env.PGSSLMODE === "require";
    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return pool;
}

export async function ensureTcadSchema(client?: pg.Pool | pg.PoolClient): Promise<void> {
  const db = client ?? getTcadPool();
  if (!schemaReady) {
    schemaReady = db.query(SCHEMA_SQL).then(() => undefined);
  }
  await schemaReady;
}

export async function closeTcadPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}

export function parcelRowToDto(row: TcadParcelRow): TcadPropertyDto {
  const seededAt =
    row.seeded_at instanceof Date
      ? row.seeded_at.toISOString()
      : new Date(row.seeded_at).toISOString();

  return {
    propId: row.prop_id,
    geoId: row.geo_id,
    situsAddress: row.situs_address,
    city: row.situs_city,
    zip: row.situs_zip,
    latitude: row.latitude,
    longitude: row.longitude,
    appraisedValue: row.appraised_val,
    marketValue: row.market_value,
    assessedValue: row.assessed_val,
    improvementHomesiteValue: row.imprv_homesite_val,
    landHomesiteValue: row.land_homesite_val,
    tcadAcres: row.tcad_acres,
    gisAcres: row.gis_acres,
    deedDate: row.deed_date,
    source: "tcad-cache",
    fetchedAt: seededAt,
  };
}

export async function countTcadParcels(): Promise<number> {
  await ensureTcadSchema();
  const result = await getTcadPool().query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM tcad_parcels",
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function truncateTcadParcels(): Promise<void> {
  await ensureTcadSchema();
  await getTcadPool().query("TRUNCATE tcad_parcels");
}

export async function upsertTcadParcels(rows: TcadParcelUpsert[]): Promise<void> {
  if (rows.length === 0) return;
  await ensureTcadSchema();

  // ArcGIS pages can include the same PROP_ID more than once (multipart parcels).
  const deduped = dedupeParcelsByPropId(rows);
  if (deduped.length === 0) return;

  const cols = [
    "prop_id",
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
    "gis_acres",
    "latitude",
    "longitude",
  ] as const;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < deduped.length; i++) {
    const row = deduped[i]!;
    const base = i * cols.length;
    placeholders.push(
      `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")}, NOW())`,
    );
    values.push(
      row.prop_id,
      row.geo_id,
      row.situs_address,
      row.situs_num,
      row.situs_city,
      row.situs_zip,
      row.appraised_val,
      row.market_value,
      row.assessed_val,
      row.deed_date,
      row.imprv_homesite_val,
      row.land_homesite_val,
      row.tcad_acres,
      row.gis_acres,
      row.latitude,
      row.longitude,
    );
  }

  const sql = `
    INSERT INTO tcad_parcels (${cols.join(", ")}, seeded_at)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (prop_id) DO UPDATE SET
      geo_id = EXCLUDED.geo_id,
      situs_address = EXCLUDED.situs_address,
      situs_num = EXCLUDED.situs_num,
      situs_city = EXCLUDED.situs_city,
      situs_zip = EXCLUDED.situs_zip,
      appraised_val = EXCLUDED.appraised_val,
      market_value = EXCLUDED.market_value,
      assessed_val = EXCLUDED.assessed_val,
      deed_date = EXCLUDED.deed_date,
      imprv_homesite_val = EXCLUDED.imprv_homesite_val,
      land_homesite_val = EXCLUDED.land_homesite_val,
      tcad_acres = EXCLUDED.tcad_acres,
      gis_acres = EXCLUDED.gis_acres,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      seeded_at = NOW()
  `;

  await getTcadPool().query(sql, values);
}

/** Last row wins when ArcGIS returns duplicate PROP_IDs in one batch. */
function dedupeParcelsByPropId(
  rows: TcadParcelUpsert[],
): TcadParcelUpsert[] {
  const byPropId = new Map<number, TcadParcelUpsert>();
  for (const row of rows) {
    byPropId.set(row.prop_id, row);
  }
  return Array.from(byPropId.values());
}

export async function findTcadParcelByPropId(
  propId: number,
): Promise<TcadPropertyDto | null> {
  if (!isTcadCacheConfigured()) return null;
  await ensureTcadSchema();
  const result = await getTcadPool().query<TcadParcelRow>(
    "SELECT * FROM tcad_parcels WHERE prop_id = $1 LIMIT 1",
    [propId],
  );
  const row = result.rows[0];
  return row ? parcelRowToDto(row) : null;
}

/**
 * Candidate parcels for address scoring (mirrors ArcGIS situs_num + LIKE filters).
 */
export async function findTcadParcelAddressCandidates(opts: {
  streetNumber: string | null;
  streetLike: string | null;
  zip: string | null;
  limit?: number;
}): Promise<TcadPropertyDto[]> {
  if (!isTcadCacheConfigured()) return [];
  await ensureTcadSchema();

  const limit = opts.limit ?? 50;
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts.streetNumber) {
    params.push(opts.streetNumber);
    clauses.push(`situs_num = $${params.length}`);
  }
  if (opts.streetLike) {
    params.push(`%${opts.streetLike}%`);
    clauses.push(`UPPER(situs_address) LIKE $${params.length}`);
  }
  if (opts.zip) {
    params.push(opts.zip);
    clauses.push(`situs_zip = $${params.length}`);
  }

  if (clauses.length === 0) return [];

  params.push(limit);
  const result = await getTcadPool().query<TcadParcelRow>(
    `SELECT * FROM tcad_parcels
     WHERE ${clauses.join(" AND ")}
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(parcelRowToDto);
}

export async function findTcadParcelsWithinRadius(opts: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  excludePropId?: number;
  limit?: number;
}): Promise<Array<TcadPropertyDto & { distanceMiles: number }>> {
  if (!isTcadCacheConfigured()) return [];
  await ensureTcadSchema();

  const {
    latitude,
    longitude,
    radiusMiles,
    excludePropId,
    limit = 50,
  } = opts;

  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));

  const result = await getTcadPool().query<TcadParcelRow>(
    `SELECT * FROM tcad_parcels
     WHERE latitude IS NOT NULL
       AND longitude IS NOT NULL
       AND latitude BETWEEN $1 AND $2
       AND longitude BETWEEN $3 AND $4
       AND ($5::int IS NULL OR prop_id <> $5)
     LIMIT $6`,
    [
      latitude - latDelta,
      latitude + latDelta,
      longitude - lonDelta,
      longitude + lonDelta,
      excludePropId ?? null,
      Math.min(limit * 4, 200),
    ],
  );

  return result.rows
    .map((row) => {
      const dto = parcelRowToDto(row);
      if (dto.latitude == null || dto.longitude == null) return null;
      const distanceMiles = haversineMiles(
        latitude,
        longitude,
        dto.latitude,
        dto.longitude,
      );
      if (distanceMiles > radiusMiles) return null;
      return { ...dto, distanceMiles };
    })
    .filter(
      (row): row is TcadPropertyDto & { distanceMiles: number } => row != null,
    )
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}
