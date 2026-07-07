import type { CompRecordDto, UnifiedComparablesResponse } from "@shared/comparables/types";
import type { FlipPredictionResolvedSubject } from "@shared/flip/prediction-types";

/** Property record origin for UI citations. */
export type PropertyDataSource = "mls" | "tcad" | "both";

export function formatPropertyDataSource(source: PropertyDataSource): string {
  switch (source) {
    case "mls":
      return "MLS";
    case "tcad":
      return "TCAD (Travis County Appraisal District)";
    case "both":
      return "MLS + TCAD";
  }
}

export function compRecordDataSource(comp: CompRecordDto): PropertyDataSource {
  if (comp.compRole === "tax_reference") return "tcad";
  if (comp.taxValue != null || comp.propId != null) return "both";
  return "mls";
}

export function unifiedSubjectDataSource(
  result: UnifiedComparablesResponse,
): PropertyDataSource {
  const hasMls = result.subject != null;
  const hasTcad = result.subjectTcad != null;
  if (hasMls && hasTcad) return "both";
  if (hasTcad) return "tcad";
  return "mls";
}

/** Flip subject — TCAD linked when `propId` is present on the composed profile. */
export function flipSubjectDataSource(
  subject: FlipPredictionResolvedSubject,
): PropertyDataSource {
  return subject.propId != null ? "both" : "mls";
}
