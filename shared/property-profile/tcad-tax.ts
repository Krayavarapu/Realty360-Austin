import type { TcadPropertyDto } from "../tcad/types";
import type {
  PropertyProfileTax,
  PropertyProfileTaxCandidate,
} from "./types";

export function tcadPropertyToProfileTax(
  tcad: TcadPropertyDto,
): PropertyProfileTax {
  return {
    appraisedValue: tcad.appraisedValue,
    marketValue: tcad.marketValue,
    assessedValue: tcad.assessedValue,
    improvementHomesiteValue: tcad.improvementHomesiteValue,
    landHomesiteValue: tcad.landHomesiteValue,
    tcadAcres: tcad.tcadAcres,
    gisAcres: tcad.gisAcres,
    deedDate: tcad.deedDate,
  };
}

export function tcadPropertyToTaxCandidate(
  tcad: TcadPropertyDto,
  matchScore: number | null = null,
): PropertyProfileTaxCandidate {
  return {
    propId: tcad.propId,
    geoId: tcad.geoId,
    situsAddress: tcad.situsAddress,
    city: tcad.city,
    zip: tcad.zip,
    latitude: tcad.latitude,
    longitude: tcad.longitude,
    matchScore,
    fetchedAt: tcad.fetchedAt,
    tax: tcadPropertyToProfileTax(tcad),
  };
}
