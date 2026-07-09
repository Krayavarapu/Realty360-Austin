import { pickProfileTaxValue } from "../tcad/tax-value";
import type { TcadPropertyDto } from "../tcad/types";
import type {
  PropertyProfileDto,
  PropertyProfileTax,
  PropertyProfileTaxCandidate,
} from "./types";

export { pickProfileTaxValue };

/** Assessed-first basis for annual property tax (hold cost). */
export function taxHoldValueFromProfileTax(tax: PropertyProfileTax): number | null {
  if (tax.assessedValue != null && tax.assessedValue > 0) {
    return tax.assessedValue;
  }
  if (tax.appraisedValue != null && tax.appraisedValue > 0) {
    return tax.appraisedValue;
  }
  if (tax.marketValue != null && tax.marketValue > 0) {
    return tax.marketValue;
  }
  return null;
}

export function sumTaxHoldBasisFromCandidates(
  candidates: PropertyProfileTaxCandidate[],
): number | null {
  let sum = 0;
  let found = false;
  for (const candidate of candidates) {
    const value = taxHoldValueFromProfileTax(candidate.tax);
    if (value != null) {
      sum += value;
      found = true;
    }
  }
  return found ? sum : null;
}

export function sumDisplayTaxValueFromCandidates(
  candidates: PropertyProfileTaxCandidate[],
): number | null {
  let sum = 0;
  let found = false;
  for (const candidate of candidates) {
    const value = pickProfileTaxValue(candidate.tax);
    if (value != null) {
      sum += value;
      found = true;
    }
  }
  return found ? sum : null;
}

/**
 * Policy B — when multiple TCAD parcels match, sum assessed values for hold tax.
 * Falls back to purchase price only when no TCAD tax data exists.
 */
export function taxHoldBasisFromProfile(
  profile: PropertyProfileDto | null,
  purchasePrice: number,
): number {
  if (profile?.tax) {
    const single = taxHoldValueFromProfileTax(profile.tax);
    if (single != null) return single;
  }

  const candidates = profile?.taxCandidates;
  if (candidates?.length) {
    const summed = sumTaxHoldBasisFromCandidates(candidates);
    if (summed != null) return summed;
    return 0;
  }

  return purchasePrice;
}

export function tcadPropertyToProfileTax(
  tcad: TcadPropertyDto,
): PropertyProfileTax {
  return {
    appraisedValue: tcad.appraisedValue,
    marketValue: tcad.marketValue,
    assessedValue: tcad.assessedValue,
    improvementHomesiteValue: tcad.improvementHomesiteValue,
    landHomesiteValue: tcad.landHomesiteValue,
    tcadAcres: tcad.tcadAcres,
    gisAcres: tcad.gisAcres,
    deedDate: tcad.deedDate,
  };
}

export function tcadPropertyToTaxCandidate(
  tcad: TcadPropertyDto,
  matchScore: number | null = null,
): PropertyProfileTaxCandidate {
  return {
    propId: tcad.propId,
    geoId: tcad.geoId,
    situsAddress: tcad.situsAddress,
    city: tcad.city,
    zip: tcad.zip,
    latitude: tcad.latitude,
    longitude: tcad.longitude,
    matchScore,
    fetchedAt: tcad.fetchedAt,
    tax: tcadPropertyToProfileTax(tcad),
  };
}
