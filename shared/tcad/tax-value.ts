import type { TcadPropertyDto } from "./types";
import type { PropertyProfileTax } from "../property-profile/types";

export interface TaxValueFields {
  appraisedValue?: number | null;
  marketValue?: number | null;
  assessedValue?: number | null;
}

/** Unified tax value for display — appraised, market, and assessed are equivalent. */
export function pickTaxValueFields(fields: TaxValueFields): number | null {
  return (
    fields.appraisedValue ?? fields.marketValue ?? fields.assessedValue ?? null
  );
}

export function pickTaxValue(tcad: TcadPropertyDto): number | null {
  return pickTaxValueFields(tcad);
}

export function pickProfileTaxValue(tax: PropertyProfileTax): number | null {
  return pickTaxValueFields(tax);
}
