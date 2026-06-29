/** WGS-84 parcel centroid derived from an Esri polygon (rings in [lon, lat] order). */
export interface TcadParcelCentroid {
  latitude: number;
  longitude: number;
}

/**
 * Approximate centroid from the exterior ring of an Esri polygon.
 * Vertex average is sufficient for small parcel footprints.
 */
export function centroidFromEsriPolygon(
  rings: number[][][] | null | undefined,
): TcadParcelCentroid | null {
  const ring = rings?.[0];
  if (!ring || ring.length === 0) return null;

  let sumLon = 0;
  let sumLat = 0;
  for (const point of ring) {
    const lon = point[0];
    const lat = point[1];
    if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue;
    }
    sumLon += lon;
    sumLat += lat;
  }

  if (ring.length === 0) return null;

  return {
    longitude: sumLon / ring.length,
    latitude: sumLat / ring.length,
  };
}
