import fs from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  addressQueryMatchesProperty,
  buildAddressLookupPrefixes,
  buildCanonicalAddressNorm,
  parseAddressQuery,
} from "../shared/mls/address-query";
import { resolveMlsDbPath } from "../shared/mls/db-path";
import type { CleanProperty } from "../shared/mls/transform";
import { normalizeAddress } from "../shared/mls/transform";

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
  list_price        INTEGER,
  close_price       INTEGER,
  close_date        TEXT,
  year_built        INTEGER,
  days_on_market    INTEGER,
  has_pool          INTEGER,
  garage_spaces     INTEGER,
  lot_size_acres    REAL,
  property_condition TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_address_norm ON properties(address_norm);
CREATE INDEX IF NOT EXISTS idx_properties_address_line ON properties(address_line);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_listing_id ON properties(listing_id);
CREATE INDEX IF NOT EXISTS idx_properties_close_date ON properties(close_date);
`;

/** Columns added after initial schema — applied via ALTER for existing DBs. */
const SCHEMA_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ["list_price", "INTEGER"],
  ["has_pool", "INTEGER"],
  ["garage_spaces", "INTEGER"],
  ["lot_size_acres", "REAL"],
  ["property_condition", "TEXT"],
];

function ensureSchemaMigrations(db: MlsDatabase): void {
  const existing = new Set(
    (
      db.prepare("PRAGMA table_info(properties)").all() as { name: string }[]
    ).map((row) => row.name),
  );
  for (const [column, sqlType] of SCHEMA_MIGRATIONS) {
    if (!existing.has(column)) {
      db.exec(`ALTER TABLE properties ADD COLUMN ${column} ${sqlType}`);
    }
  }
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_properties_close_date ON properties(close_date)",
  );
}

function toSqliteRow(row: CleanProperty): Record<string, SQLInputValue> {
  return {
    ...row,
    has_pool:
      row.has_pool === null ? null : row.has_pool ? 1 : 0,
  };
}

const UPSERT = `
INSERT INTO properties (
  listing_key, listing_id, address_line, address_norm,
  street_number, street_name, street_suffix, city, postal_code, state,
  latitude, longitude, standard_status, property_type,
  bedrooms, bathrooms, living_area_sqft, list_price, close_price, close_date,
  year_built, days_on_market, has_pool, garage_spaces, lot_size_acres,
  property_condition, updated_at
) VALUES (
  @listing_key, @listing_id, @address_line, @address_norm,
  @street_number, @street_name, @street_suffix, @city, @postal_code, @state,
  @latitude, @longitude, @standard_status, @property_type,
  @bedrooms, @bathrooms, @living_area_sqft, @list_price, @close_price, @close_date,
  @year_built, @days_on_market, @has_pool, @garage_spaces, @lot_size_acres,
  @property_condition, datetime('now')
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
  list_price = excluded.list_price,
  close_price = excluded.close_price,
  close_date = excluded.close_date,
  year_built = excluded.year_built,
  days_on_market = excluded.days_on_market,
  has_pool = excluded.has_pool,
  garage_spaces = excluded.garage_spaces,
  lot_size_acres = excluded.lot_size_acres,
  property_condition = excluded.property_condition,
  updated_at = datetime('now');
`;

export type MlsDatabase = DatabaseSync;

export function openMlsDb(dbPath: string): MlsDatabase {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  ensureSchemaMigrations(db);
  return db;
}

export function upsertProperties(db: MlsDatabase, rows: CleanProperty[]): void {
  const stmt = db.prepare(UPSERT);
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      stmt.run(toSqliteRow(row));
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
  bedrooms, bathrooms, living_area_sqft, list_price, close_price, close_date,
  year_built, days_on_market, has_pool, garage_spaces, lot_size_acres,
  property_condition, updated_at
FROM properties
`;

function normalizePropertyRow(row: PropertyRow): PropertyRow {
  const pool = row.has_pool as boolean | number | null | undefined;
  return {
    ...row,
    has_pool:
      pool === null || pool === undefined
        ? null
        : pool === true || pool === 1,
  };
}

function normalizePropertyRows(rows: PropertyRow[]): PropertyRow[] {
  return rows.map(normalizePropertyRow);
}

/** Exact match on `address_norm`. */
export function findPropertyByAddressNorm(
  db: MlsDatabase,
  addressNorm: string,
): PropertyRow | undefined {
  const row = db
    .prepare(`${SELECT_PROPERTY} WHERE address_norm = @address_norm LIMIT 1`)
    .get({ address_norm: addressNorm }) as PropertyRow | undefined;
  return row ? normalizePropertyRow(row) : undefined;
}

/**
 * Prefix match when the query omits postal code / state (stored norms often
 * include `city zip state`).
 */
export function findPropertyByAddressPrefix(
  db: MlsDatabase,
  addressNorm: string,
): PropertyRow | undefined {
  const row = db
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
  return row ? normalizePropertyRow(row) : undefined;
}

/**
 * Partial match when exact lookup fails (normalized substring on `address_norm`).
 */
export function searchPropertiesByAddress(
  db: MlsDatabase,
  addressNorm: string,
  limit = 10,
): PropertyRow[] {
  const rows = db
    .prepare(
      `${SELECT_PROPERTY}
       WHERE address_norm LIKE '%' || @address_norm || '%'
       ORDER BY address_line
       LIMIT @limit`,
    )
    .all({ address_norm: addressNorm, limit }) as unknown as PropertyRow[];
  return normalizePropertyRows(rows);
}

const MIN_SUGGEST_QUERY_LEN = 2;
const DEFAULT_SUGGEST_LIMIT = 8;

/**
 * Typeahead suggestions from MLS `properties` (prefix on street line and
 * normalized full address; substring fallback on `address_norm`).
 */
export function suggestPropertiesByAddress(
  db: MlsDatabase,
  query: string,
  limit = DEFAULT_SUGGEST_LIMIT,
): PropertyRow[] {
  const trimmed = query.trim();
  const norm = normalizeAddress(trimmed);
  if (!norm || norm.length < MIN_SUGGEST_QUERY_LEN) {
    return [];
  }

  return normalizePropertyRows(
    db
      .prepare(
        `${SELECT_PROPERTY}
       WHERE address_line LIKE @line_prefix
          OR address_norm LIKE @norm_prefix
          OR address_norm LIKE '%' || @norm || '%'
       ORDER BY
         CASE
           WHEN address_line LIKE @line_prefix THEN 0
           WHEN address_norm LIKE @norm_prefix THEN 1
           ELSE 2
         END,
         address_line
       LIMIT @limit`,
      )
      .all({
        line_prefix: `${trimmed}%`,
        norm_prefix: `${norm}%`,
        norm,
        limit,
      }) as unknown as PropertyRow[],
  );
}

/**
 * Match `street city [zip] state` when the user omits zip or uses `city state`
 * while the DB stores `city zip state` (zip between city and state).
 */
export function findPropertyByStreetCityState(
  db: MlsDatabase,
  opts: {
    streetPart: string;
    city: string;
    state?: string | null;
    postalCode?: string | null;
  },
): PropertyRow | undefined {
  const streetCity = `${opts.streetPart} ${opts.city}`.trim();
  let sql = `${SELECT_PROPERTY}
    WHERE address_norm LIKE @street_city || ' %'`;
  const params: Record<string, string> = { street_city: streetCity };

  if (opts.state) {
    sql += ` AND address_norm LIKE '%' || @state`;
    params.state = ` ${opts.state}`;
  }
  if (opts.postalCode) {
    sql += ` AND address_norm LIKE '%' || @postal_code || '%'`;
    params.postal_code = opts.postalCode;
  }

  sql += ` ORDER BY address_line LIMIT 1`;

  const row = db.prepare(sql).get(params) as PropertyRow | undefined;
  return row ? normalizePropertyRow(row) : undefined;
}

export function searchPropertiesByStreetCityState(
  db: MlsDatabase,
  opts: {
    streetPart: string;
    city: string;
    state?: string | null;
    postalCode?: string | null;
  },
  limit = 10,
): PropertyRow[] {
  const streetCity = `${opts.streetPart} ${opts.city}`.trim();
  let sql = `${SELECT_PROPERTY}
    WHERE address_norm LIKE @street_city || ' %'`;
  const params: Record<string, string | number> = {
    street_city: streetCity,
    limit,
  };

  if (opts.state) {
    sql += ` AND address_norm LIKE '%' || @state`;
    params.state = ` ${opts.state}`;
  }
  if (opts.postalCode) {
    sql += ` AND address_norm LIKE '%' || @postal_code || '%'`;
    params.postal_code = opts.postalCode;
  }

  sql += ` ORDER BY address_line LIMIT @limit`;

  return normalizePropertyRows(
    db.prepare(sql).all(params) as unknown as PropertyRow[],
  );
}

export type AddressResolveMatch = "exact" | "prefix" | "partial" | "structured";

export type AddressResolveResult =
  | { status: "found"; match: AddressResolveMatch; property: PropertyRow }
  | { status: "multiple"; addressNorm: string; properties: PropertyRow[] }
  | { status: "not_found"; addressNorm: string };

function uniqueByListingKey(rows: PropertyRow[]): PropertyRow[] {
  const seen = new Set<string>();
  const out: PropertyRow[] = [];
  for (const row of rows) {
    if (seen.has(row.listing_key)) continue;
    seen.add(row.listing_key);
    out.push(row);
  }
  return out;
}

function isAcceptableMatch(
  rawNorm: string,
  property: PropertyRow,
  match: AddressResolveMatch,
): boolean {
  if (match === "exact") return true;
  return addressQueryMatchesProperty(rawNorm, property.address_norm);
}

/**
 * exact norm, prefix, canonical reorder (street city zip state), structured
 * street+city+state (handles zip omitted), then substring search.
 */
export function resolvePropertyByAddress(
  db: MlsDatabase,
  rawAddress: string,
): AddressResolveResult {
  const parsed = parseAddressQuery(rawAddress);
  const addressNorm = parsed.rawNorm;

  if (!addressNorm) {
    return { status: "not_found", addressNorm: "" };
  }

  const exact = findPropertyByAddressNorm(db, addressNorm);
  if (exact) {
    return { status: "found", match: "exact", property: exact };
  }

  const canonical = buildCanonicalAddressNorm(parsed);
  if (canonical && canonical !== addressNorm) {
    const canonicalHit = findPropertyByAddressNorm(db, canonical);
    if (canonicalHit) {
      return { status: "found", match: "exact", property: canonicalHit };
    }
  }

  for (const prefix of buildAddressLookupPrefixes(parsed)) {
    const hit = findPropertyByAddressPrefix(db, prefix);
    if (hit && isAcceptableMatch(addressNorm, hit, "prefix")) {
      return { status: "found", match: "prefix", property: hit };
    }
  }

  if (parsed.city) {
    const structured = findPropertyByStreetCityState(db, {
      streetPart: parsed.streetPart,
      city: parsed.city,
      state: parsed.state,
      postalCode: parsed.postalCode,
    });
    if (
      structured &&
      isAcceptableMatch(addressNorm, structured, "structured")
    ) {
      return { status: "found", match: "structured", property: structured };
    }

    const structuredCandidates = searchPropertiesByStreetCityState(
      db,
      {
        streetPart: parsed.streetPart,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
      },
      10,
    ).filter((row) => isAcceptableMatch(addressNorm, row, "structured"));
    if (structuredCandidates.length === 1) {
      return {
        status: "found",
        match: "structured",
        property: structuredCandidates[0]!,
      };
    }
    if (structuredCandidates.length > 1) {
      return {
        status: "multiple",
        addressNorm,
        properties: structuredCandidates,
      };
    }
  }

  const partialCandidates = uniqueByListingKey([
    ...searchPropertiesByAddress(db, parsed.streetPart, 10),
    ...(parsed.city
      ? searchPropertiesByAddress(db, `${parsed.streetPart} ${parsed.city}`, 10)
      : []),
    ...searchPropertiesByAddress(db, addressNorm, 10),
  ]).filter((row) => isAcceptableMatch(addressNorm, row, "partial"));

  if (partialCandidates.length === 0) {
    return { status: "not_found", addressNorm };
  }

  if (partialCandidates.length === 1) {
    return {
      status: "found",
      match: "partial",
      property: partialCandidates[0]!,
    };
  }

  return {
    status: "multiple",
    addressNorm,
    properties: partialCandidates.slice(0, 10),
  };
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance between two WGS-84 coordinates, in miles. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type PropertyWithDistance = PropertyRow & { distance_miles: number };

/**
 * Properties within `radiusMiles` of a point with at least `minBedrooms` /
 * `minBathrooms`. Uses a bounding-box SQL pre-filter, then Haversine distance in JS.
 */
export function findPropertiesWithinRadius(
  db: MlsDatabase,
  opts: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    minBedrooms: number;
    minBathrooms: number;
    excludeListingKey?: string;
    /** Only include sales with `close_date` on or after this cutoff (YYYY-MM-DD). */
    minCloseDate?: string;
    limit?: number;
  },
): PropertyWithDistance[] {
  const {
    latitude,
    longitude,
    radiusMiles,
    minBedrooms,
    minBathrooms,
    excludeListingKey,
    minCloseDate,
    limit = 50,
  } = opts;

  const latDelta = radiusMiles / 69;
  const lonDelta =
    radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));

  const rows = normalizePropertyRows(
    db
      .prepare(
        `${SELECT_PROPERTY}
       WHERE latitude IS NOT NULL
         AND longitude IS NOT NULL
         AND bedrooms >= @min_bedrooms
         AND bathrooms >= @min_bathrooms
         AND latitude BETWEEN @min_lat AND @max_lat
         AND longitude BETWEEN @min_lon AND @max_lon
         AND (@exclude_listing_key IS NULL OR listing_key != @exclude_listing_key)
         AND (@min_close_date IS NULL OR (close_date IS NOT NULL AND close_date >= @min_close_date))`,
      )
      .all({
        min_bedrooms: minBedrooms,
        min_bathrooms: minBathrooms,
        min_lat: latitude - latDelta,
        max_lat: latitude + latDelta,
        min_lon: longitude - lonDelta,
        max_lon: longitude + lonDelta,
        exclude_listing_key: excludeListingKey ?? null,
        min_close_date: minCloseDate ?? null,
      }) as unknown as PropertyRow[],
  );

  return rows
    .map((row) => ({
      ...row,
      distance_miles: haversineMiles(
        latitude,
        longitude,
        row.latitude!,
        row.longitude!,
      ),
    }))
    .filter((row) => row.distance_miles <= radiusMiles)
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .slice(0, limit);
}
