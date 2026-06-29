import { formatPropertyAddress, formatSoldDate } from "./format";
import type { PropertyRowLike } from "./property-dto";
import type { CompRecordDto, CompRole, CompSource } from "./types";
import { formatPropertyConditionLabel } from "../mls/condition";
import type { TcadPropertyDto } from "../tcad/types";

function normalizeHasPool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === 1;
}

function pricePerSqftFrom(
  price: number | null | undefined,
  sqft: number | null | undefined,
): number | null {
  if (price == null || sqft == null || sqft <= 0) return null;
  return Math.round(price / sqft);
}

function formatTcadAddress(tcad: TcadPropertyDto): string {
  const parts = {
    address_line: tcad.situsAddress ?? "Unknown address",
    city: tcad.city,
    state: "TX" as const,
    postal_code: tcad.zip,
  };
  return formatPropertyAddress(parts);
}

export function mlsRowToCompRecord(
  row: PropertyRowLike,
  opts: {
    compRole: Extract<CompRole, "sale_comp" | "listing_comp">;
    distanceMiles: number;
    matchPercent: number | null;
  },
): CompRecordDto {
  const sqft = row.living_area_sqft;
  const garageSpaces = row.garage_spaces ?? null;
  const hasPool = normalizeHasPool(row.has_pool);
  const condition = row.property_condition ?? null;
  const isSale = opts.compRole === "sale_comp";
  const price = isSale ? row.close_price : row.list_price ?? null;

  return {
    source: "mls",
    compRole: opts.compRole,
    listingKey: row.listing_key,
    listingId: row.listing_id,
    propId: null,
    address: formatPropertyAddress(row),
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMiles: Math.round(opts.distanceMiles * 100) / 100,
    matchPercent: opts.matchPercent,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    livingAreaSqft: sqft,
    yearBuilt: row.year_built,
    hasPool,
    hasGarage: garageSpaces != null ? garageSpaces > 0 : null,
    garageSpaces,
    lotSizeAcres: row.lot_size_acres ?? null,
    condition: condition ? formatPropertyConditionLabel(condition) : null,
    propertyType: row.property_type,
    standardStatus: row.standard_status,
    listPrice: row.list_price ?? null,
    closePrice: row.close_price,
    closeDate: row.close_date,
    soldDate: formatSoldDate(row.close_date),
    pricePerSqft: pricePerSqftFrom(price, sqft),
    daysOnMarket: row.days_on_market,
    appraisedValue: null,
    marketValue: null,
    assessedValue: null,
    deedDate: null,
    tcadAcres: null,
  };
}

export function tcadToCompRecord(
  tcad: TcadPropertyDto,
  opts: { distanceMiles: number; matchPercent: number | null },
): CompRecordDto {
  return {
    source: "tcad",
    compRole: "tax_reference",
    listingKey: null,
    listingId: null,
    propId: tcad.propId,
    address: formatTcadAddress(tcad),
    addressLine: tcad.situsAddress,
    city: tcad.city,
    state: "TX",
    postalCode: tcad.zip,
    latitude: tcad.latitude,
    longitude: tcad.longitude,
    distanceMiles: Math.round(opts.distanceMiles * 100) / 100,
    matchPercent: opts.matchPercent,
    bedrooms: null,
    bathrooms: null,
    livingAreaSqft: null,
    yearBuilt: null,
    hasPool: null,
    hasGarage: null,
    garageSpaces: null,
    lotSizeAcres: tcad.gisAcres ?? tcad.tcadAcres,
    condition: null,
    propertyType: null,
    standardStatus: null,
    listPrice: null,
    closePrice: null,
    closeDate: null,
    soldDate: "—",
    pricePerSqft: null,
    daysOnMarket: null,
    appraisedValue: tcad.appraisedValue,
    marketValue: tcad.marketValue,
    assessedValue: tcad.assessedValue,
    deedDate: tcad.deedDate,
    tcadAcres: tcad.tcadAcres ?? tcad.gisAcres,
  };
}

export function sortCompRecords(a: CompRecordDto, b: CompRecordDto): number {
  const aMatch = a.matchPercent ?? -1;
  const bMatch = b.matchPercent ?? -1;
  if (bMatch !== aMatch) return bMatch - aMatch;
  return a.distanceMiles - b.distanceMiles;
}

export const COMP_SECTION_LABELS: Record<
  CompRole,
  { source: CompSource; label: string }
> = {
  sale_comp: { source: "mls", label: "Closed sales (MLS)" },
  listing_comp: { source: "mls", label: "Active listings (MLS)" },
  tax_reference: { source: "tcad", label: "Nearby parcels (tax records)" },
};
