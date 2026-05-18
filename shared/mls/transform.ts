import type { RESOProperty } from "./types";

/** Row shape stored in `data/mls.sqlite` (`properties` table). */
export interface CleanProperty {
  listing_key: string;
  listing_id: string;
  address_line: string;
  address_norm: string;
  street_number: string | null;
  street_name: string | null;
  street_suffix: string | null;
  city: string | null;
  postal_code: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  standard_status: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  living_area_sqft: number | null;
  close_price: number | null;
  close_date: string | null;
  year_built: number | null;
  days_on_market: number | null;
}

export function normalizeAddress(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,#]/g, "")
    .trim();
}

export function buildAddressLine(p: RESOProperty): string {
  if (p.UnparsedAddress) {
    return p.UnparsedAddress.replace(/\s+/g, " ").trim();
  }
  return [p.StreetNumber, p.StreetName, p.StreetSuffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function totalBaths(p: RESOProperty): number | null {
  const n =
    p.BathroomsTotalInteger ??
    (p.BathroomsFull ?? 0) + 0.5 * (p.BathroomsHalf ?? 0);
  return n > 0 ? n : null;
}

function formatCloseDate(raw?: string): string | null {
  if (!raw) return null;
  return raw.slice(0, 10);
}

export function isUsableProperty(p: RESOProperty): boolean {
  const key = p.ListingKey ?? p.ListingId;
  if (!key) return false;
  if ((p.ClosePrice ?? 0) <= 0 || (p.LivingArea ?? 0) <= 0) return false;
  return true;
}

export function toCleanProperty(p: RESOProperty): CleanProperty {
  const listingKey = p.ListingKey ?? p.ListingId;
  const addressLine = buildAddressLine(p);
  const city = (p.City ?? p.PostalCity ?? null)?.trim() || null;

  const addressNorm = normalizeAddress(
    [addressLine, city, p.PostalCode, p.StateOrProvince]
      .filter(Boolean)
      .join(" "),
  );

  return {
    listing_key: listingKey,
    listing_id: p.ListingId,
    address_line: addressLine,
    address_norm: addressNorm,
    street_number: p.StreetNumber?.trim() ?? null,
    street_name: p.StreetName?.trim() ?? null,
    street_suffix: p.StreetSuffix?.trim() ?? null,
    city,
    postal_code: p.PostalCode?.trim() ?? null,
    state: p.StateOrProvince?.trim() ?? null,
    latitude: p.Latitude ?? null,
    longitude: p.Longitude ?? null,
    standard_status: p.StandardStatus ?? null,
    property_type: p.PropertyType ?? null,
    bedrooms: p.BedroomsTotal ?? null,
    bathrooms: totalBaths(p),
    living_area_sqft: p.LivingArea ?? null,
    close_price: p.ClosePrice ?? null,
    close_date: formatCloseDate(p.CloseDate),
    year_built: p.YearBuilt ?? null,
    days_on_market: p.DaysOnMarket ?? p.CumulativeDaysOnMarket ?? null,
  };
}
