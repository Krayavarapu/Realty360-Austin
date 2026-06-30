import type {
  FlipPredictionRequest,
  FlipPredictionResponse,
} from "@shared/flip/prediction-types";

export type { FlipPredictionRequest, FlipPredictionResponse };

export class FlipApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "FlipApiError";
  }
}

export async function predictFlip(
  body: FlipPredictionRequest,
): Promise<FlipPredictionResponse> {
  const res = await fetch("/api/predict/flip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new FlipApiError(message, res.status, data);
  }

  return data as FlipPredictionResponse;
}
