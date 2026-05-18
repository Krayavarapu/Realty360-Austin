/** Default MLS Grid originating system (Austin Board of Realtors). */
export const DEFAULT_ORIGINATING_SYSTEM = "actris";

export const DEFAULT_MAX_RECORDS = 2000;
export const MAX_AGGREGATE_ROWS = 5000;
export const PAGE_SIZE = 1000;

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
].join(",");
