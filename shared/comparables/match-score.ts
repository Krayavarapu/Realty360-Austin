/**
 * Comparable match scoring and mile-ring bucketing.
 *
 * Match % blends distance (60%), bedroom fit (20%), and bathroom fit (20%).
 * Mile buckets use exclusive rings: (0,0.5], (0.5,1], (1,2], …, (N-1,N].
 */

/** First mile-ring bucket — always listed before whole-mile rings. */
export const HALF_MILE_RING = 0.5;

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

/** Exclusive mile ring: 0.3 → 0.5, 0.85 → 1, 1.62 → 2, 1.0 → 1. */
export function mileRingForDistance(distanceMiles: number): number {
  if (distanceMiles <= HALF_MILE_RING) return HALF_MILE_RING;
  return Math.ceil(distanceMiles);
}

function mileRingBucketIndex(ring: number): number {
  return ring === HALF_MILE_RING ? 0 : ring;
}

export interface MileBucket<T> {
  mile: number;
  label: string;
  properties: T[];
}

export function mileBucketLabel(mile: number): string {
  if (mile === HALF_MILE_RING) return "Within 0.5 miles";
  if (mile === 1) return "Within 1 mile";
  return `Within ${mile} miles`;
}

export function buildEmptyMileBuckets<T>(radiusMiles: number): MileBucket<T>[] {
  const maxMile = Math.max(1, Math.ceil(radiusMiles));
  const buckets: MileBucket<T>[] = [
    {
      mile: HALF_MILE_RING,
      label: mileBucketLabel(HALF_MILE_RING),
      properties: [] as T[],
    },
  ];
  for (let mile = 1; mile <= maxMile; mile++) {
    buckets.push({ mile, label: mileBucketLabel(mile), properties: [] as T[] });
  }
  return buckets;
}

export function bucketByMileRing<T extends { distanceMiles: number }>(
  properties: T[],
  radiusMiles: number,
  sort?: (a: T, b: T) => number,
): MileBucket<T>[] {
  const buckets = buildEmptyMileBuckets<T>(radiusMiles);
  const maxMile = Math.max(1, Math.ceil(radiusMiles));

  for (const property of properties) {
    const ring = mileRingForDistance(property.distanceMiles);
    if (ring !== HALF_MILE_RING && ring > maxMile) continue;
    buckets[mileRingBucketIndex(ring)]!.properties.push(property);
  }

  if (sort) {
    for (const bucket of buckets) {
      bucket.properties.sort(sort);
    }
  }

  return buckets;
}
