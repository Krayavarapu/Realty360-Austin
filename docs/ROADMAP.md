# Realty360 Austin — Product & Engineering Roadmap

Living document for project phases, implementation status, and key decisions. Update this file as work completes so new agent sessions can pick up without chat history.

**Last updated:** June 2026

---

## Architecture principles

- **MLS and TCAD are separate data sources** — no forced `PROP_ID` ↔ `listing_id` linking in v1.
- **SQLite (`data/mls.sqlite`)** — local MLS closed-residential cache; seed once, not on every build.
- **TCAD** — live ArcGIS lookup via Express; not stored in MLS DB.
- **Flip prediction engine** — rules-based MVP first; Python/ML later behind the same API contract.

---

## Infrastructure & setup (reference)

| Step | Status | Notes |
|------|--------|--------|
| Repo structure (client / server / shared / scripts) | ✅ Complete | Vite + React + Express |
| `pnpm install` / `pnpm dev` / `pnpm dev:api` | ✅ Complete | API on port 3001 in dev |
| `.env.local` with `VITE_MLS_GRID_TOKEN` | ✅ Complete | Required for MLS Grid + seed |
| `pnpm seed:mls` → `data/mls.sqlite` | ✅ Complete | Re-run only to refresh data |
| `pnpm seed:mls:open` → same DB | ✅ Complete | Active/Pending open comps; re-run to refresh on-market listings |
| `pnpm build` + `pnpm start` (prod locally) | ✅ Complete | Single server on port 3000 |
| Vite proxies `/api` → `3001` in dev | ✅ Complete | `vite.config.ts` |

---

## Phase 1 — Strengthen existing pipelines

| Step | Status | Description |
|------|--------|-------------|
| 1.1 Extend MLS seed / SQLite schema | ✅ Complete | Added `list_price`, `has_pool`, `garage_spaces`, `lot_size_acres`, `property_condition`; migrations on DB open; shared condition/pool/garage mappers in `shared/mls/` |
| 1.2 Comparables mile buckets — 0.5 mi ring | ✅ Complete | `shared/comparables/match-score.ts` — exclusive rings: (0, 0.5], (0.5, 1], (1, 2], … |
| 1.3 Comparables UI — extended property fields | ✅ Complete | Detail card: list price, pool, garage, lot, house condition (`ComparableDetailCard.tsx`) |
| 1.4 Comparables UI — condition placement | ✅ Complete | “House Condition” labeled inside card body; match % only in header |
| 1.5 Comp recency filters | ✅ Complete | `maxAgeMonths` on `/api/properties/by-radius`; filters `close_date` in SQLite; UI sale-recency select (6/12/24 mo) |
| 1.6 TCAD ArcGIS — correct layer | ✅ Complete | Use `TCAD/MapServer/0` (not `TCAD_Travis_County_Property/MapServer/3`) |
| 1.7 TCAD API — lookup by `PROP_ID` | ✅ Complete | `GET /api/tcad/property?propId=` |
| 1.8 TCAD — optional `geoId` lookup | ⬜ To do | Alternate key for portal `GEO ID` |
| 1.9 TCAD — expose lat/lon (centroids) | ✅ Complete | WGS-84 parcel centroid from ArcGIS polygon geometry; `latitude`/`longitude` on `TcadPropertyDto` |

---

## Phase 2 — Data contracts

| Step | Status | Description |
|------|--------|-------------|
| 2.1 Source DTOs — MLS | ✅ Complete | `PropertyDetailDto`, `RadiusComparableDto`, `CleanProperty` / SQLite row shape |
| 2.2 Source DTOs — TCAD | ✅ Complete | `TcadPropertyDto` in `shared/tcad/` |
| 2.3 Composed `PropertyProfileDto` | ✅ Complete | `shared/property-profile/` — identifiers, physical, tax, MLS sale, location, completeness, provenance; `composePropertyProfile()` |
| 2.4 Linking strategy (documented) | ✅ Complete | Priority: user `propId` → user `address` → optional crosswalk later; partial profiles OK |
| 2.5 `GET /api/property/profile` | ✅ Complete | TCAD + MLS enrichment; `taxCandidates` when multiple TCAD parcels; `tcadMatch` status |

---

## Phase 3 — Unified comparables

| Step | Status | Description |
|------|--------|-------------|
| 3.1 MLS active / pending pipeline | ✅ Complete | `pnpm seed:mls:open` — Active/Pending into same `properties` table; `findActiveListingsWithinRadius` |
| 3.2 `CompRecordDto` | ✅ Complete | `shared/comparables/comp-record.ts` — `source`, `compRole` (`sale_comp` \| `listing_comp` \| `tax_reference`) |
| 3.3 Unified comparables API | ✅ Complete | `GET /api/comparables/unified` — MLS closed + MLS open + optional TCAD (`includeTcad=true`) |
| 3.4 UI — separate comp sections | ✅ Complete | `UnifiedComparablesResults` — closed / active / tax sections via unified API |
| 3.5 Do not use TCAD appraised value as sale comps | ✅ Complete | Design decision — tax values are reference only |

---

## Phase 4 — Post-flip prediction engine (MVP)

| Step | Status | Description |
|------|--------|-------------|
| 4.1 Rehab / deal config (Travis County) | ✅ Complete | `shared/flip/` — rehab tiers ($/sqft), closing %, hold & financing defaults + cost helpers |
| 4.2 `FlipPredictionRequest` / `FlipPredictionResponse` schema | ✅ Complete | `shared/flip/prediction-types.ts`, `prediction-schema.ts` (Zod + enriched/manual modes) |
| 4.3 `POST /predict/flip` — rules engine v0 | ✅ Complete | `shared/flip/predict-flip.ts`, `POST /api/predict/flip` — comp median ARV + margin math |
| 4.4 Stack decision | ✅ Complete | Python for modeling later; TypeScript/Express for app; optional FastAPI microservice |

---

## Phase 5 — Data platform (optional, later)

| Step | Status | Description |
|------|--------|-------------|
| 5.1 Neon / Postgres for MLS or TCAD cache | ⬜ To do | Seed remote DB once; not per build |
| 5.2 Batch TCAD ETL | ⬜ To do | Pagination into DB if live ArcGIS is too slow |
| 5.3 Deal ledger / training labels | ⬜ To do | Actual purchase, rehab spend, sold price, hold time |
| 5.4 Python ML model | ⬜ To do | Same request/response contract as rules engine |

---

## Key API reference

### Comparables (MLS SQLite)

```bash
curl -G "http://localhost:3001/api/properties/by-radius" \
  --data-urlencode "address=507 Hammack Dr Austin" \
  --data-urlencode "radiusMiles=2" \
  --data-urlencode "maxAgeMonths=12"

curl -G "http://localhost:3001/api/comparables/unified" \
  --data-urlencode "address=507 Hammack Dr Austin" \
  --data-urlencode "radiusMiles=2" \
  --data-urlencode "maxAgeMonths=12" \
  --data-urlencode "includeTcad=true"
```

Related: `/api/properties/suggest`, `/api/properties/by-address`

### Property profile (TCAD + MLS)

```bash
curl -G "http://localhost:3001/api/property/profile" \
  --data-urlencode "propId=751055"

curl -G "http://localhost:3001/api/property/profile" \
  --data-urlencode "address=507 Hammack Dr Austin"
```

### TCAD (ArcGIS proxy)

```bash
curl "http://localhost:3001/api/tcad/property?propId=984219"
```

### Flip prediction (rules engine v0)

```bash
# Enriched — profile + closed-comp median ARV
curl -sS -X POST "http://localhost:3001/api/predict/flip" \
  -H "Content-Type: application/json" \
  -d '{"address":"507 Hammack Dr Austin","purchasePrice":350000,"scopeTier":"moderate","maxAgeMonths":12}'

# Manual — explicit ARV and sqft
curl -sS -X POST "http://localhost:3001/api/predict/flip" \
  -H "Content-Type: application/json" \
  -d '{"purchasePrice":200000,"scopeTier":"cosmetic","arv":320000,"livingAreaSqft":1200}'
```

**Upstream ArcGIS (correct layer):**

```
https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD/MapServer/0/query
```

---

## Dev commands

```bash
pnpm install
pnpm seed:mls          # after .env.local; refreshes closed sales in data/mls.sqlite
pnpm seed:mls:open     # active/pending open listings (same DB)
pnpm dev:api           # Express API :3001
pnpm dev               # Vite UI :3000 (proxies /api)
pnpm build && pnpm start   # production-style :3000
```

---

## Suggested next work (in order)

1. **Phase 5.1** — Neon / Postgres for MLS cache + scheduled open-listing refresh
2. **Flip UI** — wire `POST /api/predict/flip` into calculator or comparables flow

---

## Files touched in completed work (quick index)

| Area | Paths |
|------|--------|
| Mile buckets | `shared/comparables/match-score.ts` |
| Comp recency | `shared/comparables/recency.ts`, `scripts/mls-db.ts`, `server/routes/properties.ts` |
| Unified comps | `shared/comparables/comp-record.ts`, `shared/comparables/unified-search.ts`, `server/routes/comparables.ts` |
| Flip deal config | `shared/flip/types.ts`, `shared/flip/config.ts`, `shared/flip/deal-costs.ts`, `shared/flip/prediction-types.ts`, `shared/flip/prediction-schema.ts`, `shared/flip/predict-flip.ts`, `server/routes/predict.ts` |
| MLS schema / seed | `shared/mls/transform.ts`, `shared/mls/condition.ts`, `scripts/mls-db.ts`, `shared/mls/constants.ts`, `scripts/seed-mls-open.ts` |
| API DTOs | `shared/comparables/types.ts`, `shared/comparables/property-dto.ts`, `shared/comparables/format.ts` |
| Property profile | `shared/property-profile/types.ts`, `shared/property-profile/compose.ts`, `shared/property-profile/fetch-profile.ts`, `server/routes/property-profile.ts` |
| TCAD | `shared/tcad/*`, `server/routes/tcad.ts`, `server/app.ts` |
| TCAD centroids | `shared/tcad/geometry.ts` |
| Comparables UI | `client/src/components/comparables/ComparableDetailCard.tsx`, `CompRecordDetailCard.tsx`, `UnifiedComparablesResults.tsx` |

See also: `LOCAL_DEVELOPMENT.md` for environment and troubleshooting.
