import type { CompRecordDto } from "./types";
import {
  isAcceptableTcadAddressScore,
  parseTcadAddressTokens,
  scoreTcadAddressMatch,
  streetNameLikeToken,
} from "../tcad/address-query";
import {
  findCrosswalkLinksByListingKey,
  findCrosswalkLinksByListingKeys,
  isCrosswalkConfigured,
  type MlsTcadCrosswalkLink,
} from "../tcad/crosswalk";
import { findTcadParcelsByPropIds } from "../tcad/db";
import { fetchTcadParcelsForCompEnrichment } from "../tcad/client";
import { pickTaxValue } from "../tcad/tax-value";
import type { TcadPropertyDto } from "../tcad/types";

export { pickTaxValue } from "../tcad/tax-value";

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

export interface TcadEnrichmentContext {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}

interface TcadEnrichmentIndex {
  parcels: TcadPropertyDto[];
  byStreetNumber: Map<string, TcadPropertyDto[]>;
}

function streetNumberFromParcel(parcel: TcadPropertyDto): string | null {
  return parseTcadAddressTokens(parcel.situsAddress ?? "").streetNumber;
}

function buildTcadEnrichmentIndex(
  parcels: TcadPropertyDto[],
): TcadEnrichmentIndex {
  const byStreetNumber = new Map<string, TcadPropertyDto[]>();
  for (const parcel of parcels) {
    const num = streetNumberFromParcel(parcel);
    if (!num) continue;
    const bucket = byStreetNumber.get(num);
    if (bucket) bucket.push(parcel);
    else byStreetNumber.set(num, [parcel]);
  }
  return { parcels, byStreetNumber };
}

function filterStreetLike(
  candidates: TcadPropertyDto[],
  streetLike: string,
): TcadPropertyDto[] {
  const needle = streetLike.toUpperCase();
  return candidates.filter((p) =>
    (p.situsAddress ?? "").toUpperCase().includes(needle),
  );
}

function rankAddressCandidates(
  rawAddress: string,
  candidates: TcadPropertyDto[],
): Array<{ dto: TcadPropertyDto; score: number }> {
  const tokens = parseTcadAddressTokens(rawAddress);
  return candidates
    .map((dto) => ({
      dto,
      score: scoreTcadAddressMatch(rawAddress, dto.situsAddress, tokens.zip),
    }))
    .filter((row) => isAcceptableTcadAddressScore(row.score))
    .sort((a, b) => b.score - a.score);
}

function candidatePool(
  index: TcadEnrichmentIndex,
  streetNumber: string | null,
): TcadPropertyDto[] {
  if (streetNumber) {
    return index.byStreetNumber.get(streetNumber) ?? [];
  }
  return index.parcels;
}

/** Require an acceptable address score and matching situs_num when the MLS comp has one. */
function confirmTcadAddressMatch(
  comp: CompRecordDto,
  tcad: TcadPropertyDto,
): boolean {
  const tokens = parseTcadAddressTokens(comp.address);
  const score = scoreTcadAddressMatch(
    comp.address,
    tcad.situsAddress,
    tokens.zip,
  );
  if (!isAcceptableTcadAddressScore(score)) return false;

  if (tokens.streetNumber) {
    const parcelNumber = streetNumberFromParcel(tcad);
    if (!parcelNumber || parcelNumber !== tokens.streetNumber) return false;
  }

  return true;
}

function matchTcadByAddress(
  comp: CompRecordDto,
  index: TcadEnrichmentIndex,
): TcadPropertyDto | null {
  const tokens = parseTcadAddressTokens(comp.address);
  if (tokens.searchTokens.length === 0) return null;

  const streetLike = streetNameLikeToken(tokens);
  let candidates = candidatePool(index, tokens.streetNumber);

  if (streetLike) candidates = filterStreetLike(candidates, streetLike);
  if (tokens.zip) {
    candidates = candidates.filter((p) => p.zip === tokens.zip);
  }

  let ranked = rankAddressCandidates(comp.address, candidates);

  if (ranked.length === 0 && tokens.streetNumber) {
    if (tokens.zip && streetLike) {
      candidates = filterStreetLike(
        candidatePool(index, tokens.streetNumber),
        streetLike,
      );
    } else if (tokens.zip) {
      candidates = candidatePool(index, tokens.streetNumber);
    } else {
      candidates = [];
    }
    ranked = rankAddressCandidates(comp.address, candidates);
  }

  const best = ranked[0]?.dto ?? null;
  if (!best || !confirmTcadAddressMatch(comp, best)) return null;
  return best;
}

async function loadEnrichmentIndex(
  ctx: TcadEnrichmentContext,
): Promise<TcadEnrichmentIndex> {
  const parcels = await fetchTcadParcelsForCompEnrichment(ctx);
  return buildTcadEnrichmentIndex(parcels);
}

function matchTcadForComp(
  comp: CompRecordDto,
  index: TcadEnrichmentIndex,
  crosswalkParcels: Map<number, TcadPropertyDto>,
  crosswalkLinks: Map<string, MlsTcadCrosswalkLink[]>,
): TcadPropertyDto | null {
  if (comp.listingKey) {
    const links = crosswalkLinks.get(comp.listingKey);
    if (links?.length === 1) {
      const tcad = crosswalkParcels.get(links[0]!.propId);
      if (tcad) return tcad;
    }
  }
  return matchTcadByAddress(comp, index);
}

/**
 * Attach TCAD tax fields to MLS sale/listing comps.
 * Priority: precomputed crosswalk (single link) → situs address match in radius index.
 */
export async function enrichMlsCompsWithTcad(
  comps: CompRecordDto[],
  ctx: TcadEnrichmentContext,
): Promise<CompRecordDto[]> {
  const mlsComps = comps.filter(
    (c) => c.compRole === "sale_comp" || c.compRole === "listing_comp",
  );
  if (mlsComps.length === 0) return comps;

  let index: TcadEnrichmentIndex;
  try {
    index = await loadEnrichmentIndex(ctx);
  } catch {
    return comps;
  }

  if (index.parcels.length === 0) return comps;

  let crosswalkLinks = new Map<string, MlsTcadCrosswalkLink[]>();
  let crosswalkParcels = new Map<number, TcadPropertyDto>();

  if (isCrosswalkConfigured()) {
    const listingKeys = mlsComps
      .map((c) => c.listingKey)
      .filter((k): k is string => Boolean(k));
    try {
      crosswalkLinks = await findCrosswalkLinksByListingKeys(listingKeys);
      const propIds = Array.from(crosswalkLinks.values())
        .filter((links) => links.length === 1)
        .map((links) => links[0]!.propId);
      if (propIds.length > 0) {
        crosswalkParcels = await findTcadParcelsByPropIds(propIds);
      }
    } catch {
      // Crosswalk optional — fall back to address matching only.
    }
  }

  const enrichedByKey = new Map<string, CompRecordDto>();
  for (const comp of mlsComps) {
    const tcad = matchTcadForComp(comp, index, crosswalkParcels, crosswalkLinks);
    if (!tcad) continue;
    const key = comp.listingKey ?? comp.address;
    enrichedByKey.set(key, applyTcadToComp(comp, tcad));
  }

  if (enrichedByKey.size === 0) return comps;

  return comps.map((comp) => {
    const key = comp.listingKey ?? comp.address;
    return enrichedByKey.get(key) ?? comp;
  });
}
