import { toPropertyDetailDto } from "../comparables/property-dto";
import type { PropertyDetailDto } from "../comparables/types";
import {
  openDefaultMlsDb,
  resolvePropertyByAddress,
} from "../../scripts/mls-db";
import {
  fetchTcadAddressLookupOutcome,
  fetchTcadPropertyByPropId,
  TcadApiError,
} from "../tcad/client";
import type { TcadPropertyDto } from "../tcad/types";
import {
  composePropertyProfile,
  createPropertyProfileLookup,
} from "./compose";
import { tcadPropertyToTaxCandidate } from "./tcad-tax";
import type {
  PropertyProfileDto,
  PropertyProfileTaxCandidate,
  PropertyProfileTcadMatch,
} from "./types";

export interface FetchPropertyProfileInput {
  propId?: number | null;
  address?: string | null;
}

export class PropertyProfileNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(
    message: string,
    public readonly query: { propId: number | null; address: string | null },
  ) {
    super(message);
    this.name = "PropertyProfileNotFoundError";
  }
}

export class PropertyProfileMlsAmbiguousError extends Error {
  readonly statusCode = 409;

  constructor(
    message: string,
    public readonly address: string,
    public readonly candidates: PropertyDetailDto[],
  ) {
    super(message);
    this.name = "PropertyProfileMlsAmbiguousError";
  }
}

function resolveMlsByAddress(address: string): PropertyDetailDto | null {
  const db = openDefaultMlsDb();
  try {
    const resolved = resolvePropertyByAddress(db, address);
    if (resolved.status === "found") {
      return toPropertyDetailDto(resolved.property);
    }
    if (resolved.status === "multiple") {
      throw new PropertyProfileMlsAmbiguousError(
        "Multiple MLS properties match that address; refine the query",
        address,
        resolved.properties.map(toPropertyDetailDto),
      );
    }
    return null;
  } finally {
    db.close();
  }
}

function buildTcadMatch(
  status: PropertyProfileTcadMatch["status"],
  message: string | null = null,
): PropertyProfileTcadMatch {
  return { status, message };
}

function tcadCandidatesFromDtos(
  dtos: TcadPropertyDto[],
): PropertyProfileTaxCandidate[] {
  return dtos.map((tcad) => tcadPropertyToTaxCandidate(tcad));
}

/**
 * Enrich a subject from TCAD and/or MLS SQLite.
 *
 * Linking priority: `propId` for TCAD when provided, else `address`.
 * MLS resolves by explicit `address`, or TCAD situs when only `propId` is given.
 * TCAD is always attempted for tax values (assessed/appraised/market), even when
 * MLS already supplies coordinates — location still prefers MLS in compose.
 * Multiple TCAD tax records surface in `taxCandidates` instead of silent null.
 */
export async function fetchPropertyProfile(
  input: FetchPropertyProfileInput,
): Promise<PropertyProfileDto> {
  const propId = input.propId ?? null;
  const address = input.address?.trim() || null;

  if (propId == null && !address) {
    throw new PropertyProfileNotFoundError(
      "Provide propId and/or address",
      { propId: null, address: null },
    );
  }

  const lookupBy = propId != null ? "propId" : "address";

  let mls: PropertyDetailDto | null = null;
  if (address) {
    try {
      mls = resolveMlsByAddress(address);
    } catch (err) {
      if (!(err instanceof PropertyProfileMlsAmbiguousError)) {
        if (!(err instanceof Error && err.message.includes("Database not found"))) {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  let tcad: TcadPropertyDto | null = null;
  let taxCandidates: PropertyProfileTaxCandidate[] | null = null;
  let tcadMatch = buildTcadMatch("none");

  if (propId != null) {
    tcad = await fetchTcadPropertyByPropId(propId);
    tcadMatch = tcad
      ? buildTcadMatch("single")
      : buildTcadMatch("not_found", "No TCAD property found for that propId");
  } else if (address) {
    let tcadQuery = address;
    if (mls?.postalCode && !address.includes(mls.postalCode)) {
      tcadQuery = `${address} ${mls.postalCode}`;
    }

    try {
      const outcome = await fetchTcadAddressLookupOutcome(tcadQuery);
      if (outcome.status === "single" && outcome.property) {
        tcad = outcome.property;
        tcadMatch = buildTcadMatch("single");
      } else if (outcome.status === "ambiguous") {
        taxCandidates = tcadCandidatesFromDtos(outcome.candidates);
        tcadMatch = buildTcadMatch(
          "ambiguous",
          "Multiple TCAD tax records match this address; choose a propId from taxCandidates",
        );
      } else {
        tcadMatch = buildTcadMatch(
          "not_found",
          "No TCAD property found for that address",
        );
      }
    } catch (err) {
      // MLS alone is enough for profile/flip; don't fail the request on ArcGIS errors.
      if (mls && err instanceof TcadApiError) {
        tcadMatch = buildTcadMatch(
          "not_found",
          `TCAD lookup failed: ${err.message}`,
        );
      } else {
        throw err;
      }
    }
  }

  if (!mls && tcad?.situsAddress) {
    try {
      mls = resolveMlsByAddress(tcad.situsAddress);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Database not found")) {
        if (!tcad && !taxCandidates?.length) throw err;
      } else {
        throw err;
      }
    }
  }

  if (!tcad && !mls && !(taxCandidates?.length ?? 0)) {
    throw new PropertyProfileNotFoundError(
      "No TCAD or MLS property found for that query",
      { propId, address },
    );
  }

  return composePropertyProfile({
    lookup: createPropertyProfileLookup(lookupBy, {
      propId: propId ?? tcad?.propId ?? null,
      address: address ?? tcad?.situsAddress ?? mls?.address ?? null,
    }),
    mls,
    tcad,
    taxCandidates,
    tcadMatch,
  });
}
