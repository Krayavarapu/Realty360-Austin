import { haversineMiles } from "./geo";
import type { CompRecordDto } from "./types";
import {
  isAcceptableTcadAddressScore,
  parseTcadAddressTokens,
  scoreTcadAddressMatch,
  streetNameLikeToken,
} from "../tcad/address-query";
import { fetchTcadParcelsForCompEnrichment } from "../tcad/client";
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
  } else if (ranked.length === 0 && streetLike && tokens.zip) {
    candidates = filterStreetLike(index.parcels, streetLike);
    ranked = rankAddressCandidates(comp.address, candidates);
  }

  return ranked[0]?.dto ?? null;
}

function matchTcadByNearest(
  comp: CompRecordDto,
  parcels: TcadPropertyDto[],
): TcadPropertyDto | null {
  const lat = comp.latitude;
  const lon = comp.longitude;
  if (lat == null || lon == null) return null;

  const tokens = parseTcadAddressTokens(comp.address);
  const streetLike = streetNameLikeToken(tokens);

  const nearby = parcels
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      parcel: p,
      dist: haversineMiles(lat, lon, p.latitude!, p.longitude!),
    }))
    .filter((r) => r.dist <= NEAREST_PARCEL_RADIUS_MILES)
    .sort((a, b) => a.dist - b.dist);

  if (nearby.length === 0) return null;

  if (streetLike) {
    const streetMatches = nearby.filter((r) =>
      (r.parcel.situsAddress ?? "").toUpperCase().includes(streetLike),
    );
    if (streetMatches.length > 0) return streetMatches[0]!.parcel;
  }

  return nearby[0]!.parcel;
}

function matchTcadFromIndex(
  comp: CompRecordDto,
  index: TcadEnrichmentIndex,
): TcadPropertyDto | null {
  return (
    matchTcadByAddress(comp, index) ?? matchTcadByNearest(comp, index.parcels)
  );
}

async function loadEnrichmentIndex(
  ctx: TcadEnrichmentContext,
): Promise<TcadEnrichmentIndex> {
  const parcels = await fetchTcadParcelsForCompEnrichment(ctx);
  return buildTcadEnrichmentIndex(parcels);
}

/**
 * Attach TCAD tax fields to MLS sale/listing comps.
 * One TCAD radius prefetch per search, then in-memory address/coordinate matching.
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

  const enrichedByKey = new Map<string, CompRecordDto>();
  for (const comp of mlsComps) {
    const tcad = matchTcadFromIndex(comp, index);
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
