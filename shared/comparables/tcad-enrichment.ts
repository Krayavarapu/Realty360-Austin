import type { CompRecordDto } from "./types";
import {
  fetchTcadAddressLookupOutcome,
  fetchTcadParcelsWithinRadius,
} from "../tcad/client";
import type { TcadPropertyDto } from "../tcad/types";

/** Unified tax value — appraised, market, and assessed are equivalent for display. */
export function pickTaxValue(tcad: TcadPropertyDto): number | null {
  return (
    tcad.appraisedValue ?? tcad.marketValue ?? tcad.assessedValue ?? null
  );
}

export function applyTcadToComp(
  comp: CompRecordDto,
  tcad: TcadPropertyDto,
): CompRecordDto {
  const taxValue = pickTaxValue(tcad);
  return {
    ...comp,
    propId: tcad.propId,
    latitude: comp.latitude ?? tcad.latitude,
    longitude: comp.longitude ?? tcad.longitude,
    taxValue,
    tcadAcres: tcad.tcadAcres ?? tcad.gisAcres ?? comp.tcadAcres,
    appraisedValue: tcad.appraisedValue,
    marketValue: tcad.marketValue,
    assessedValue: tcad.assessedValue,
    deedDate: tcad.deedDate ?? comp.deedDate,
  };
}

const NEAREST_PARCEL_RADIUS_MILES = 0.15;

async function lookupTcadForComp(
  comp: CompRecordDto,
): Promise<TcadPropertyDto | null> {
  try {
    const outcome = await fetchTcadAddressLookupOutcome(comp.address);
    if (outcome.status === "single" && outcome.property) {
      return outcome.property;
    }
  } catch {
    // Address match is best-effort; fall back to coordinates when available.
  }

  const lat = comp.latitude;
  const lon = comp.longitude;
  if (lat == null || lon == null) return null;

  try {
    const nearby = await fetchTcadParcelsWithinRadius({
      latitude: lat,
      longitude: lon,
      radiusMiles: NEAREST_PARCEL_RADIUS_MILES,
      limit: 1,
    });
    return nearby[0] ?? null;
  } catch {
    return null;
  }
}

/** Attach TCAD tax fields to MLS sale/listing comps (best-effort per comp). */
export async function enrichMlsCompsWithTcad(
  comps: CompRecordDto[],
): Promise<CompRecordDto[]> {
  const mlsComps = comps.filter(
    (c) => c.compRole === "sale_comp" || c.compRole === "listing_comp",
  );
  if (mlsComps.length === 0) return comps;

  const enrichedByKey = new Map<string, CompRecordDto>();
  await Promise.all(
    mlsComps.map(async (comp) => {
      const tcad = await lookupTcadForComp(comp);
      if (!tcad) return;
      const key = comp.listingKey ?? comp.address;
      enrichedByKey.set(key, applyTcadToComp(comp, tcad));
    }),
  );

  if (enrichedByKey.size === 0) return comps;

  return comps.map((comp) => {
    const key = comp.listingKey ?? comp.address;
    return enrichedByKey.get(key) ?? comp;
  });
}
