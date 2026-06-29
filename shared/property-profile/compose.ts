import type { PropertyDetailDto } from "../comparables/types";
import type { TcadPropertyDto } from "../tcad/types";
import type {
  ComposePropertyProfileInput,
  PropertyProfileCompleteness,
  PropertyProfileDto,
  PropertyProfileIdentifiers,
  PropertyProfileLocation,
  PropertyProfileLookup,
  PropertyProfileMlsSale,
  PropertyProfilePhysical,
  PropertyProfileProvenance,
  PropertyProfileSource,
  PropertyProfileTax,
  PropertyProfileTaxCandidate,
  PropertyProfileTcadMatch,
} from "./types";
import { tcadPropertyToProfileTax } from "./tcad-tax";

function firstNonEmptyString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value != null && value.trim() !== "") return value;
  }
  return null;
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

function resolveLocation(
  mls: PropertyDetailDto | null | undefined,
  tcad: TcadPropertyDto | null | undefined,
): PropertyProfileLocation {
  if (mls?.latitude != null && mls.longitude != null) {
    return {
      latitude: mls.latitude,
      longitude: mls.longitude,
      coordinateSource: "mls",
    };
  }
  if (tcad?.latitude != null && tcad.longitude != null) {
    return {
      latitude: tcad.latitude,
      longitude: tcad.longitude,
      coordinateSource: "tcad",
    };
  }
  return { latitude: null, longitude: null, coordinateSource: null };
}

function buildIdentifiers(
  mls: PropertyDetailDto | null | undefined,
  tcad: TcadPropertyDto | null | undefined,
): PropertyProfileIdentifiers {
  return {
    propId: tcad?.propId ?? null,
    geoId: tcad?.geoId ?? null,
    listingKey: mls?.listingKey ?? null,
    listingId: mls?.listingId ?? null,
    address: firstNonEmptyString(mls?.address, tcad?.situsAddress),
    addressLine: firstNonEmptyString(mls?.addressLine, tcad?.situsAddress),
    city: firstNonEmptyString(mls?.city, tcad?.city),
    state: mls?.state ?? null,
    postalCode: firstNonEmptyString(mls?.postalCode, tcad?.zip),
  };
}

function buildPhysical(
  mls: PropertyDetailDto | null | undefined,
  tcad: TcadPropertyDto | null | undefined,
): PropertyProfilePhysical {
  return {
    bedrooms: mls?.bedrooms ?? null,
    bathrooms: mls?.bathrooms ?? null,
    livingAreaSqft: mls?.livingAreaSqft ?? null,
    yearBuilt: mls?.yearBuilt ?? null,
    hasPool: mls?.hasPool ?? null,
    hasGarage: mls?.hasGarage ?? null,
    garageSpaces: mls?.garageSpaces ?? null,
    lotSizeAcres: firstNumber(mls?.lotSizeAcres, tcad?.gisAcres, tcad?.tcadAcres),
    condition: mls?.condition ?? null,
    propertyType: mls?.propertyType ?? null,
  };
}

function buildMlsSale(
  mls: PropertyDetailDto | null | undefined,
): PropertyProfileMlsSale | null {
  if (!mls) return null;
  return {
    listPrice: mls.listPrice,
    closePrice: mls.closePrice,
    closeDate: mls.closeDate,
    soldDate: mls.soldDate || null,
    daysOnMarket: mls.daysOnMarket,
    standardStatus: mls.standardStatus,
    pricePerSqft: mls.pricePerSqft,
  };
}

function buildTax(tcad: TcadPropertyDto | null | undefined): PropertyProfileTax | null {
  if (!tcad) return null;
  return tcadPropertyToProfileTax(tcad);
}

function buildProvenance(
  mls: PropertyDetailDto | null | undefined,
  tcad: TcadPropertyDto | null | undefined,
  taxCandidates: PropertyProfileTaxCandidate[] | null,
  composedAt: string,
): PropertyProfileProvenance {
  const sources: PropertyProfileSource[] = [];
  if (mls) sources.push("mls");
  if (tcad || (taxCandidates?.length ?? 0) > 0) sources.push("tcad");

  return {
    sources,
    mlsListingKey: mls?.listingKey ?? null,
    tcadPropId: tcad?.propId ?? taxCandidates?.[0]?.propId ?? null,
    tcadFetchedAt: tcad?.fetchedAt ?? taxCandidates?.[0]?.fetchedAt ?? null,
    composedAt,
  };
}

function hasIdentifiers(ids: PropertyProfileIdentifiers): boolean {
  return Boolean(
    ids.address &&
      (ids.propId != null || ids.listingKey != null || ids.geoId != null),
  );
}

function hasLocation(location: PropertyProfileLocation): boolean {
  return location.latitude != null && location.longitude != null;
}

function hasPhysical(physical: PropertyProfilePhysical): boolean {
  return (
    physical.bedrooms != null ||
    physical.bathrooms != null ||
    physical.livingAreaSqft != null ||
    physical.yearBuilt != null
  );
}

function hasMlsSale(sale: PropertyProfileMlsSale | null): boolean {
  if (!sale) return false;
  return sale.closePrice != null || sale.listPrice != null || sale.closeDate != null;
}

function hasTax(tax: PropertyProfileTax | null): boolean {
  if (!tax) return false;
  return (
    tax.appraisedValue != null ||
    tax.marketValue != null ||
    tax.assessedValue != null
  );
}

function hasTaxData(
  tax: PropertyProfileTax | null,
  taxCandidates: PropertyProfileTaxCandidate[] | null,
): boolean {
  if (hasTax(tax)) return true;
  return (taxCandidates ?? []).some((candidate) => hasTax(candidate.tax));
}

function buildCompleteness(
  identifiers: PropertyProfileIdentifiers,
  location: PropertyProfileLocation,
  physical: PropertyProfilePhysical,
  mlsSale: PropertyProfileMlsSale | null,
  tax: PropertyProfileTax | null,
  taxCandidates: PropertyProfileTaxCandidate[] | null,
): PropertyProfileCompleteness {
  const sections = {
    identifiers: hasIdentifiers(identifiers),
    location: hasLocation(location),
    physical: hasPhysical(physical),
    mlsSale: hasMlsSale(mlsSale),
    tax: hasTaxData(tax, taxCandidates),
  };

  const present = Object.values(sections).filter(Boolean).length;

  return {
    ...sections,
    score: Math.round((present / 5) * 100),
  };
}

/**
 * Merge MLS and TCAD source DTOs into a unified subject profile.
 * Either or both sources may be omitted — partial profiles are valid.
 */
export function composePropertyProfile(
  input: ComposePropertyProfileInput,
): PropertyProfileDto {
  const mls = input.mls ?? null;
  const tcad = input.tcad ?? null;
  const taxCandidates = input.taxCandidates ?? null;
  const composedAt = input.composedAt ?? new Date().toISOString();
  const tcadMatch: PropertyProfileTcadMatch = input.tcadMatch ?? {
    status: tcad ? "single" : taxCandidates?.length ? "ambiguous" : "none",
    message: null,
  };

  const identifiers = buildIdentifiers(mls, tcad);
  const location = resolveLocation(mls, tcad);
  const physical = buildPhysical(mls, tcad);
  const mlsSale = buildMlsSale(mls);
  const tax = buildTax(tcad);

  return {
    identifiers,
    location,
    physical,
    mlsSale,
    tax,
    taxCandidates,
    tcadMatch,
    completeness: buildCompleteness(
      identifiers,
      location,
      physical,
      mlsSale,
      tax,
      taxCandidates,
    ),
    provenance: buildProvenance(mls, tcad, taxCandidates, composedAt),
    lookup: input.lookup,
  };
}

/** Convenience when only lookup metadata is known upfront. */
export function createPropertyProfileLookup(
  by: PropertyProfileLookup["by"],
  opts: { propId?: number | null; address?: string | null },
): PropertyProfileLookup {
  return {
    by,
    propId: opts.propId ?? null,
    address: opts.address?.trim() || null,
  };
}
