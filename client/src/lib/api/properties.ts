import type {
  ComparablesByRadiusResponse,
  PropertyDetailDto,
} from "@shared/comparables/types";

export type {
  ComparablesByRadiusResponse,
  PropertyDetailDto,
  RadiusComparableDto,
} from "@shared/comparables/types";

export interface AddressSuggestResponse {
  query: string;
  suggestions: PropertyDetailDto[];
}

export class PropertiesApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "PropertiesApiError";
  }
}

export async function fetchComparablesByRadius(
  address: string,
  radiusMiles: number,
  opts?: { limit?: number },
): Promise<ComparablesByRadiusResponse> {
  const params = new URLSearchParams({
    address: address.trim(),
    radiusMiles: String(radiusMiles),
  });
  if (opts?.limit != null) {
    params.set("limit", String(opts.limit));
  }

  const res = await fetch(`/api/properties/by-radius?${params}`);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : `Request failed (${res.status})`;
    throw new PropertiesApiError(message, res.status, body);
  }

  return body as ComparablesByRadiusResponse;
}

export async function fetchAddressSuggestions(
  query: string,
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<AddressSuggestResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, suggestions: [] };
  }

  const params = new URLSearchParams({ q: trimmed });
  if (opts?.limit != null) {
    params.set("limit", String(opts.limit));
  }

  const res = await fetch(`/api/properties/suggest?${params}`, {
    signal: opts?.signal,
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : `Request failed (${res.status})`;
    throw new PropertiesApiError(message, res.status, body);
  }

  return body as AddressSuggestResponse;
}

/** Returns true when the address resolves to a single MLS property. */
export async function validatePropertyAddress(address: string): Promise<boolean> {
  const trimmed = address.trim();
  if (trimmed.length < 2) return false;

  const res = await fetch(
    `/api/properties/by-address?${new URLSearchParams({ address: trimmed })}`,
  );
  if (res.status === 404) return false;

  const body = await res.json().catch(() => ({}));
  if (res.status === 200) {
    return body?.match !== "multiple" && Boolean(body?.property);
  }
  if (res.status === 409) return false;
  if (!res.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : `Request failed (${res.status})`;
    throw new PropertiesApiError(message, res.status, body);
  }
  return false;
}
