/**
 * Flip prediction smoke tests — API integration + optional HTTP E2E.
 *
 * Usage (from repo root):
 *   pnpm smoke:flip              # direct engine + HTTP if API is up
 *   pnpm smoke:flip -- --http-only
 *   pnpm smoke:flip -- --direct-only
 *   FLIP_SMOKE_API_URL=http://127.0.0.1:3001 pnpm smoke:flip
 *
 * HTTP tests require `pnpm dev:api` (or `pnpm start`) on port 3001.
 * Direct tests only need `data/mls.sqlite` (run `pnpm seed:mls` first).
 */
import fs from "node:fs";
import { minCloseDateForMaxAgeMonths } from "../shared/comparables/recency";
import {
  findPropertiesWithinRadius,
  openDefaultMlsDb,
  resolvePropertyByAddress,
  type PropertyRow,
} from "./mls-db";
import { predictFlip, FlipPredictionError } from "../shared/flip/predict-flip";
import { parseFlipPredictionRequest } from "../shared/flip/prediction-schema";
import { resolveMlsDbPath } from "../shared/mls/db-path";
import type { FlipPredictionResponse } from "../shared/flip/prediction-types";

const API_BASE =
  process.env.FLIP_SMOKE_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:3001";

const args = new Set(process.argv.slice(2));
const httpOnly = args.has("--http-only");
const directOnly = args.has("--direct-only");

interface SmokeResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: SmokeResult[] = [];

function pass(name: string, detail?: string): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pickSmokeSubject(): PropertyRow {
  const db = openDefaultMlsDb();
  const minCloseDate = minCloseDateForMaxAgeMonths(12);
  try {
    const candidates = db
      .prepare(
        `SELECT listing_key, listing_id, address_line, address_norm,
                latitude, longitude, bedrooms, bathrooms, living_area_sqft,
                close_price, standard_status
         FROM properties
         WHERE standard_status = 'Closed'
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
           AND living_area_sqft > 0
           AND close_price > 0
           AND bedrooms >= 2
           AND bathrooms >= 1
           AND (close_date IS NULL OR close_date >= @min_close_date)
         ORDER BY close_date DESC
         LIMIT 50`,
      )
      .all({ min_close_date: minCloseDate }) as unknown as PropertyRow[];

    for (const row of candidates) {
      const resolved = resolvePropertyByAddress(db, row.address_line);
      if (resolved.status !== "found") continue;

      const nearby = findPropertiesWithinRadius(db, {
        latitude: row.latitude!,
        longitude: row.longitude!,
        radiusMiles: 2,
        minBedrooms: row.bedrooms ?? 2,
        minBathrooms: row.bathrooms ?? 1,
        excludeListingKey: row.listing_key,
        minCloseDate,
        limit: 50,
      });
      if (nearby.length >= 4) return resolved.property;
    }

    if (candidates[0]) {
      const resolved = resolvePropertyByAddress(db, candidates[0].address_line);
      if (resolved.status === "found") return resolved.property;
    }
    throw new Error(
      "No closed MLS row with enough recent comps within 2 mi (try pnpm seed:mls or relax recency)",
    );
  } finally {
    db.close();
  }
}

function assertEnrichedResponse(
  result: FlipPredictionResponse,
  scopeTier: "cosmetic" | "moderate" | "full",
): void {
  assert(result.provenance.mode === "enriched", "expected enriched mode");
  assert(result.arv.source === "comp_median_psf", "expected comp-based ARV");
  assert(result.arv.arv > 0, "ARV must be positive");
  assert(result.subject.livingAreaSqft > 0, "subject sqft required");
  assert(
    ["strong", "marginal", "weak", "negative"].includes(result.viability),
    "viability band required",
  );
  assert(result.costs.rehab.totalRehab > 0, "rehab cost required");
  assert(result.margins.netMarginPct != null, "net margin required");

  const minComps =
    scopeTier === "cosmetic" ? 2 : scopeTier === "moderate" ? 3 : 4;
  assert(
    result.arv.compCount >= minComps,
    `expected >= ${minComps} comps for ${scopeTier}, got ${result.arv.compCount}`,
  );
}

async function runDirectTests(subject: PropertyRow): Promise<void> {
  console.log("\n[direct] Flip engine (predictFlip + mls.sqlite)\n");

  const address = subject.address_line;
  const purchasePrice = Math.round((subject.close_price ?? 300_000) * 0.85);

  try {
    const result = await predictFlip(
      parseFlipPredictionRequest({
        address,
        purchasePrice,
        scopeTier: "moderate",
        radiusMiles: 2,
        maxAgeMonths: 12,
      }),
    );
    assertEnrichedResponse(result, "moderate");
    pass("enriched happy path", `ARV ${result.arv.arv}, ${result.viability}`);
  } catch (err) {
    fail(
      "enriched happy path",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const result = await predictFlip(
      parseFlipPredictionRequest({
        purchasePrice: 200_000,
        scopeTier: "cosmetic",
        arv: 320_000,
        livingAreaSqft: 1200,
      }),
    );
    assert(result.provenance.mode === "manual", "expected manual mode");
    assert(result.arv.source === "manual_override", "expected manual ARV");
    assert(result.arv.arv === 320_000, "ARV override not applied");
    pass("manual happy path", `net margin ${result.margins.netMarginPct}%`);
  } catch (err) {
    fail("manual happy path", err instanceof Error ? err.message : String(err));
  }

  try {
    await predictFlip(
      parseFlipPredictionRequest({
        address,
        purchasePrice,
        scopeTier: "full",
        radiusMiles: 0.25,
        maxAgeMonths: 6,
      }),
    );
    fail("thin comps 422", "expected FlipPredictionError but request succeeded");
  } catch (err) {
    if (err instanceof FlipPredictionError && err.statusCode === 422) {
      pass("thin comps 422", err.message.slice(0, 80));
    } else {
      fail(
        "thin comps 422",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  try {
    parseFlipPredictionRequest({ purchasePrice: 100_000, scopeTier: "cosmetic" });
    fail("validation error", "expected validation failure for missing subject/ARV");
  } catch (err) {
    if (err instanceof Error && err.name === "FlipPredictionValidationError") {
      pass("validation error", "rejects incomplete request");
    } else {
      fail("validation error", err instanceof Error ? err.message : String(err));
    }
  }

  try {
    await predictFlip(
      parseFlipPredictionRequest({
        address: "999 Nonexistent Fake Street Austin TX",
        purchasePrice: 250_000,
        scopeTier: "moderate",
      }),
    );
    fail("unknown address", "expected not-found error");
  } catch (err) {
    if (err instanceof FlipPredictionError && err.statusCode === 404) {
      pass("unknown address 404", "no MLS/TCAD subject");
    } else {
      fail("unknown address", err instanceof Error ? err.message : String(err));
    }
  }
}

async function apiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postFlip(body: unknown): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const res = await fetch(`${API_BASE}/api/predict/flip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

async function runHttpTests(subject: PropertyRow): Promise<void> {
  console.log(`\n[http] Flip API at ${API_BASE}\n`);

  const address = subject.address_line;
  const purchasePrice = Math.round((subject.close_price ?? 300_000) * 0.85);

  try {
    const res = await fetch(`${API_BASE}/api/properties/suggest?q=${encodeURIComponent(address.slice(0, 8))}`, {
      signal: AbortSignal.timeout(10_000),
    });
    assert(res.ok, `suggest HTTP ${res.status}`);
    const data = (await res.json()) as { suggestions?: unknown[] };
    assert(Array.isArray(data.suggestions), "suggestions array expected");
    pass("MLS suggest endpoint", `${data.suggestions!.length} suggestion(s)`);
  } catch (err) {
    fail("MLS suggest endpoint", err instanceof Error ? err.message : String(err));
  }

  try {
    const { status, data } = await postFlip({
      address,
      purchasePrice,
      scopeTier: "moderate",
      radiusMiles: 2,
      maxAgeMonths: 12,
    });
    assert(status === 200, `expected 200, got ${status}: ${data.error}`);
    assertEnrichedResponse(data as unknown as FlipPredictionResponse, "moderate");
    pass("POST /api/predict/flip enriched", `HTTP ${status}`);
  } catch (err) {
    fail(
      "POST /api/predict/flip enriched",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const { status, data } = await postFlip({
      purchasePrice: 200_000,
      scopeTier: "cosmetic",
      arv: 320_000,
      livingAreaSqft: 1200,
    });
    assert(status === 200, `expected 200, got ${status}: ${data.error}`);
    pass("POST /api/predict/flip manual", `HTTP ${status}`);
  } catch (err) {
    fail(
      "POST /api/predict/flip manual",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const { status } = await postFlip({});
    assert(status === 400, `expected 400, got ${status}`);
    pass("POST /api/predict/flip validation 400");
  } catch (err) {
    fail(
      "POST /api/predict/flip validation 400",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const { status } = await postFlip({
      address,
      purchasePrice,
      scopeTier: "full",
      radiusMiles: 0.25,
      maxAgeMonths: 6,
    });
    assert(status === 422, `expected 422, got ${status}`);
    pass("POST /api/predict/flip thin comps 422");
  } catch (err) {
    fail(
      "POST /api/predict/flip thin comps 422",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function main(): Promise<void> {
  console.log("Flip prediction smoke tests\n");

  const dbPath = resolveMlsDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error(`Missing ${dbPath}. Run: pnpm seed:mls`);
    process.exit(1);
  }
  pass("mls.sqlite present", dbPath);

  let subject: PropertyRow;
  try {
    subject = pickSmokeSubject();
    pass(
      "smoke subject selected",
      `${subject.address_line} (${subject.living_area_sqft} sqft)`,
    );
  } catch (err) {
    fail(
      "smoke subject selected",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!httpOnly) {
    await runDirectTests(subject);
  }

  if (!directOnly) {
    const apiUp = await apiReachable();
    if (apiUp) {
      await runHttpTests(subject);
    } else if (httpOnly) {
      fail(
        "API reachable",
        `No server at ${API_BASE}. Start: pnpm dev:api`,
      );
    } else {
      console.log(
        `\n[http] Skipped — API not reachable at ${API_BASE} (start pnpm dev:api for HTTP E2E)\n`,
      );
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  if (failed.length > 0) {
    console.error("\nFailed:");
    for (const r of failed) {
      console.error(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }

  console.log("\nAll flip smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
