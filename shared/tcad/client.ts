import { TCAD_ARCGIS_QUERY_URL, TCAD_PROPERTY_OUT_FIELDS } from "./constants";
import { toTcadPropertyDto } from "./transform";
import type { TcadArcGisQueryResponse, TcadPropertyDto } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;

export class TcadApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TcadApiError";
  }
}

/**
 * Query the Travis County TCAD ArcGIS layer for a single parcel by `PROP_ID`.
 *
 * Upstream endpoint:
 * {@link TCAD_ARCGIS_QUERY_URL}
 */
export async function fetchTcadPropertyByPropId(
  propId: number,
): Promise<TcadPropertyDto | null> {
  const url = new URL(TCAD_ARCGIS_QUERY_URL);
  url.searchParams.set("where", `PROP_ID=${propId}`);
  url.searchParams.set("outFields", TCAD_PROPERTY_OUT_FIELDS);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new TcadApiError(
        `TCAD ArcGIS request failed (${res.status})`,
        502,
      );
    }

    const body = (await res.json()) as TcadArcGisQueryResponse;

    if (body.error?.message) {
      throw new TcadApiError(
        `TCAD ArcGIS error: ${body.error.message}`,
        502,
      );
    }

    const feature = body.features?.[0];
    if (!feature?.attributes) return null;

    return toTcadPropertyDto(feature.attributes, new Date().toISOString());
  } catch (err) {
    if (err instanceof TcadApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TcadApiError("TCAD ArcGIS request timed out", 504);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new TcadApiError(`TCAD ArcGIS request failed: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}
