import { TRAVIS_COUNTY_FLIP_DEAL_CONFIG } from "./config";
import type { FlipDealConfig, RehabScopeTier } from "./types";

export interface RehabCostEstimate {
  tier: RehabScopeTier;
  livingAreaSqft: number;
  costPerSqft: number;
  totalRehab: number;
}

export interface HoldCostEstimate {
  holdMonths: number;
  propertyTax: number;
  insurance: number;
  utilities: number;
  hoa: number;
  totalHold: number;
}

export interface FinancingCostEstimate {
  loanPrincipal: number;
  originationFee: number;
  interestDuringHold: number;
  totalFinancing: number;
}

/** Rehab budget = tier $/sqft × living area. */
export function estimateRehabCost(
  tier: RehabScopeTier,
  livingAreaSqft: number,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): RehabCostEstimate {
  if (livingAreaSqft <= 0) {
    throw new Error("livingAreaSqft must be positive");
  }
  const tierConfig = config.rehabTiers[tier];
  const costPerSqft = tierConfig.costPerSqft;
  return {
    tier,
    livingAreaSqft,
    costPerSqft,
    totalRehab: Math.round(costPerSqft * livingAreaSqft),
  };
}

export function estimateBuyClosingCost(
  purchasePrice: number,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): number {
  if (purchasePrice < 0) {
    throw new Error("purchasePrice must be non-negative");
  }
  return Math.round(purchasePrice * config.closing.buySidePct);
}

export function estimateSellClosingCost(
  arv: number,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): number {
  if (arv < 0) {
    throw new Error("arv must be non-negative");
  }
  return Math.round(arv * config.closing.sellSidePct);
}

export function estimateHoldCost(
  taxBasis: number,
  holdMonths?: number,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): HoldCostEstimate {
  const months = holdMonths ?? config.hold.defaultHoldMonths;
  if (months < 0) {
    throw new Error("holdMonths must be non-negative");
  }
  const { hold } = config;
  const propertyTax = Math.round(
    (taxBasis * hold.propertyTaxRateAnnual * months) / 12,
  );
  const insurance = hold.insurancePerMonth * months;
  const utilities = hold.utilitiesPerMonth * months;
  const hoa = hold.hoaPerMonth * months;
  return {
    holdMonths: months,
    propertyTax,
    insurance,
    utilities,
    hoa,
    totalHold: propertyTax + insurance + utilities + hoa,
  };
}

/**
 * Hard-money style: points on draw + simple interest-only during hold.
 * `projectCost` = purchase + rehab (loan covers `loanToCostRatio` of that).
 */
export function estimateFinancingCost(
  projectCost: number,
  holdMonths?: number,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): FinancingCostEstimate {
  if (projectCost < 0) {
    throw new Error("projectCost must be non-negative");
  }
  const months = holdMonths ?? config.hold.defaultHoldMonths;
  const { financing } = config;
  const loanPrincipal = Math.round(projectCost * financing.loanToCostRatio);
  const originationFee = Math.round(
    loanPrincipal * financing.originationPoints,
  );
  const interestDuringHold = Math.round(
    loanPrincipal * financing.annualInterestRate * (months / 12),
  );
  return {
    loanPrincipal,
    originationFee,
    interestDuringHold,
    totalFinancing: originationFee + interestDuringHold,
  };
}
