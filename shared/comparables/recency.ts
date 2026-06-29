/** ISO date (YYYY-MM-DD) for the oldest acceptable `close_date` given a recency window. */
export function minCloseDateForMaxAgeMonths(
  maxAgeMonths: number,
  refDate: Date = new Date(),
): string {
  const cutoff = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate()),
  );
  cutoff.setUTCMonth(cutoff.getUTCMonth() - maxAgeMonths);
  return cutoff.toISOString().slice(0, 10);
}
