import type { RESOProperty } from "./types";

/** ACTRIS / RESO subtypes allowed as sale/listing comps. */
export const SINGLE_FAMILY_SUBTYPE = "Single Family Residence";
export const TOWNHOUSE_SUBTYPE = "Townhouse";

const ALLOWED_COMP_SUBTYPES = new Set(
  [SINGLE_FAMILY_SUBTYPE, TOWNHOUSE_SUBTYPE].map((s) => s.toLowerCase()),
);

/**
 * Address markers that usually indicate condo / apartment / duplex halves.
 * Townhouses often use a unit designator on a single address — those are allowed
 * when PropertySubType is Townhouse.
 */
const MULTI_UNIT_ADDRESS_RE =
  /(?:#|\b(?:unit|apt|apartment|ste|suite)\b)/i;

function resoAddressLine(p: RESOProperty): string {
  if (p.UnparsedAddress) {
    return p.UnparsedAddress.replace(/\s+/g, " ").trim();
  }
  return [p.StreetNumber, p.StreetName, p.StreetSuffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function addressLooksLikeMultiUnit(
  address: string | null | undefined,
): boolean {
  if (!address?.trim()) return false;
  return MULTI_UNIT_ADDRESS_RE.test(address);
}

export function isTownhouseSubtype(
  subtype: string | null | undefined,
): boolean {
  if (!subtype?.trim()) return false;
  return subtype.trim().toLowerCase() === TOWNHOUSE_SUBTYPE.toLowerCase();
}

/** True for Single Family Residence or Townhouse. */
export function isAllowedCompSubtype(
  subtype: string | null | undefined,
): boolean {
  if (!subtype?.trim()) return false;
  return ALLOWED_COMP_SUBTYPES.has(subtype.trim().toLowerCase());
}

/** @deprecated Prefer `isAllowedCompSubtype`. */
export function isSingleFamilySubtype(
  subtype: string | null | undefined,
): boolean {
  return isAllowedCompSubtype(subtype);
}

/**
 * Seed-time gate: single-family or townhouse only.
 * Reject unit-style addresses for SFR (often condo/duplex halves); allow them
 * for townhouses (one address + unit number is normal).
 */
export function isSingleFamilyResidence(p: RESOProperty): boolean {
  const subtype = p.PropertySubType ?? null;
  if (!isAllowedCompSubtype(subtype)) return false;
  if (isTownhouseSubtype(subtype)) return true;
  return !addressLooksLikeMultiUnit(resoAddressLine(p));
}

/**
 * Runtime gate for SQLite rows.
 * - When subtype is present: Single Family Residence or Townhouse only.
 * - Townhouses may have unit designators in the address.
 * - SFR / legacy (null subtype): reject multi-unit address designators.
 */
export function isSingleFamilyPropertyRow(row: {
  property_subtype?: string | null;
  address_line?: string | null;
}): boolean {
  const subtype = row.property_subtype?.trim() || null;
  if (subtype != null) {
    if (!isAllowedCompSubtype(subtype)) return false;
    if (isTownhouseSubtype(subtype)) return true;
  }
  if (addressLooksLikeMultiUnit(row.address_line)) return false;
  return true;
}
