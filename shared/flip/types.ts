/** Rehab scope tier — used by flip prediction request/response (Phase 4.2+). */
export type RehabScopeTier = "cosmetic" | "moderate" | "full";

export interface RehabTierConfig {
  tier: RehabScopeTier;
  /** UI / report label. */
  label: string;
  /** All-in rehab budget per living-area sqft (Travis County defaults). */
  costPerSqft: number;
  shortDescription: string;
}

export interface ClosingCostConfig {
  /** Fraction of purchase price — title, escrow, lender fees (buy side). */
  buySidePct: number;
  /** Fraction of ARV / resale price — agent commissions + sell-side closing. */
  sellSidePct: number;
}

export interface HoldCostConfig {
  /** Typical flip hold period when caller does not specify months. */
  defaultHoldMonths: number;
  /** Annual property tax rate on assessed or purchase value (Travis County ~2.2%). */
  propertyTaxRateAnnual: number;
  insurancePerMonth: number;
  utilitiesPerMonth: number;
  hoaPerMonth: number;
}

export interface FinancingConfig {
  /** Hard-money / bridge annual rate (interest-only MVP). */
  annualInterestRate: number;
  /** Up-front points as fraction of loan principal (e.g. 0.02 = 2 points). */
  originationPoints: number;
  /** Share of purchase + rehab financed (remainder = cash down). */
  loanToCostRatio: number;
}

export interface FlipDealConfig {
  market: "travis-county";
  rehabTiers: Record<RehabScopeTier, RehabTierConfig>;
  closing: ClosingCostConfig;
  hold: HoldCostConfig;
  financing: FinancingConfig;
}
