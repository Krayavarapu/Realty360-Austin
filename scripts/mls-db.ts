import fs from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { resolveMlsDbPath } from "../shared/mls/db-path";
import type { CleanProperty } from "../shared/mls/transform";

/** Full row from `properties` (snake_case column names). */
export type PropertyRow = CleanProperty & { updated_at?: string };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS properties (
  listing_key       TEXT PRIMARY KEY,
  listing_id        TEXT NOT NULL,
  address_line      TEXT NOT NULL,
  address_norm      TEXT NOT NULL,
  street_number     TEXT,
  street_name       TEXT,
  street_suffix     TEXT,
  city              TEXT,
  postal_code       TEXT,
  state             TEXT,
  latitude          REAL,
  longitude         REAL,
  standard_status   TEXT,
  property_type     TEXT,
  bedrooms          INTEGER,
  bathrooms         REAL,
  living_area_sqft  INTEGER,
  close_price       INTEGER,
  close_date        TEXT,
  year_built        INTEGER,
  days_on_market    INTEGER,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_address_norm ON properties(address_norm);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_listing_id ON properties(listing_id);
`;

const UPSERT = `
INSERT INTO properties (
  listing_key, listing_id, address_line, address_norm,
  street_number, street_name, street_suffix, city, postal_code, state,
  latitude, longitude, standard_status, property_type,
  bedrooms, bathrooms, living_area_sqft, close_price, close_date,
  year_built, days_on_market, updated_at
) VALUES (
  @listing_key, @listing_id, @address_line, @address_norm,
  @street_number, @street_name, @street_suffix, @city, @postal_code, @state,
  @latitude, @longitude, @standard_status, @property_type,
  @bedrooms, @bathrooms, @living_area_sqft, @close_price, @close_date,
  @year_built, @days_on_market, datetime('now')
)
ON CONFLICT(listing_key) DO UPDATE SET
  listing_id = excluded.listing_id,
  address_line = excluded.address_line,
  address_norm = excluded.address_norm,
  street_number = excluded.street_number,
  street_name = excluded.street_name,
  street_suffix = excluded.street_suffix,
  city = excluded.city,
  postal_code = excluded.postal_code,
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  standard_status = excluded.standard_status,
  property_type = excluded.property_type,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  living_area_sqft = excluded.living_area_sqft,
  close_price = excluded.close_price,
  close_date = excluded.close_date,
  year_built = excluded.year_built,
  days_on_market = excluded.days_on_market,
  updated_at = datetime('now');
`;

export type MlsDatabase = DatabaseSync;

export function openMlsDb(dbPath: string): MlsDatabase {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

export function upsertProperties(db: MlsDatabase, rows: CleanProperty[]): void {
  const stmt = db.prepare(UPSERT);
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      stmt.run(row as unknown as Record<string, SQLInputValue>);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function countProperties(db: MlsDatabase): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM properties").get() as {
    n: number;
  };
  return row.n;
}

export function openDefaultMlsDb(): MlsDatabase {
  const dbPath = resolveMlsDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `[mls-db] Database not found at ${dbPath}. Run pnpm seed:mls first.`,
    );
  }
  return openMlsDb(dbPath);
}

const SELECT_PROPERTY = `
SELECT
  listing_key, listing_id, address_line, address_norm,
  street_number, street_name, street_suffix, city, postal_code, state,
  latitude, longitude, standard_status, property_type,
  bedrooms, bathrooms, living_area_sqft, close_price, close_date,
  year_built, days_on_market, updated_at
FROM properties
`;

/** Exact match on `address_norm`. */
export function findPropertyByAddressNorm(
  db: MlsDatabase,
  addressNorm: string,
): PropertyRow | undefined {
  return db
    .prepare(`${SELECT_PROPERTY} WHERE address_norm = @address_norm LIMIT 1`)
    .get({ address_norm: addressNorm }) as PropertyRow | undefined;
}

/**
 * Prefix match when the query omits postal code / state (stored norms often
 * include `city zip state`).
 */
export function findPropertyByAddressPrefix(
  db: MlsDatabase,
  addressNorm: string,
): PropertyRow | undefined {
  return db
    .prepare(
      `${SELECT_PROPERTY}
       WHERE address_norm = @address_norm
          OR address_norm LIKE @prefix
       ORDER BY CASE WHEN address_norm = @address_norm THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get({
      address_norm: addressNorm,
      prefix: `${addressNorm} %`,
    }) as PropertyRow | undefined;
}

/**
 * Partial match when exact lookup fails (normalized substring on `address_norm`).
 */
export function searchPropertiesByAddress(
  db: MlsDatabase,
  addressNorm: string,
  limit = 10,
): PropertyRow[] {
  return db
    .prepare(
      `${SELECT_PROPERTY}
       WHERE address_norm LIKE '%' || @address_norm || '%'
       ORDER BY address_line
       LIMIT @limit`,
    )
    .all({ address_norm: addressNorm, limit }) as unknown as PropertyRow[];
}
