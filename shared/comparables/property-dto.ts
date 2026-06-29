import { formatPropertyAddress, formatSoldDate } from "./format";
import type { PropertyDetailDto, RadiusComparableDto } from "./types";
import { formatPropertyConditionLabel } from "../mls/condition";

/** Minimal row shape from SQLite `properties` used to build API DTOs. */
export interface PropertyRowLike {
  listing_key: string;
  listing_id: string;
  address_line: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  living_area_sqft: number | null;
  list_price?: number | null;
  close_price: number | null;
  close_date: string | null;
  year_built: number | null;
  days_on_market: number | null;
  standard_status: string | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
  has_pool?: boolean | null;
  garage_spaces?: number | null;
  lot_size_acres?: number | null;
  property_condition?: string | null;
}

function normalizeHasPool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === 1;
}

export function toPropertyDetailDto(row: PropertyRowLike): PropertyDetailDto {
  const closePrice = row.close_price;
  const sqft = row.living_area_sqft;
  const pricePerSqft =
    closePrice != null && sqft != null && sqft > 0
      ? Math.round(closePrice / sqft)
      : null;
  const garageSpaces = row.garage_spaces ?? null;
  const hasPool = normalizeHasPool(row.has_pool);
  const condition = row.property_condition ?? null;

  return {
    listingKey: row.listing_key,
    listingId: row.listing_id,
    address: formatPropertyAddress(row),
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    livingAreaSqft: sqft,
    listPrice: row.list_price ?? null,
    closePrice,
    closeDate: row.close_date,
    soldDate: formatSoldDate(row.close_date),
    yearBuilt: row.year_built,
    daysOnMarket: row.days_on_market,
    standardStatus: row.standard_status,
    propertyType: row.property_type,
    pricePerSqft,
    hasPool,
    hasGarage: garageSpaces != null ? garageSpaces > 0 : null,
    garageSpaces,
    lotSizeAcres: row.lot_size_acres ?? null,
    condition: condition ? formatPropertyConditionLabel(condition) : null,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function toRadiusComparableDto(
  row: PropertyRowLike,
  opts: { matchPercent: number; distanceMiles: number },
): RadiusComparableDto {
  return {
    ...toPropertyDetailDto(row),
    matchPercent: opts.matchPercent,
    distanceMiles: Math.round(opts.distanceMiles * 100) / 100,
  };
}
