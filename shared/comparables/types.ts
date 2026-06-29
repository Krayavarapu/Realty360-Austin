/** Full property fields for detail cards and API responses. */
export interface PropertyDetailDto {
  listingKey: string;
  listingId: string;
  address: string;
  addressLine: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  listPrice: number | null;
  closePrice: number | null;
  closeDate: string | null;
  soldDate: string;
  yearBuilt: number | null;
  daysOnMarket: number | null;
  standardStatus: string | null;
  propertyType: string | null;
  pricePerSqft: number | null;
  hasPool: boolean | null;
  hasGarage: boolean | null;
  garageSpaces: number | null;
  lotSizeAcres: number | null;
  condition: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RadiusComparableDto extends PropertyDetailDto {
  matchPercent: number;
  distanceMiles: number;
}

export interface MileComparableBucket {
  mile: number;
  label: string;
  properties: RadiusComparableDto[];
}

export interface ComparablesByRadiusResponse {
  match: "exact" | "prefix" | "partial";
  radiusMiles: number;
  filters: {
    minBedrooms: number;
    minBathrooms: number;
  };
  subject: PropertyDetailDto;
  count: number;
  buckets: MileComparableBucket[];
  /** Flat list sorted by match % then distance (debug / legacy consumers). */
  properties: RadiusComparableDto[];
}
