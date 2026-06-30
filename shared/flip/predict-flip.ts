import { minCloseDateForMaxAgeMonths } from "../comparables/recency";
import { formatPropertyAddress } from "../comparables/format";
import {
  fetchPropertyProfile,
  PropertyProfileMlsAmbiguousError,
  PropertyProfileNotFoundError,
} from "../property-profile/fetch-profile";
import type { PropertyProfileDto } from "../property-profile/types";
import {
  findPropertiesWithinRadius,
  openDefaultMlsDb,
} from "../../scripts/mls-db";
import {
  arvFromSimilarComps,
  ARV_MIN_SIMILAR_COMPS,
  filterArvComps,
  TRAVIS_COUNTY_ARV_COMP_RULES,
  type ArvCompSale,
} from "./arv-comps";
import { getFlipDealConfig } from "./config";
import {
  estimateBuyClosingCost,
  estimateFinancingCost,
  estimateHoldCost,
  estimateRehabCost,
  estimateSellClosingCost,
} from "./deal-costs";
import { roundPct } from "./math";
import type {
  FlipArvEstimate,
  FlipPredictionCosts,
  FlipPredictionMargins,
  FlipPredictionRequestResolved,
  FlipPredictionResolvedSubject,
  FlipPredictionResponse,
  FlipViability,
} from "./prediction-types";

export class FlipPredictionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "FlipPredictionError";
  }
}

function classifyViability(netMarginPct: number): FlipViability {
  if (netMarginPct < 0) return "negative";
  if (netMarginPct < 6) return "weak";
  if (netMarginPct < 12) return "marginal";
  return "strong";
}

function taxBasisFromProfile(
  profile: PropertyProfileDto | null,
  purchasePrice: number,
): number {
  const assessed = profile?.tax?.assessedValue;
  if (assessed != null && assessed > 0) return assessed;
  const appraised = profile?.tax?.appraisedValue;
  if (appraised != null && appraised > 0) return appraised;
  return purchasePrice;
}

function subjectFromProfile(
  profile: PropertyProfileDto | null,
  livingAreaSqft: number,
): FlipPredictionResolvedSubject {
  return {
    propId: profile?.identifiers.propId ?? null,
    address: profile?.identifiers.address ?? null,
    livingAreaSqft,
    bedrooms: profile?.physical.bedrooms ?? null,
    bathrooms: profile?.physical.bathrooms ?? null,
  };
}

async function loadEnrichedProfile(
  request: FlipPredictionRequestResolved,
): Promise<PropertyProfileDto> {
  try {
    return await fetchPropertyProfile({
      propId: request.propId ?? null,
      address: request.address ?? null,
    });
  } catch (err) {
    if (err instanceof PropertyProfileNotFoundError) {
      throw new FlipPredictionError(err.message, err.statusCode, {
        query: err.query,
      });
    }
    if (err instanceof PropertyProfileMlsAmbiguousError) {
      throw new FlipPredictionError(err.message, err.statusCode, {
        address: err.address,
        candidates: err.candidates,
      });
    }
    if (err instanceof Error && err.message.includes("Database not found")) {
      throw new FlipPredictionError(err.message, 503);
    }
    throw err;
  }
}

function fetchClosedCompSales(opts: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  minBedrooms: number;
  minBathrooms: number;
  excludeListingKey?: string;
  maxAgeMonths?: number;
}): ArvCompSale[] {
  const minCloseDate =
    opts.maxAgeMonths != null
      ? minCloseDateForMaxAgeMonths(opts.maxAgeMonths)
      : undefined;

  const db = openDefaultMlsDb();
  try {
    const rows = findPropertiesWithinRadius(db, {
      latitude: opts.latitude,
      longitude: opts.longitude,
      radiusMiles: opts.radiusMiles,
      minBedrooms: opts.minBedrooms,
      minBathrooms: opts.minBathrooms,
      excludeListingKey: opts.excludeListingKey,
      minCloseDate,
      limit: 50,
    });

    return rows
      .filter(
        (row) =>
          row.close_price != null &&
          row.close_price > 0 &&
          row.living_area_sqft != null &&
          row.living_area_sqft > 0 &&
          row.bedrooms != null &&
          row.bathrooms != null,
      )
      .map((row) => ({
        address: formatPropertyAddress(row),
        closePrice: row.close_price!,
        livingAreaSqft: row.living_area_sqft!,
        bedrooms: row.bedrooms!,
        bathrooms: row.bathrooms!,
        distanceMiles: row.distance_miles,
      }));
  } finally {
    db.close();
  }
}

async function resolveArv(
  request: FlipPredictionRequestResolved,
  profile: PropertyProfileDto | null,
  subjectSqft: number,
): Promise<FlipArvEstimate> {
  const baseMeta = {
    radiusMiles: request.radiusMiles,
    maxAgeMonths: request.maxAgeMonths ?? null,
  };

  if (request.arv != null) {
    return {
      arv: Math.round(request.arv),
      source: "manual_override",
      compCount: 0,
      similarCompCount: null,
      radiusCompCount: 0,
      rejectedCompCount: 0,
      medianPricePerSqft: null,
      medianClosePrice: null,
      sliceMethod: null,
      sliceFraction: null,
      sliceLabel: null,
      fallbackUsed: false,
      warning: null,
      comps: [],
      ...baseMeta,
    };
  }

  if (request.mode === "manual") {
    throw new FlipPredictionError("arv is required in manual mode", 400);
  }

  const lat = profile?.location.latitude;
  const lon = profile?.location.longitude;
  if (lat == null || lon == null) {
    throw new FlipPredictionError(
      "Subject property has no coordinates for comp-based ARV",
      422,
      { subject: profile?.identifiers ?? null },
    );
  }

  const bedrooms = profile?.physical.bedrooms ?? 0;
  const bathrooms = profile?.physical.bathrooms ?? 0;

  const radiusComps = fetchClosedCompSales({
    latitude: lat,
    longitude: lon,
    radiusMiles: request.radiusMiles,
    minBedrooms: bedrooms,
    minBathrooms: bathrooms,
    excludeListingKey: profile?.identifiers.listingKey ?? undefined,
    maxAgeMonths: request.maxAgeMonths,
  });

  const { similar, radiusCompCount, rejectedCount } = filterArvComps(
    radiusComps,
    {
      livingAreaSqft: subjectSqft,
      bedrooms,
      bathrooms,
    },
  );

  const minComps = ARV_MIN_SIMILAR_COMPS[request.scopeTier];
  if (similar.length < minComps) {
    throw new FlipPredictionError(
      `Need at least ${minComps} similar closed sales for ${request.scopeTier} ARV (found ${similar.length} of ${radiusCompCount} in radius). Widen radius, relax maxAgeMonths, or pass arv.`,
      422,
      {
        ...baseMeta,
        scopeTier: request.scopeTier,
        compCount: similar.length,
        similarCompCount: similar.length,
        radiusCompCount,
        rejectedCompCount: rejectedCount,
        filters: TRAVIS_COUNTY_ARV_COMP_RULES,
        subject: { livingAreaSqft: subjectSqft, bedrooms, bathrooms },
      },
    );
  }

  const derived = arvFromSimilarComps(
    similar,
    subjectSqft,
    request.scopeTier,
    radiusCompCount,
    rejectedCount,
  );
  if (!derived) {
    throw new FlipPredictionError(
      "Could not derive ARV from similar closed sales",
      422,
      { radiusCompCount, compCount: similar.length },
    );
  }

  return {
    arv: derived.arv,
    source: "comp_median_psf",
    compCount: derived.compCount,
    similarCompCount: derived.similarCompCount,
    radiusCompCount: derived.radiusCompCount,
    rejectedCompCount: derived.rejectedCompCount,
    medianPricePerSqft: derived.medianPricePerSqft,
    medianClosePrice: derived.medianClosePrice,
    sliceMethod: derived.sliceMethod,
    sliceFraction: derived.sliceFraction,
    sliceLabel: derived.sliceLabel,
    fallbackUsed: derived.fallbackUsed,
    warning: derived.warning,
    comps: derived.comps,
    ...baseMeta,
  };
}

function buildCostsAndMargins(
  request: FlipPredictionRequestResolved,
  livingAreaSqft: number,
  arv: number,
  taxBasis: number,
): { costs: FlipPredictionCosts; margins: FlipPredictionMargins } {
  const config = getFlipDealConfig(request.market);
  const rehab = estimateRehabCost(request.scopeTier, livingAreaSqft, config);
  const buyClosing = estimateBuyClosingCost(request.purchasePrice, config);
  const hold = estimateHoldCost(taxBasis, request.holdMonths, config);
  const projectCost = request.purchasePrice + rehab.totalRehab;
  const financing = estimateFinancingCost(
    projectCost,
    request.holdMonths,
    config,
  );
  const sellClosing = estimateSellClosingCost(arv, config);
  const totalProjectCost =
    projectCost +
    buyClosing +
    hold.totalHold +
    financing.totalFinancing;
  const netSaleProceeds = arv - sellClosing;
  const grossProfit =
    netSaleProceeds - request.purchasePrice - rehab.totalRehab;
  const netProfit = netSaleProceeds - totalProjectCost;
  const grossMarginPct =
    arv > 0 ? roundPct((grossProfit / arv) * 100) : 0;
  const netMarginPct = arv > 0 ? roundPct((netProfit / arv) * 100) : 0;
  const cashInvested = Math.round(
    projectCost * (1 - config.financing.loanToCostRatio) +
      buyClosing +
      hold.totalHold +
      financing.totalFinancing,
  );
  const roiOnCashPct =
    cashInvested > 0 ? roundPct((netProfit / cashInvested) * 100) : null;

  return {
    costs: {
      purchasePrice: request.purchasePrice,
      rehab,
      buyClosing,
      hold,
      financing,
      sellClosing,
      totalProjectCost,
      netSaleProceeds,
    },
    margins: {
      grossProfit,
      netProfit,
      grossMarginPct,
      netMarginPct,
      cashInvested,
      roiOnCashPct,
    },
  };
}

/**
 * Rules-based flip prediction v0 — ARV from similar closed sales ($/sqft median),
 * rehab from tier × sqft, margins from Travis County deal config.
 */
export async function predictFlip(
  request: FlipPredictionRequestResolved,
): Promise<FlipPredictionResponse> {
  let profile: PropertyProfileDto | null = null;

  if (request.mode === "enriched") {
    profile = await loadEnrichedProfile(request);
  }

  const livingAreaSqft =
    request.livingAreaSqft ?? profile?.physical.livingAreaSqft ?? null;

  if (livingAreaSqft == null || livingAreaSqft <= 0) {
    throw new FlipPredictionError(
      "livingAreaSqft is required (from profile or request override)",
      422,
      { subject: profile?.identifiers ?? null },
    );
  }

  const arvEstimate = await resolveArv(request, profile, livingAreaSqft);
  const taxBasis = taxBasisFromProfile(profile, request.purchasePrice);
  const { costs, margins } = buildCostsAndMargins(
    request,
    livingAreaSqft,
    arvEstimate.arv,
    taxBasis,
  );

  return {
    market: "travis-county",
    scopeTier: request.scopeTier,
    request,
    subject: subjectFromProfile(profile, livingAreaSqft),
    arv: arvEstimate,
    costs,
    margins,
    viability: classifyViability(margins.netMarginPct),
    provenance: {
      computedAt: new Date().toISOString(),
      configMarket: "travis-county",
      mode: request.mode,
    },
  };
}
