/** Default MLS Grid originating system (Austin Board of Realtors). */
export const DEFAULT_ORIGINATING_SYSTEM = "actris";

export const DEFAULT_MAX_RECORDS = 2000;
/** Default cap for active/pending open-listing seed (Austin has ~4k+ actives). */
export const DEFAULT_MAX_OPEN_RECORDS = 5000;
export const MAX_AGGREGATE_ROWS = 5000;
export const PAGE_SIZE = 1000;

/** RESO `StandardStatus` values treated as on-market “open” comps. */
export const OPEN_LISTING_STATUSES = ["Active", "Pending"] as const;

/** OData `$filter` fragment: `(StandardStatus eq 'Active' or StandardStatus eq 'Pending')`. */
export function buildOpenListingStatusFilter(): string {
  return OPEN_LISTING_STATUSES.map((s) => `StandardStatus eq '${s}'`).join(
    " or ",
  );
}

/**
 * `$select` for closed-residential replication + SQLite seed.
 * Keep in sync with `RESOProperty` and `toCleanProperty`.
 */
export const CLOSED_RESIDENTIAL_PROPERTY_SELECT = [
  "ListingId",
  "ListingKey",
  "UnparsedAddress",
  "StreetNumber",
  "StreetName",
  "StreetSuffix",
  "City",
  "PostalCode",
  "StateOrProvince",
  "CountyOrParish",
  "Latitude",
  "Longitude",
  "PropertyType",
  "PropertySubType",
  "StandardStatus",
  "PropertyCondition",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "BathroomsFull",
  "BathroomsHalf",
  "LivingArea",
  "YearBuilt",
  "ListPrice",
  "OriginalListPrice",
  "ClosePrice",
  "CloseDate",
  "DaysOnMarket",
  "CumulativeDaysOnMarket",
  "PoolPrivateYN",
  "PoolFeatures",
  "GarageSpaces",
  "CoveredSpaces",
  "LotSizeAcres",
  "LotSizeSquareFeet",
].join(",");
