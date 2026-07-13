import type { TcadParcelCentroid } from "./geometry";
import type { TcadArcGisAttributes, TcadPropertyDto } from "./types";

function formatDeedDate(raw: number | string | null): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function toTcadPropertyDto(
  attrs: TcadArcGisAttributes,
  fetchedAt: string,
  centroid: TcadParcelCentroid | null = null,
  source: TcadPropertyDto["source"] = "tcad-arcgis",
): TcadPropertyDto {
  return {
    propId: attrs.PROP_ID,
    geoId: attrs.geo_id ?? null,
    situsAddress: attrs.situs_address ?? null,
    city: attrs.situs_city ?? null,
    zip: attrs.situs_zip ?? null,
    latitude: centroid?.latitude ?? null,
    longitude: centroid?.longitude ?? null,
    appraisedValue: attrs.appraised_val ?? null,
    marketValue: attrs.market_value ?? null,
    assessedValue: attrs.assessed_val ?? null,
    improvementHomesiteValue: attrs.imprv_homesite_val ?? null,
    landHomesiteValue: attrs.land_homesite_val ?? null,
    tcadAcres: attrs.tcad_acres ?? null,
    gisAcres: attrs.GIS_acres ?? null,
    deedDate: formatDeedDate(attrs.deed_date),
    source,
    fetchedAt,
  };
}
