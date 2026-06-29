/**
 * Unified subject property envelope composed from MLS and/or TCAD source DTOs.
 *
 * Linking strategy (Phase 2.4):
 * - Caller supplies `propId` and/or `address`; no automatic MLS ↔ TCAD crosswalk in v1.
 * - Partial profiles are valid (MLS-only, TCAD-only, or merged).
 * - Location prefers MLS coordinates; falls back to TCAD parcel centroid.
 */

import type { PropertyDetailDto } from "../comparables/types";
import type { TcadPropertyDto } from "../tcad/types";

export type PropertyProfileSource = "mls" | "tcad";

export type PropertyProfileLookupBy = "propId" | "address";

/** How the profile request was keyed (set by the caller / API layer). */
export interface PropertyProfileLookup {
  by: PropertyProfileLookupBy;
  propId: number | null;
  address: string | null;
}

export interface PropertyProfileIdentifiers {
  propId: number | null;
  geoId: string | null;
  listingKey: string | null;
  listingId: string | null;
  address: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface PropertyProfileLocation {
  latitude: number | null;
  longitude: number | null;
  /** Source of coordinates when both lat and lon are present. */
  coordinateSource: PropertyProfileSource | null;
}

export interface PropertyProfilePhysical {
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
}

/** Last closed-sale fields from MLS. Null when no MLS row was supplied. */
export interface PropertyProfileMlsSale {
  listPrice: number | null;
  closePrice: number | null;
  closeDate: string | null;
  soldDate: string | null;
  daysOnMarket: number | null;
  standardStatus: string | null;
  pricePerSqft: number | null;
}

/** Appraisal / parcel fields from TCAD. Null when no TCAD row was supplied. */
export interface PropertyProfileTax {
  appraisedValue: number | null;
  marketValue: number | null;
  assessedValue: number | null;
  improvementHomesiteValue: number | null;
  landHomesiteValue: number | null;
  tcadAcres: number | null;
  gisAcres: number | null;
  deedDate: string | null;
}

/** One TCAD parcel when situs address matches multiple tax records (e.g. duplex). */
export interface PropertyProfileTaxCandidate {
  propId: number;
  geoId: string | null;
  situsAddress: string | null;
  city: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  matchScore: number | null;
  fetchedAt: string;
  tax: PropertyProfileTax;
}

export type PropertyProfileTcadMatchStatus =
  | "none"
  | "single"
  | "ambiguous"
  | "not_found";

export interface PropertyProfileTcadMatch {
  status: PropertyProfileTcadMatchStatus;
  message: string | null;
}

export interface PropertyProfileCompleteness {
  identifiers: boolean;
  location: boolean;
  physical: boolean;
  mlsSale: boolean;
  /** True when `tax` is set or `taxCandidates` has at least one record. */
  tax: boolean;
  /** Share of sections present (0–100). */
  score: number;
}

export interface PropertyProfileProvenance {
  sources: PropertyProfileSource[];
  mlsListingKey: string | null;
  tcadPropId: number | null;
  tcadFetchedAt: string | null;
  composedAt: string;
}

export interface PropertyProfileDto {
  identifiers: PropertyProfileIdentifiers;
  location: PropertyProfileLocation;
  physical: PropertyProfilePhysical;
  mlsSale: PropertyProfileMlsSale | null;
  /** Set when exactly one TCAD parcel matches. */
  tax: PropertyProfileTax | null;
  /** Set when multiple TCAD parcels match the same situs (pick by propId). */
  taxCandidates: PropertyProfileTaxCandidate[] | null;
  tcadMatch: PropertyProfileTcadMatch;
  completeness: PropertyProfileCompleteness;
  provenance: PropertyProfileProvenance;
  lookup: PropertyProfileLookup;
}

export interface ComposePropertyProfileInput {
  lookup: PropertyProfileLookup;
  mls?: PropertyDetailDto | null;
  tcad?: TcadPropertyDto | null;
  taxCandidates?: PropertyProfileTaxCandidate[] | null;
  tcadMatch?: PropertyProfileTcadMatch;
  composedAt?: string;
}
