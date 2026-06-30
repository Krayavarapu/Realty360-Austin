/** Median without rounding (e.g. for $/sqft). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** Median of a non-empty numeric array (rounded to nearest dollar). */
export function medianRounded(values: number[]): number | null {
  const m = median(values);
  return m == null ? null : Math.round(m);
}

export function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}
