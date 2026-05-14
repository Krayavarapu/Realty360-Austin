/**
 * RESO Property entity — minimal subset of fields actually read by the mappers.
 * Full schema: https://ddwiki.reso.org/display/DDW17/Property+Resource
 */
export interface RESOProperty {
  ListingId: string;
  ListingKey?: string;

  // Address
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  City?: string;
  PostalCity?: string;
  PostalCode?: string;
  StateOrProvince?: string;
  CountyOrParish?: string;
  SubdivisionName?: string;
  MLSAreaMajor?: string;

  // Classification
  PropertyType?: string;
  PropertySubType?: string;
  StandardStatus?: string;
  PropertyCondition?: string[];

  // Physical
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;
  LotSizeAcres?: number;
  LotSizeSquareFeet?: number;
  YearBuilt?: number;

  // Pricing & timeline
  ListPrice?: number;
  OriginalListPrice?: number;
  ClosePrice?: number;
  CloseDate?: string; // YYYY-MM-DD
  ListingContractDate?: string;
  DaysOnMarket?: number;
  CumulativeDaysOnMarket?: number;

  // Amenities
  PoolPrivateYN?: boolean;
  PoolFeatures?: string[];
  GarageSpaces?: number;
  CoveredSpaces?: number;
}

/**
 * Generic OData v4 envelope returned by MLS Grid.
 */
export interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: T[];
}

/**
 * App-level neighborhood aggregate. Shape MUST match the `NEIGHBORHOODS`
 * constant in `client/src/pages/Home.tsx` so the hedonic calculator and the
 * Market Data section can consume the API output unchanged.
 */
export interface Neighborhood {
  id: string;
  label: string;
  basePrice: number;
  pricePerSqft: number;
  trend: number;
  dom: number;
}

/**
 * App-level comparable sale. Shape MUST match the `COMPARABLES` constant in
 * `client/src/pages/Home.tsx`.
 */
export interface Comparable {
  address: string;
  neighborhood: string;
  beds: number;
  baths: number;
  sqft: number;
  soldPrice: number;
  listPrice: number;
  soldDate: string;
  dom: number;
  yearBuilt: number;
  hasPool: boolean;
  hasGarage: boolean;
  condition: string;
}

/**
 * Client-side filters only. MLS Grid v2 replication does not allow these
 * fields in `$filter`; apply after fetching (see `applyPropertyFilter`).
 */
export interface PropertyFilter {
  /** Exact bedroom count, or list of allowed counts. */
  bedrooms?: number | number[];
  /** Minimum total baths (uses `BathroomsTotalInteger` or full+half). */
  minBathrooms?: number;
  /** If non-empty, keep rows whose `City` or `PostalCity` matches (case-insensitive). */
  cities?: string[];
}
