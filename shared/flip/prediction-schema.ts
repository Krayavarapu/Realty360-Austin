import { z } from "zod";
import { getFlipDealConfig } from "./config";
import type {
  FlipPredictionMode,
  FlipPredictionRequest,
  FlipPredictionRequestResolved,
} from "./prediction-types";
import type { RehabScopeTier } from "./types";

const REHAB_SCOPE_TIER_VALUES = ["cosmetic", "moderate", "full"] as const;

export const rehabScopeTierSchema = z.enum(REHAB_SCOPE_TIER_VALUES);

export const flipPredictionRequestSchema = z
  .object({
    propId: z.number().int().positive().optional(),
    address: z.string().trim().min(3).optional(),
    purchasePrice: z.number().positive(),
    scopeTier: rehabScopeTierSchema,
    holdMonths: z.number().int().min(0).max(36).optional(),
    livingAreaSqft: z.number().int().positive().optional(),
    arv: z.number().positive().optional(),
    radiusMiles: z.number().positive().max(25).optional(),
    maxAgeMonths: z.number().int().min(1).max(120).optional(),
    market: z.literal("travis-county").optional(),
  })
  .superRefine((data, ctx) => {
    const hasSubjectKey =
      data.propId != null ||
      (data.address != null && data.address.length >= 3);
    const hasManualInputs =
      data.arv != null && data.livingAreaSqft != null;

    if (!hasSubjectKey && !hasManualInputs) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide propId or address (enriched mode), or both arv and livingAreaSqft (manual mode).",
        path: ["propId"],
      });
    }

    if (data.arv != null && data.livingAreaSqft == null && !hasSubjectKey) {
      ctx.addIssue({
        code: "custom",
        message: "livingAreaSqft is required when arv is set without propId or address.",
        path: ["livingAreaSqft"],
      });
    }
  });

export class FlipPredictionValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.core.$ZodIssue[],
  ) {
    super(message);
    this.name = "FlipPredictionValidationError";
  }
}

function inferMode(request: FlipPredictionRequest): FlipPredictionMode {
  const hasSubject =
    request.propId != null ||
    (request.address != null && request.address.trim().length >= 3);
  if (hasSubject) return "enriched";
  return "manual";
}

/** Apply Travis County defaults from deal config. */
export function resolveFlipPredictionRequest(
  request: FlipPredictionRequest,
): FlipPredictionRequestResolved {
  const config = getFlipDealConfig(request.market ?? "travis-county");
  const mode = inferMode(request);

  return {
    ...request,
    address: request.address?.trim() || undefined,
    mode,
    market: "travis-county",
    radiusMiles: request.radiusMiles ?? 2,
    maxAgeMonths: request.maxAgeMonths,
    holdMonths: request.holdMonths ?? config.hold.defaultHoldMonths,
  };
}

export function parseFlipPredictionRequest(
  input: unknown,
): FlipPredictionRequestResolved {
  const result = flipPredictionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new FlipPredictionValidationError(
      "Invalid flip prediction request",
      result.error.issues,
    );
  }
  return resolveFlipPredictionRequest(result.data);
}

export function isRehabScopeTier(value: string): value is RehabScopeTier {
  return rehabScopeTierSchema.safeParse(value).success;
}
