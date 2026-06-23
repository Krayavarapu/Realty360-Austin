/**
 * Comparable match scoring and mile-ring bucketing.
 *
 * Match % blends distance (60%), bedroom fit (20%), and bathroom fit (20%).
 * Mile buckets use exclusive rings: (0,1], (1,2], …, (N-1,N].
 */

export interface MatchSubject {
  bedrooms: number;
  bathrooms: number;
}

export interface MatchComparable {
  bedrooms: number | null;
  bathrooms: number | null;
  distanceMiles: number;
}

/** 100 at the subject; 0 at the search-radius edge. */
export function computeDistanceScore(
  distanceMiles: number,
  radiusMiles: number,
): number {
  if (radiusMiles <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - distanceMiles / radiusMiles)));
}

/** 100 when comp matches subject; lower when comp exceeds subject beds/baths. */
export function computeBedBathScore(
  subjectValue: number,
  compValue: number | null,
): number {
  if (compValue == null || compValue <= 0) return 0;
  return Math.min(100, (subjectValue / compValue) * 100);
}

export function computeMatchPercent(
  subject: MatchSubject,
  comp: MatchComparable,
  radiusMiles: number,
): number {
  const distanceScore = computeDistanceScore(comp.distanceMiles, radiusMiles);
  const bedScore = computeBedBathScore(subject.bedrooms, comp.bedrooms);
  const bathScore = computeBedBathScore(subject.bathrooms, comp.bathrooms);
  return Math.round(0.6 * distanceScore + 0.2 * bedScore + 0.2 * bathScore);
}

/** Exclusive mile ring: 0.85 → 1, 1.62 → 2, 1.0 → 1. */
export function mileRingForDistance(distanceMiles: number): number {
  return Math.max(1, Math.ceil(distanceMiles));
}

export interface MileBucket<T> {
  mile: number;
  label: string;
  properties: T[];
}

export function mileBucketLabel(mile: number): string {
  return mile === 1 ? "Within 1 mile" : `Within ${mile} miles`;
}

export function buildEmptyMileBuckets<T>(radiusMiles: number): MileBucket<T>[] {
  const maxMile = Math.max(1, Math.ceil(radiusMiles));
  return Array.from({ length: maxMile }, (_, i) => {
    const mile = i + 1;
    return { mile, label: mileBucketLabel(mile), properties: [] as T[] };
  });
}

export function bucketByMileRing<T extends { distanceMiles: number }>(
  properties: T[],
  radiusMiles: number,
  sort?: (a: T, b: T) => number,
): MileBucket<T>[] {
  const buckets = buildEmptyMileBuckets<T>(radiusMiles);
  const maxMile = buckets.length;

  for (const property of properties) {
    const ring = mileRingForDistance(property.distanceMiles);
    if (ring > maxMile) continue;
    buckets[ring - 1]!.properties.push(property);
  }

  if (sort) {
    for (const bucket of buckets) {
      bucket.properties.sort(sort);
    }
  }

  return buckets;
}
