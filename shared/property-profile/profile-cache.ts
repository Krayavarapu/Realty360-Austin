import { normalizeTcadAddressInput } from "../tcad/address-query";
import type { FetchPropertyProfileInput } from "./fetch-profile";
import { fetchPropertyProfile } from "./fetch-profile";
import type { PropertyProfileDto } from "./types";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  profile: PropertyProfileDto;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function propertyProfileCacheKey(
  input: FetchPropertyProfileInput,
): string | null {
  const propId = input.propId ?? null;
  const address = input.address?.trim()
    ? normalizeTcadAddressInput(input.address)
    : null;

  if (propId != null && address) {
    return `propId:${propId}|address:${address}`;
  }
  if (propId != null) return `propId:${propId}`;
  if (address) return `address:${address}`;
  return null;
}

export function getCachedPropertyProfile(
  key: string,
): PropertyProfileDto | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.profile;
}

export function setCachedPropertyProfile(
  key: string,
  profile: PropertyProfileDto,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  cache.set(key, { profile, expiresAt: Date.now() + ttlMs });
}

/** Clear in-process cache (tests). */
export function clearPropertyProfileCache(): void {
  cache.clear();
}

/**
 * Load subject profile — returns a recent in-process cache hit when the same
 * address/propId was fetched during comparables search.
 */
export async function fetchPropertyProfileCached(
  input: FetchPropertyProfileInput,
): Promise<PropertyProfileDto> {
  const key = propertyProfileCacheKey(input);
  if (key) {
    const hit = getCachedPropertyProfile(key);
    if (hit) return hit;
  }

  const profile = await fetchPropertyProfile(input);
  if (key) setCachedPropertyProfile(key, profile);
  return profile;
}
