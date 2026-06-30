import type { RehabScopeTier } from "./types";
import type {
  FinancingCostEstimate,
  HoldCostEstimate,
  RehabCostEstimate,
} from "./deal-costs";

/** How the engine resolves subject sqft and ARV. */
export type FlipPredictionMode = "enriched" | "manual";

/**
 * Flip prediction input (Phase 4.3 `POST /predict/flip`).
 *
 * **Enriched** — provide `propId` and/or `address`; engine loads profile + comps.
 * **Manual** — provide `arv` + `livingAreaSqft` when no TCAD/MLS subject is needed.
 */
export interface FlipPredictionRequest {
  /** TCAD parcel id (Travis County). */
  propId?: number;
  /** Street address for MLS / TCAD lookup. */
  address?: string;
  /** Acquisition price (required). */
  purchasePrice: number;
  /** Rehab scope tier (required). */
  scopeTier: RehabScopeTier;
  /** Override hold period; defaults from deal config. */
  holdMonths?: number;
  /** Override living area when profile is missing or for manual mode. */
  livingAreaSqft?: number;
  /** Override ARV instead of closed-comp median. */
  arv?: number;
  /** Closed-comp search radius for ARV (enriched mode). */
  radiusMiles?: number;
  /** Closed-comp recency window in months (enriched mode). */
  maxAgeMonths?: number;
  /** Deal config market; only `travis-county` in MVP. */
  market?: "travis-county";
}

/** Normalized request after validation (defaults applied). */
export interface FlipPredictionRequestResolved extends FlipPredictionRequest {
  mode: FlipPredictionMode;
  market: "travis-county";
  radiusMiles: number;
  maxAgeMonths: number | undefined;
  holdMonths: number;
}

export interface FlipPredictionResolvedSubject {
  propId: number | null;
  address: string | null;
  livingAreaSqft: number;
  bedrooms: number | null;
  bathrooms: number | null;
}

export type FlipArvSource = "comp_median" | "manual_override";

export interface FlipArvEstimate {
  arv: number;
  source: FlipArvSource;
  /** Closed sale comps used for median (0 when manual ARV). */
  compCount: number;
  medianClosePrice: number | null;
  radiusMiles: number;
  maxAgeMonths: number | null;
}

export interface FlipPredictionCosts {
  purchasePrice: number;
  rehab: RehabCostEstimate;
  buyClosing: number;
  hold: HoldCostEstimate;
  financing: FinancingCostEstimate;
  sellClosing: number;
  /** Purchase + rehab + buy closing + hold + financing. */
  totalProjectCost: number;
  /** ARV minus sell-side closing. */
  netSaleProceeds: number;
}

export interface FlipPredictionMargins {
  /** Net sale proceeds minus purchase and rehab (before transaction carry). */
  grossProfit: number;
  /** Net sale proceeds minus total project cost. */
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  cashInvested: number | null;
  roiOnCashPct: number | null;
}

/** Rules-engine viability band (Phase 4.3). */
export type FlipViability = "strong" | "marginal" | "weak" | "negative";

export interface FlipPredictionProvenance {
  computedAt: string;
  configMarket: "travis-county";
  mode: FlipPredictionMode;
}

export interface FlipPredictionResponse {
  market: "travis-county";
  scopeTier: RehabScopeTier;
  request: FlipPredictionRequestResolved;
  subject: FlipPredictionResolvedSubject;
  arv: FlipArvEstimate;
  costs: FlipPredictionCosts;
  margins: FlipPredictionMargins;
  viability: FlipViability;
  provenance: FlipPredictionProvenance;
}
