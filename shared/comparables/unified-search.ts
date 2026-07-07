import {
  COMP_SECTION_LABELS,
  mlsRowToCompRecord,
  sortCompRecords,
  tcadToCompRecord,
} from "./comp-record";
import { enrichMlsCompsWithTcad } from "./tcad-enrichment";
import {
  bucketByMileRing,
  computeDistanceScore,
  computeMatchPercent,
} from "./match-score";
import { toPropertyDetailDto } from "./property-dto";
import { minCloseDateForMaxAgeMonths } from "./recency";
import type {
  CompRecordDto,
  PropertyDetailDto,
  UnifiedCompSection,
  UnifiedComparablesResponse,
} from "./types";
import {
  findActiveListingsWithinRadius,
  findPropertiesWithinRadius,
  openDefaultMlsDb,
  resolvePropertyByAddress,
  type PropertyRow,
} from "../../scripts/mls-db";
import {
  fetchPropertyProfileCached,
} from "../property-profile/profile-cache";
import {
  PropertyProfileMlsAmbiguousError,
  PropertyProfileNotFoundError,
} from "../property-profile/fetch-profile";
import type { PropertyProfileDto } from "../property-profile/types";
import { fetchTcadParcelsWithinRadius } from "../tcad/client";

export class UnifiedComparablesError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "UnifiedComparablesError";
  }
}

export interface UnifiedComparablesInput {
  address?: string | null;
  propId?: number | null;
  radiusMiles: number;
  limit?: number;
  maxAgeMonths?: number;
  includeTcad?: boolean;
}

interface ResolvedSubject {
  latitude: number;
  longitude: number;
  bedrooms: number | null;
  bathrooms: number | null;
  mls: PropertyDetailDto | null;
  mlsRow: PropertyRow | null;
  match: UnifiedComparablesResponse["match"];
  profile: PropertyProfileDto;
}

function buildCompSection(
  compRole: CompRecordDto["compRole"],
  comparables: CompRecordDto[],
  radiusMiles: number,
): UnifiedCompSection {
  const meta = COMP_SECTION_LABELS[compRole];
  comparables.sort(sortCompRecords);
  const buckets = bucketByMileRing(comparables, radiusMiles, sortCompRecords).map(
    (bucket) => ({
      mile: bucket.mile,
      label: bucket.label,
      comparables: bucket.properties,
    }),
  );

  return {
    compRole,
    source: meta.source,
    label: meta.label,
    count: comparables.length,
    buckets,
    comparables,
  };
}

function mapMlsRowsToComps(
  rows: Array<PropertyRow & { distance_miles: number }>,
  compRole: Extract<CompRecordDto["compRole"], "sale_comp" | "listing_comp">,
  subject: { bedrooms: number | null; bathrooms: number | null },
  radiusMiles: number,
): CompRecordDto[] {
  const hasBedBath =
    subject.bedrooms != null &&
    subject.bathrooms != null &&
    subject.bedrooms > 0 &&
    subject.bathrooms > 0;

  return rows.map((row) =>
    mlsRowToCompRecord(row, {
      compRole,
      distanceMiles: row.distance_miles,
      matchPercent: hasBedBath
        ? computeMatchPercent(
            {
              bedrooms: subject.bedrooms!,
              bathrooms: subject.bathrooms!,
            },
            {
              bedrooms: row.bedrooms,
              bathrooms: row.bathrooms,
              distanceMiles: row.distance_miles,
            },
            radiusMiles,
          )
        : Math.round(computeDistanceScore(row.distance_miles, radiusMiles)),
    }),
  );
}

async function loadSubjectProfile(
  input: UnifiedComparablesInput,
): Promise<PropertyProfileDto> {
  const address = input.address?.trim() || null;
  const propId = input.propId ?? null;

  if (!address && propId == null) {
    throw new UnifiedComparablesError(
      "Provide address and/or propId",
      400,
    );
  }

  try {
    return await fetchPropertyProfileCached({ address, propId });
  } catch (err) {
    if (err instanceof PropertyProfileNotFoundError) {
      throw new UnifiedComparablesError(err.message, 404, {
        query: err.query,
      });
    }
    if (err instanceof PropertyProfileMlsAmbiguousError) {
      throw new UnifiedComparablesError(err.message, 409, {
        address: err.address,
        properties: err.candidates,
      });
    }
    throw err;
  }
}

function resolveMlsRowForProfile(
  profile: PropertyProfileDto,
): { mlsRow: PropertyRow | null; match: UnifiedComparablesResponse["match"] } {
  const lookupAddress = profile.identifiers.address;
  if (!lookupAddress) {
    return { mlsRow: null, match: profile.identifiers.propId != null ? "tcad" : null };
  }

  const db = openDefaultMlsDb();
  try {
    const resolved = resolvePropertyByAddress(db, lookupAddress);
    if (resolved.status === "found") {
      return { mlsRow: resolved.property, match: resolved.match };
    }
    if (resolved.status === "multiple") {
      throw new UnifiedComparablesError(
        "Multiple MLS properties match that address; refine the query",
        409,
        {
          addressNorm: resolved.addressNorm,
          properties: resolved.properties.map(toPropertyDetailDto),
        },
      );
    }
  } finally {
    db.close();
  }

  return {
    mlsRow: null,
    match: profile.identifiers.propId != null ? "tcad" : null,
  };
}

function buildSubjectFromProfile(
  profile: PropertyProfileDto,
  mlsRow: PropertyRow | null,
  match: UnifiedComparablesResponse["match"],
): ResolvedSubject {
  const latitude = profile.location.latitude;
  const longitude = profile.location.longitude;

  if (latitude == null || longitude == null) {
    throw new UnifiedComparablesError(
      "Subject property has no coordinates for radius search",
      422,
      {
        subject: profile.identifiers,
        subjectTcad: profile.identifiers.propId
          ? {
              propId: profile.identifiers.propId,
              situsAddress: profile.identifiers.addressLine,
              latitude,
              longitude,
            }
          : null,
      },
    );
  }

  return {
    latitude,
    longitude,
    bedrooms: profile.physical.bedrooms,
    bathrooms: profile.physical.bathrooms,
    mls: mlsRow ? toPropertyDetailDto(mlsRow) : null,
    mlsRow,
    match,
    profile,
  };
}

async function resolveUnifiedSubject(
  input: UnifiedComparablesInput,
): Promise<ResolvedSubject> {
  const profile = await loadSubjectProfile(input);
  const { mlsRow, match } = resolveMlsRowForProfile(profile);
  return buildSubjectFromProfile(profile, mlsRow, match);
}

export async function fetchUnifiedComparables(
  input: UnifiedComparablesInput,
): Promise<UnifiedComparablesResponse> {
  const {
    radiusMiles,
    limit = 50,
    maxAgeMonths,
    includeTcad = false,
  } = input;

  const subject = await resolveUnifiedSubject(input);
  const minBedrooms = subject.bedrooms ?? 0;
  const minBathrooms = subject.bathrooms ?? 0;
  const minCloseDate =
    maxAgeMonths != null
      ? minCloseDateForMaxAgeMonths(maxAgeMonths)
      : undefined;

  const excludeListingKey = subject.mlsRow?.listing_key;
  const excludePropId = subject.profile.identifiers.propId ?? undefined;

  const db = openDefaultMlsDb();
  let closedRows: Array<PropertyRow & { distance_miles: number }>;
  let openRows: Array<PropertyRow & { distance_miles: number }>;
  try {
    closedRows = findPropertiesWithinRadius(db, {
      latitude: subject.latitude,
      longitude: subject.longitude,
      radiusMiles,
      minBedrooms,
      minBathrooms,
      excludeListingKey,
      minCloseDate,
      limit,
    });

    openRows = findActiveListingsWithinRadius(db, {
      latitude: subject.latitude,
      longitude: subject.longitude,
      radiusMiles,
      minBedrooms,
      minBathrooms,
      excludeListingKey,
      limit,
    });
  } finally {
    db.close();
  }

  const matchSubject = {
    bedrooms: subject.bedrooms,
    bathrooms: subject.bathrooms,
  };

  const enrichmentCtx = {
    latitude: subject.latitude,
    longitude: subject.longitude,
    radiusMiles,
  };

  const closedRaw = mapMlsRowsToComps(
    closedRows,
    "sale_comp",
    matchSubject,
    radiusMiles,
  );
  const openRaw = mapMlsRowsToComps(
    openRows,
    "listing_comp",
    matchSubject,
    radiusMiles,
  );

  const enriched = await enrichMlsCompsWithTcad(
    [...closedRaw, ...openRaw],
    enrichmentCtx,
  );
  const enrichedByKey = new Map(
    enriched.map((c) => [c.listingKey ?? c.address, c]),
  );
  const pick = (c: CompRecordDto) =>
    enrichedByKey.get(c.listingKey ?? c.address) ?? c;

  const closedComps = closedRaw.map(pick);
  const openComps = openRaw.map(pick);

  const closedSales = buildCompSection("sale_comp", closedComps, radiusMiles);

  const openListings = buildCompSection(
    "listing_comp",
    openComps,
    radiusMiles,
  );

  let taxReferences: UnifiedCompSection | null = null;
  if (includeTcad) {
    try {
      const tcadRows = await fetchTcadParcelsWithinRadius({
        latitude: subject.latitude,
        longitude: subject.longitude,
        radiusMiles,
        excludePropId,
        limit,
      });

      const taxComps = tcadRows.map((row) =>
        tcadToCompRecord(row, {
          distanceMiles: row.distanceMiles,
          matchPercent: Math.round(
            computeDistanceScore(row.distanceMiles, radiusMiles),
          ),
        }),
      );

      taxReferences = buildCompSection("tax_reference", taxComps, radiusMiles);
    } catch {
      taxReferences = buildCompSection("tax_reference", [], radiusMiles);
    }
  }

  const comparables = [
    ...closedSales.comparables,
    ...openListings.comparables,
    ...(taxReferences?.comparables ?? []),
  ].sort(sortCompRecords);

  return {
    match: subject.match,
    radiusMiles,
    filters: {
      minBedrooms: subject.bedrooms,
      minBathrooms: subject.bathrooms,
      ...(maxAgeMonths != null ? { maxAgeMonths, minCloseDate } : {}),
      includeTcad,
    },
    subject: subject.mls,
    subjectTcad: subject.profile.identifiers.propId
      ? {
          propId: subject.profile.identifiers.propId,
          situsAddress:
            subject.profile.identifiers.addressLine ??
            subject.profile.identifiers.address,
          latitude: subject.profile.location.latitude,
          longitude: subject.profile.location.longitude,
        }
      : null,
    subjectProfile: subject.profile,
    sections: {
      closedSales,
      openListings,
      taxReferences,
    },
    count: comparables.length,
    comparables,
  };
}
