import type { FlipDealConfig, RehabScopeTier } from "./types";

/**
 * Default flip-deal assumptions for Travis County / Austin MSA.
 *
 * Calibrated for rules-engine MVP (Phase 4.3) — tune from actual deal ledgers later.
 */
export const TRAVIS_COUNTY_FLIP_DEAL_CONFIG: FlipDealConfig = {
  market: "travis-county",
  rehabTiers: {
    cosmetic: {
      tier: "cosmetic",
      label: "Cosmetic",
      costPerSqft: 35,
      shortDescription:
        "Paint, flooring, fixtures, landscaping — no structural or layout changes.",
    },
    moderate: {
      tier: "moderate",
      label: "Moderate",
      costPerSqft: 65,
      shortDescription:
        "Kitchen/bath refresh, systems updates, some layout tweaks.",
    },
    full: {
      tier: "full",
      label: "Full gut",
      costPerSqft: 105,
      shortDescription:
        "Down-to-studs rehab, MEP, layout changes, permits likely.",
    },
  },
  closing: {
    buySidePct: 0.025,
    sellSidePct: 0.07,
  },
  hold: {
    defaultHoldMonths: 5,
    propertyTaxRateAnnual: 0.022,
    insurancePerMonth: 175,
    utilitiesPerMonth: 250,
    hoaPerMonth: 0,
  },
  financing: {
    annualInterestRate: 0.11,
    originationPoints: 0.02,
    loanToCostRatio: 0.9,
  },
};

export const REHAB_SCOPE_TIERS: readonly RehabScopeTier[] = [
  "cosmetic",
  "moderate",
  "full",
];

export function getFlipDealConfig(
  market: FlipDealConfig["market"] = "travis-county",
): FlipDealConfig {
  if (market === "travis-county") {
    return TRAVIS_COUNTY_FLIP_DEAL_CONFIG;
  }
  throw new Error(`Unsupported flip deal market: ${market}`);
}

export function getRehabTierConfig(
  tier: RehabScopeTier,
  config: FlipDealConfig = TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
): FlipDealConfig["rehabTiers"][RehabScopeTier] {
  return config.rehabTiers[tier];
}
