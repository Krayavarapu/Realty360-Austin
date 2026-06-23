import { formatPropertyAddress, formatSoldDate } from "./format";
import type { PropertyDetailDto, RadiusComparableDto } from "./types";

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
  close_price: number | null;
  close_date: string | null;
  year_built: number | null;
  days_on_market: number | null;
  standard_status: string | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function toPropertyDetailDto(row: PropertyRowLike): PropertyDetailDto {
  const closePrice = row.close_price;
  const sqft = row.living_area_sqft;
  const pricePerSqft =
    closePrice != null && sqft != null && sqft > 0
      ? Math.round(closePrice / sqft)
      : null;

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
    closePrice,
    closeDate: row.close_date,
    soldDate: formatSoldDate(row.close_date),
    yearBuilt: row.year_built,
    daysOnMarket: row.days_on_market,
    standardStatus: row.standard_status,
    propertyType: row.property_type,
    pricePerSqft,
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
