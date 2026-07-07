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
  fetchTcadAddressLookupOutcome,
  fetchTcadParcelsWithinRadius,
  fetchTcadPropertyByPropId,
} from "../tcad/client";
import type { TcadPropertyDto } from "../tcad/types";

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
  tcad: TcadPropertyDto | null;
  match: UnifiedComparablesResponse["match"];
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

async function tryTcadAddressLookup(
  address: string,
): Promise<TcadPropertyDto | null> {
  try {
    const outcome = await fetchTcadAddressLookupOutcome(address);
    if (outcome.status === "single" && outcome.property) {
      return outcome.property;
    }
  } catch {
    // TCAD situs lookup is optional when MLS already supplies coordinates.
  }
  return null;
}

async function resolveUnifiedSubject(
  input: UnifiedComparablesInput,
): Promise<ResolvedSubject> {
  const address = input.address?.trim() || null;
  const propId = input.propId ?? null;
  const includeTcad = input.includeTcad === true;

  if (!address && propId == null) {
    throw new UnifiedComparablesError(
      "Provide address and/or propId",
      400,
    );
  }

  let mls: PropertyDetailDto | null = null;
  let mlsRow: PropertyRow | null = null;
  let match: UnifiedComparablesResponse["match"] = null;
  let tcad: TcadPropertyDto | null = null;

  if (propId != null) {
    try {
      tcad = await fetchTcadPropertyByPropId(propId);
    } catch {
      if (!address) {
        throw new UnifiedComparablesError(
          "Could not load TCAD property for that propId",
          502,
          { propId },
        );
      }
    }
  }

  if (address) {
    const db = openDefaultMlsDb();
    try {
      const resolved = resolvePropertyByAddress(db, address);
      if (resolved.status === "found") {
        mlsRow = resolved.property;
        mls = toPropertyDetailDto(resolved.property);
        match = resolved.match;
      } else if (resolved.status === "multiple") {
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

    const mlsHasCoords =
      mls?.latitude != null && mls?.longitude != null;
    const needsTcadForCoords = !mlsHasCoords;

    if (!tcad && (needsTcadForCoords || includeTcad)) {
      const tcadHit = await tryTcadAddressLookup(address);
      if (tcadHit) {
        tcad = tcadHit;
        if (!match) match = "tcad";
      }
    }
  } else if (tcad?.situsAddress) {
    const db = openDefaultMlsDb();
    try {
      const resolved = resolvePropertyByAddress(db, tcad.situsAddress);
      if (resolved.status === "found") {
        mlsRow = resolved.property;
        mls = toPropertyDetailDto(resolved.property);
        match = resolved.match;
      }
    } finally {
      db.close();
    }
  }

  const latitude =
    mls?.latitude ?? tcad?.latitude ?? null;
  const longitude =
    mls?.longitude ?? tcad?.longitude ?? null;

  if (latitude == null || longitude == null) {
    throw new UnifiedComparablesError(
      "Subject property has no coordinates for radius search",
      422,
      {
        subject: mls,
        subjectTcad: tcad
          ? {
              propId: tcad.propId,
              situsAddress: tcad.situsAddress,
              latitude: tcad.latitude,
              longitude: tcad.longitude,
            }
          : null,
      },
    );
  }

  return {
    latitude,
    longitude,
    bedrooms: mls?.bedrooms ?? null,
    bathrooms: mls?.bathrooms ?? null,
    mls,
    mlsRow,
    tcad,
    match,
  };
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
  const excludePropId = subject.tcad?.propId ?? undefined;

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

  const closedComps = await enrichMlsCompsWithTcad(
    mapMlsRowsToComps(closedRows, "sale_comp", matchSubject, radiusMiles),
  );
  const openComps = await enrichMlsCompsWithTcad(
    mapMlsRowsToComps(openRows, "listing_comp", matchSubject, radiusMiles),
  );

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
    subjectTcad: subject.tcad
      ? {
          propId: subject.tcad.propId,
          situsAddress: subject.tcad.situsAddress,
          latitude: subject.tcad.latitude,
          longitude: subject.tcad.longitude,
        }
      : null,
    sections: {
      closedSales,
      openListings,
      taxReferences,
    },
    count: comparables.length,
    comparables,
  };
}
