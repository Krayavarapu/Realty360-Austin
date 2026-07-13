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
  Latitude?: number;
  Longitude?: number;

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

/** Generic OData v4 envelope returned by MLS Grid. */
export interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: T[];
}
