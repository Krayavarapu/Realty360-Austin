/** Full property fields for detail cards and API responses. */
import type { PropertyProfileDto } from "../property-profile/types";

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

/** Data origin for a comparable record. */
export type CompSource = "mls" | "tcad";

/** Role of a comp in analysis — tax values are reference only, not sale comps. */
export type CompRole = "sale_comp" | "listing_comp" | "tax_reference";

/** Normalized comparable across MLS closed, MLS open, and TCAD tax parcels. */
export interface CompRecordDto {
  source: CompSource;
  compRole: CompRole;
  listingKey: string | null;
  listingId: string | null;
  propId: number | null;
  address: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number;
  /** Null for tax references without bed/bath match scoring. */
  matchPercent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  yearBuilt: number | null;
  hasPool: boolean | null;
  hasGarage: boolean | null;
  garageSpaces: number | null;
  lotSizeAcres: number | null;
  condition: string | null;
  propertyType: string | null;
  standardStatus: string | null;
  listPrice: number | null;
  closePrice: number | null;
  closeDate: string | null;
  soldDate: string;
  pricePerSqft: number | null;
  daysOnMarket: number | null;
  /** Unified TCAD tax value (appraised / market / assessed — equivalent for display). */
  taxValue: number | null;
  appraisedValue: number | null;
  marketValue: number | null;
  assessedValue: number | null;
  deedDate: string | null;
  tcadAcres: number | null;
}

export interface CompRecordBucket {
  mile: number;
  label: string;
  comparables: CompRecordDto[];
}

export interface UnifiedCompSection {
  compRole: CompRole;
  source: CompSource;
  label: string;
  count: number;
  buckets: CompRecordBucket[];
  comparables: CompRecordDto[];
}

export interface UnifiedComparablesResponse {
  match: "exact" | "prefix" | "partial" | "structured" | "tcad" | null;
  radiusMiles: number;
  filters: {
    minBedrooms: number | null;
    minBathrooms: number | null;
    maxAgeMonths?: number;
    minCloseDate?: string;
    includeTcad: boolean;
  };
  subject: PropertyDetailDto | null;
  subjectTcad: {
    propId: number;
    situsAddress: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  /** Cached MLS + TCAD profile for flip analysis and other downstream use. */
  subjectProfile: PropertyProfileDto;
  sections: {
    closedSales: UnifiedCompSection;
    openListings: UnifiedCompSection;
    taxReferences: UnifiedCompSection | null;
  };
  count: number;
  comparables: CompRecordDto[];
}

