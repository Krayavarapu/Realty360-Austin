import type { RehabScopeTier } from "./types";
import { median, medianRounded } from "./math";

/** Closed sale row used for ARV comp selection. */
export interface ArvCompSale {
  address: string;
  closePrice: number;
  livingAreaSqft: number;
  bedrooms: number;
  bathrooms: number;
  distanceMiles: number;
}

export interface ArvCompFilterRules {
  /** Max deviation from subject sqft (0.25 = ±25%). */
  sqftTolerance: number;
  /** Comp beds may exceed subject by at most this many. */
  maxBedroomDelta: number;
  /** Comp baths may exceed subject by at most this many. */
  maxBathroomDelta: number;
}

export const TRAVIS_COUNTY_ARV_COMP_RULES: ArvCompFilterRules = {
  sqftTolerance: 0.25,
  maxBedroomDelta: 1,
  maxBathroomDelta: 1,
};

/** Minimum physically similar closed sales before tier slicing. */
export const ARV_MIN_SIMILAR_COMPS: Record<RehabScopeTier, number> = {
  cosmetic: 2,
  moderate: 3,
  full: 4,
};

/** Minimum comps required inside a tier slice (top half / quartile). */
export const ARV_MIN_SLICE_COMPS = 3;

export type FlipArvSliceMethod =
  | "all_similar_median"
  | "top_half_median"
  | "top_quartile_median";

export interface FlipArvCompRecord {
  address: string;
  closePrice: number;
  livingAreaSqft: number;
  bedrooms: number;
  bathrooms: number;
  distanceMiles: number;
  pricePerSqft: number;
}

interface ArvSliceStep {
  fraction: number;
  method: FlipArvSliceMethod;
  label: string;
}

const ARV_SLICE_STEPS: Record<RehabScopeTier, ArvSliceStep[]> = {
  cosmetic: [
    {
      fraction: 1,
      method: "all_similar_median",
      label: "median of all similar closed sales",
    },
  ],
  moderate: [
    {
      fraction: 0.5,
      method: "top_half_median",
      label: "median of top 50% by $/sqft",
    },
    {
      fraction: 1,
      method: "all_similar_median",
      label: "median of all similar closed sales",
    },
  ],
  full: [
    {
      fraction: 0.25,
      method: "top_quartile_median",
      label: "median of top 25% by $/sqft",
    },
    {
      fraction: 0.5,
      method: "top_half_median",
      label: "median of top 50% by $/sqft",
    },
    {
      fraction: 1,
      method: "all_similar_median",
      label: "median of all similar closed sales",
    },
  ],
};

export interface ArvCompFilterResult {
  similar: ArvCompSale[];
  radiusCompCount: number;
  rejectedCount: number;
}

export function pricePerSqft(comp: ArvCompSale): number {
  return comp.closePrice / comp.livingAreaSqft;
}

export function isSimilarArvComp(
  comp: ArvCompSale,
  subject: {
    livingAreaSqft: number;
    bedrooms: number;
    bathrooms: number;
  },
  rules: ArvCompFilterRules = TRAVIS_COUNTY_ARV_COMP_RULES,
): boolean {
  const minSqft = subject.livingAreaSqft * (1 - rules.sqftTolerance);
  const maxSqft = subject.livingAreaSqft * (1 + rules.sqftTolerance);

  if (comp.livingAreaSqft < minSqft || comp.livingAreaSqft > maxSqft) {
    return false;
  }
  if (comp.bedrooms < subject.bedrooms) return false;
  if (comp.bedrooms > subject.bedrooms + rules.maxBedroomDelta) return false;
  if (comp.bathrooms < subject.bathrooms) return false;
  if (comp.bathrooms > subject.bathrooms + rules.maxBathroomDelta) return false;
  return true;
}

export function filterArvComps(
  comps: ArvCompSale[],
  subject: {
    livingAreaSqft: number;
    bedrooms: number;
    bathrooms: number;
  },
  rules: ArvCompFilterRules = TRAVIS_COUNTY_ARV_COMP_RULES,
): ArvCompFilterResult {
  const similar = comps.filter((comp) => isSimilarArvComp(comp, subject, rules));
  return {
    similar,
    radiusCompCount: comps.length,
    rejectedCount: comps.length - similar.length,
  };
}

function topFractionByPsf(
  comps: ArvCompSale[],
  fraction: number,
): ArvCompSale[] {
  if (fraction >= 1) return comps;
  const sorted = [...comps].sort(
    (a, b) => pricePerSqft(b) - pricePerSqft(a),
  );
  const count = Math.max(1, Math.ceil(sorted.length * fraction));
  return sorted.slice(0, count);
}

export function toFlipArvCompRecord(comp: ArvCompSale): FlipArvCompRecord {
  return {
    address: comp.address,
    closePrice: comp.closePrice,
    livingAreaSqft: comp.livingAreaSqft,
    bedrooms: comp.bedrooms,
    bathrooms: comp.bathrooms,
    distanceMiles: comp.distanceMiles,
    pricePerSqft: Math.round(pricePerSqft(comp)),
  };
}

export interface ArvSliceSelection {
  slice: ArvCompSale[];
  method: FlipArvSliceMethod;
  sliceFraction: number;
  sliceLabel: string;
  fallbackUsed: boolean;
  warning: string | null;
}

/**
 * Pick closed sales for ARV based on rehab tier.
 * Higher tiers use upper $/sqft percentiles as a renovation-quality proxy.
 */
export function selectArvCompSlice(
  similar: ArvCompSale[],
  scopeTier: RehabScopeTier,
): ArvSliceSelection {
  const steps = ARV_SLICE_STEPS[scopeTier];
  const minSimilar = ARV_MIN_SIMILAR_COMPS[scopeTier];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const slice = topFractionByPsf(similar, step.fraction);
    const minRequired =
      step.fraction < 1 ? ARV_MIN_SLICE_COMPS : minSimilar;

    if (slice.length >= minRequired) {
      return {
        slice,
        method: step.method,
        sliceFraction: step.fraction,
        sliceLabel: step.label,
        fallbackUsed: i > 0,
        warning:
          i > 0
            ? `Target slice had fewer than ${ARV_MIN_SLICE_COMPS} comps; used ${step.label} instead.`
            : null,
      };
    }
  }

  const last = steps[steps.length - 1]!;
  return {
    slice: topFractionByPsf(similar, last.fraction),
    method: last.method,
    sliceFraction: last.fraction,
    sliceLabel: last.label,
    fallbackUsed: steps.length > 1,
    warning:
      similar.length < minSimilar
        ? `Only ${similar.length} similar closed sale${similar.length === 1 ? "" : "s"} available (prefer ${minSimilar}+).`
        : `Could not form a ${ARV_MIN_SLICE_COMPS}+ comp tier slice; used ${last.label}.`,
  };
}

export interface ArvFromCompsResult {
  arv: number;
  medianClosePrice: number;
  medianPricePerSqft: number;
  compCount: number;
  similarCompCount: number;
  radiusCompCount: number;
  rejectedCompCount: number;
  sliceMethod: FlipArvSliceMethod;
  sliceFraction: number;
  sliceLabel: string;
  fallbackUsed: boolean;
  warning: string | null;
  comps: FlipArvCompRecord[];
}

/**
 * ARV = median($/sqft of tier-selected similar closed sales) × subject sqft.
 */
export function arvFromSimilarComps(
  similar: ArvCompSale[],
  subjectSqft: number,
  scopeTier: RehabScopeTier,
  radiusCompCount: number,
  rejectedCompCount: number,
): ArvFromCompsResult | null {
  if (similar.length === 0 || subjectSqft <= 0) return null;

  const selection = selectArvCompSlice(similar, scopeTier);
  const { slice } = selection;

  const psfValues = slice.map(pricePerSqft);
  const medianPsf = median(psfValues);
  if (medianPsf == null) return null;

  const closePrices = slice.map((c) => c.closePrice);
  const medianClose = medianRounded(closePrices);
  if (medianClose == null) return null;

  return {
    arv: Math.round(medianPsf * subjectSqft),
    medianClosePrice: medianClose,
    medianPricePerSqft: Math.round(medianPsf),
    compCount: slice.length,
    similarCompCount: similar.length,
    radiusCompCount,
    rejectedCompCount,
    sliceMethod: selection.method,
    sliceFraction: selection.sliceFraction,
    sliceLabel: selection.sliceLabel,
    fallbackUsed: selection.fallbackUsed,
    warning: selection.warning,
    comps: slice.map(toFlipArvCompRecord),
  };
}
