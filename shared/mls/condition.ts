import type { RESOProperty } from "./types";

/**
 * Maps RESO `PropertyCondition` (and age heuristics) to calculator tiers.
 * Returns lowercase labels: poor | fair | good | excellent | luxury
 */
export function derivePropertyCondition(p: RESOProperty): string {
  const conds = p.PropertyCondition ?? [];
  if (conds.some((c) => /new construction/i.test(c))) return "excellent";
  if (conds.some((c) => /updated|remodeled/i.test(c))) return "excellent";
  if (conds.some((c) => /tear[- ]?down|fixer/i.test(c))) return "poor";

  if (p.YearBuilt && p.YearBuilt > 1500) {
    const age = new Date().getUTCFullYear() - p.YearBuilt;
    if (age <= 5) return "excellent";
    if (age <= 25) return "good";
    if (age <= 40) return "fair";
    return "poor";
  }
  return "good";
}

/** Title-case label for display (e.g. comparables cards). */
export function formatPropertyConditionLabel(tier: string): string {
  if (!tier) return "Good";
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}
