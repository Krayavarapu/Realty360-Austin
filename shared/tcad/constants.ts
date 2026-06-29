/**
 * Travis County TCAD parcel layer — full county parcel inventory (monthly sync).
 *
 * Use this layer for PROP_ID lookups. Do not use `TCAD_Travis_County_Property/MapServer/3`
 * — that is a separate, incomplete subset and many valid PropIDs (e.g. 984219) are absent.
 *
 * @see https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD/MapServer/0
 */
export const TCAD_ARCGIS_QUERY_URL =
  "https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD/MapServer/0/query";

/** WGS-84 output for parcel geometry queries. */
export const TCAD_ARCGIS_WGS84_SR = 4326;

/** Attributes requested from the TCAD layer for property-tax lookups. */
export const TCAD_PROPERTY_OUT_FIELDS = [
  "PROP_ID",
  "geo_id",
  "situs_address",
  "situs_city",
  "situs_zip",
  "appraised_val",
  "market_value",
  "assessed_val",
  "deed_date",
  "imprv_homesite_val",
  "land_homesite_val",
  "tcad_acres",
  "GIS_acres",
].join(",");
