/** Raw attribute row from the TCAD ArcGIS feature layer. */
export interface TcadArcGisAttributes {
  PROP_ID: number;
  geo_id: string | null;
  situs_address: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  appraised_val: number | null;
  market_value: number | null;
  assessed_val: number | null;
  deed_date: number | string | null;
  imprv_homesite_val: number | null;
  land_homesite_val: number | null;
  tcad_acres: number | null;
  GIS_acres: number | null;
}

export interface TcadArcGisFeature {
  attributes: TcadArcGisAttributes;
  geometry?: {
    rings?: number[][][];
  };
}

export interface TcadArcGisQueryResponse {
  features?: TcadArcGisFeature[];
  error?: { code?: number; message?: string };
}

/** Normalized TCAD property record returned by our API. */
export interface TcadPropertyDto {
  propId: number;
  geoId: string | null;
  situsAddress: string | null;
  city: string | null;
  zip: string | null;
  /** Parcel centroid (WGS-84). Useful when MLS coordinates are unavailable. */
  latitude: number | null;
  longitude: number | null;
  appraisedValue: number | null;
  marketValue: number | null;
  assessedValue: number | null;
  improvementHomesiteValue: number | null;
  landHomesiteValue: number | null;
  tcadAcres: number | null;
  gisAcres: number | null;
  deedDate: string | null;
  source: "tcad-arcgis";
  fetchedAt: string;
}
