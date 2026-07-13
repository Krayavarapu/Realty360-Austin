# Realty360 Austin — Product & Engineering Roadmap

Living document for project phases, implementation status, and key decisions. Update this file as work completes so new agent sessions can pick up without chat history.

**Last updated:** July 13, 2026

---

## Architecture principles

- **MLS and TCAD are separate upstream sources** — linked at runtime via precomputed crosswalk + address matching (not a forced MLS Grid ↔ TCAD API integration).
- **SQLite (`data/mls.sqlite`)** — local MLS closed + active/pending cache; seed once, not on every build.
- **TCAD** — Neon Postgres (`tcad_parcels`, ~373k parcels via `pnpm seed:tcad`); cache-first reads with live ArcGIS fallback.
- **MLS ↔ TCAD crosswalk** — Neon table `mls_tcad_crosswalk` (`listing_key` ↔ `prop_id`); built by `pnpm seed:crosswalk`; used for fast comp tax joins and profile TCAD resolution.
- **MLS sale/listing comps** — TCAD tax via crosswalk (single link) or strict situs address match; no nearest-parcel coordinate fallback.
- **Property profile cache** — in-process TTL cache (30 min); comparables search warms profile for flip reuse.
- **Multi-parcel TCAD** — ambiguous situs → `taxCandidates[]`; hold tax **Policy B** sums assessed values across all candidates; MLS-only profile when TCAD `not_found`.
- **Flip prediction engine** — rules-based MVP first; Python/ML later behind the same API contract.

---

## Infrastructure & setup (reference)

| Step | Status | Notes |
|------|--------|--------|
| Repo structure (client / server / shared / scripts) | ✅ Complete | Vite + React + Express |
| `pnpm install` / `pnpm dev` / `pnpm dev:api` | ✅ Complete | API on port 3001 in dev |
| `.env.local` with `VITE_MLS_GRID_TOKEN` | ✅ Complete | Required for MLS Grid + seed |
| `pnpm seed:mls` → `data/mls.sqlite` | ✅ Complete | Closed + active/pending residential; re-run to refresh all MLS data |
| `pnpm build` + `pnpm start` (prod locally) | ✅ Complete | Single server on port 3000 |
| Vite proxies `/api` → `3001` in dev | ✅ Complete | `vite.config.ts` |
| Project cleanup — runtime code in `shared/`, pruned unused UI | ✅ Complete | `shared/mls/sqlite.ts`, `shared/env/load-env-local.ts`; legacy routes/components removed |
| `GET /api/properties/by-radius` deprecated | ✅ Complete | Use `/api/comparables/unified`; `Deprecation` + `Warning` headers |

---

## Phase 1 — Strengthen existing pipelines

| Step | Status | Description |
|------|--------|-------------|
| 1.1 Extend MLS seed / SQLite schema | ✅ Complete | Added `list_price`, `has_pool`, `garage_spaces`, `lot_size_acres`, `property_condition`; migrations on DB open; shared condition/pool/garage mappers in `shared/mls/` |
| 1.2 Comparables mile buckets — 0.5 mi ring | ✅ Complete | `shared/comparables/match-score.ts` — exclusive rings: (0, 0.5], (0.5, 1], (1, 2], … |
| 1.3 Comparables UI — extended property fields | ✅ Complete | Subject + comp cards: list price, pool, garage, lot, house condition |
| 1.4 Comparables UI — condition placement | ✅ Complete | “House Condition” labeled inside card body; match % only in header |
| 1.5 Comp recency filters | ✅ Complete | `maxAgeMonths` on `/api/comparables/unified`; filters `close_date` in SQLite; UI sale-recency select (6/12/24 mo) |
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
| 2.4 Linking strategy (documented) | ✅ Complete | Priority: user `propId` → MLS `listing_key` crosswalk → address lookup; partial profiles OK |
| 2.5 `GET /api/property/profile` | ✅ Complete | TCAD + MLS enrichment; `taxCandidates` when multiple TCAD parcels; `tcadMatch` status |
| 2.6 TCAD address match — MLS-style queries | ✅ Complete | `scoreTcadAddressMatch` strips city/state tokens so `504 Bramble Dr, Austin, TX 78745` resolves to situs |
| 2.7 Profile cache (in-process) | ✅ Complete | `shared/property-profile/profile-cache.ts` — keyed by address and/or `propId`; 30 min TTL |
| 2.8 Multi-parcel hold tax — Policy B | ✅ Complete | `taxHoldBasisFromProfile()` in `shared/property-profile/tcad-tax.ts` — sum assessed across `taxCandidates`; no purchase-price fallback when candidates exist |
| 2.9 MLS-only fallback | ✅ Complete | When TCAD `not_found`, profile composes from MLS; comparables + flip continue without tax fields |

---

## Phase 3 — Unified comparables

| Step | Status | Description |
|------|--------|-------------|
| 3.1 MLS active / pending pipeline | ✅ Complete | `pnpm seed:mls` seeds closed + active/pending into `properties`; `findActiveListingsWithinRadius` |
| 3.2 `CompRecordDto` | ✅ Complete | `shared/comparables/comp-record.ts` — `source`, `compRole` (`sale_comp` \| `listing_comp` \| `tax_reference`); `taxValue`, `tcadAcres` |
| 3.3 Unified comparables API | ✅ Complete | `GET /api/comparables/unified` — MLS closed + MLS open + optional TCAD (`includeTcad=true`) |
| 3.4 UI — separate comp sections | ✅ Complete | `UnifiedComparablesResults` — closed / active / tax sections via unified API |
| 3.5 Do not use TCAD appraised value as sale comps | ✅ Complete | Design decision — tax values are reference only |
| 3.6 MLS comps enriched with TCAD tax data | ✅ Complete | `tcad-enrichment.ts` — crosswalk batch lookup, then strict situs match; tax only when TCAD parcel exists; citation `MLS + TCAD` |
| 3.7 Profile-first subject resolution | ✅ Complete | `unified-search.ts` resolves subject via `fetchPropertyProfileCached`; response includes `subjectProfile` |
| 3.8 Optional `propId` on unified API | ✅ Complete | `GET /api/comparables/unified?propId=` disambiguates TCAD parcel; UI parcel picker on subject card |
| 3.9 Subject card — TCAD tax fields | ✅ Complete | `SubjectPropertyCard` — tax value, TCAD acres, deed date; multi-parcel list + combined tax when `taxCandidates` |

---

## Phase 4 — Post-flip prediction engine (MVP)

| Step | Status | Description |
|------|--------|-------------|
| 4.1 Rehab / deal config (Travis County) | ✅ Complete | `shared/flip/` — rehab tiers ($/sqft), closing %, hold & financing defaults + cost helpers |
| 4.2 `FlipPredictionRequest` / `FlipPredictionResponse` schema | ✅ Complete | `shared/flip/prediction-types.ts`, `prediction-schema.ts` (Zod + enriched/manual modes) |
| 4.3 `POST /predict/flip` — rules engine v0 | ✅ Complete | `shared/flip/predict-flip.ts`, `POST /api/predict/flip` — comp median ARV + margin math |
| 4.4 Stack decision | ✅ Complete | Python for modeling later; TypeScript/Express for app; optional FastAPI microservice |
| 4.5 Flip UI on comparables landing | ✅ Complete | `ComparablesLanding` flip tab → `FlipPredictionResults`; hold uses Policy B (sum `taxCandidates`) or single assessed → appraised → purchase when no TCAD |
| 4.6 Flip smoke tests | ✅ Complete | `pnpm smoke:flip` — direct engine + optional HTTP E2E |

---

## Phase 5 — Data platform (optional, later)

| Step | Status | Description |
|------|--------|-------------|
| 5.1 Neon / Postgres for TCAD cache | ✅ Complete | `DATABASE_URL` in `.env.local`; `shared/tcad/db.ts`; ~373k parcels in `tcad_parcels` |
| 5.2 Batch TCAD ETL | ✅ Complete | `pnpm seed:tcad` — paginated ArcGIS ETL; `pnpm seed:tcad -- --fresh` to truncate/reload |
| 5.3 MLS → TCAD crosswalk | ✅ Complete | Neon `mls_tcad_crosswalk`; `pnpm seed:crosswalk`; runtime in `shared/tcad/crosswalk.ts` + comp/profile enrichment |
| 5.4 Deal ledger / training labels | ⬜ To do | Actual purchase, rehab spend, sold price, hold time |
| 5.5 Python ML model | ⬜ To do | Same request/response contract as rules engine |
| 5.6 Monthly TCAD refresh | ⬜ To do | Cron re-run `seed:tcad` then `seed:crosswalk` |

---

## Key API reference

### Comparables (canonical: unified API)

```bash
curl -G "http://localhost:3001/api/comparables/unified" \
  --data-urlencode "address=1613 W Braker Ln Austin" \
  --data-urlencode "radiusMiles=2" \
  --data-urlencode "maxAgeMonths=12" \
  --data-urlencode "includeTcad=true"

# Disambiguate multi-parcel TCAD (optional propId)
curl -G "http://localhost:3001/api/comparables/unified" \
  --data-urlencode "address=1613 W Braker Ln Austin" \
  --data-urlencode "propId=502434" \
  --data-urlencode "radiusMiles=2"
```

Related: `/api/properties/suggest`, `/api/properties/by-address`

### Property profile (TCAD + MLS)

```bash
curl -G "http://localhost:3001/api/property/profile" \
  --data-urlencode "propId=751055"

curl -G "http://localhost:3001/api/property/profile" \
  --data-urlencode "address=507 Hammack Dr Austin"
```

### TCAD (cache-first; ArcGIS fallback)

```bash
curl "http://localhost:3001/api/tcad/property?propId=984219"

curl -G "http://localhost:3001/api/tcad/property/by-address" \
  --data-urlencode "address=504 Bramble Dr, Austin, TX 78745"
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
pnpm seed:mls          # after .env.local; closed + active/pending → data/mls.sqlite
pnpm seed:tcad         # full Travis County → Neon tcad_parcels (requires DATABASE_URL)
pnpm seed:crosswalk    # MLS listing_key ↔ TCAD prop_id → Neon mls_tcad_crosswalk
pnpm dev:api           # Express API :3001 (loads .env.local for DATABASE_URL)
pnpm dev               # Vite UI :3000 (proxies /api)
pnpm smoke:flip        # flip engine + API regression checks
pnpm docs:architecture-pdf  # regenerate docs/ARCHITECTURE_REPORT.pdf
pnpm build && pnpm start   # production-style :3000
```

**`.env.local`:** `VITE_MLS_GRID_TOKEN` (MLS seed) and `DATABASE_URL` (Neon TCAD cache). Confirm the Neon **endpoint** in `DATABASE_URL` matches the project you view in the dashboard (`ep-…` hostname).

---

## MLS ↔ TCAD match statistics (July 2026)

**Address lookup audit** (6,139 distinct MLS addresses vs `tcad_parcels`, app scoring):

| Outcome | Count |
|---------|------:|
| Single TCAD parcel | 1,573 |
| No TCAD match (MLS-only) | 4,539 |
| Multiple TCAD parcels (`taxCandidates`) | 27 |

**Crosswalk table** (`pnpm seed:crosswalk -- --fresh`, cache-only match, 6,143 MLS listings):

| Outcome | Count |
|---------|------:|
| Single link stored | 1,716 |
| Ambiguous (multi-row per listing) | 41 |
| Not found | 4,386 |
| **Total crosswalk rows** | **1,919** |
| **Distinct listings linked** | **1,757** (~29%) |

**Test addresses:** single match — `504 Bramble Dr, Austin, TX 78745`; multi-parcel — `1613 W Braker Ln #B, Austin, TX 78758`. **507 Hammack Dr** and **34 Tournament Way** — MLS present, no TCAD situs (marketing address / numbering gaps).

---

## Suggested next work (in order)

1. **Phase 5.6** — Scheduled TCAD refresh (monthly `seed:tcad` + `seed:crosswalk`)
2. **Phase 5.4 / 5.5** — Deal ledger + Python ML behind same flip API contract
3. **Coordinate-based crosswalk** — optional seed-time linking when address fails but MLS lat/lon intersects a TCAD parcel (careful validation)

---

## Files touched in completed work (quick index)

| Area | Paths |
|------|--------|
| Mile buckets | `shared/comparables/match-score.ts` |
| Comp recency | `shared/comparables/recency.ts`, `shared/mls/sqlite.ts`, `server/routes/properties.ts` |
| Unified comps | `shared/comparables/comp-record.ts`, `shared/comparables/unified-search.ts`, `shared/comparables/tcad-enrichment.ts`, `server/routes/comparables.ts` |
| Flip deal config | `shared/flip/types.ts`, `shared/flip/config.ts`, `shared/flip/deal-costs.ts`, `shared/flip/prediction-types.ts`, `shared/flip/prediction-schema.ts`, `shared/flip/predict-flip.ts`, `server/routes/predict.ts`, `scripts/smoke-flip.ts` |
| TCAD cache / ETL | `shared/tcad/db.ts`, `shared/tcad/crosswalk.ts`, `scripts/seed-tcad.ts`, `scripts/seed-crosswalk.ts`, `shared/env/load-env-local.ts` |
| MLS schema / seed | `shared/mls/transform.ts`, `shared/mls/condition.ts`, `shared/mls/sqlite.ts`, `shared/mls/constants.ts`, `scripts/seed-mls.ts` |
| API DTOs | `shared/comparables/types.ts`, `shared/comparables/property-dto.ts`, `shared/comparables/format.ts` |
| Property profile | `shared/property-profile/types.ts`, `shared/property-profile/compose.ts`, `shared/property-profile/fetch-profile.ts`, `shared/property-profile/profile-cache.ts`, `shared/property-profile/tcad-tax.ts`, `server/routes/property-profile.ts` |
| TCAD | `shared/tcad/*`, `server/routes/tcad.ts`, `server/app.ts` |
| TCAD centroids | `shared/tcad/geometry.ts` |
| Comparables UI | `client/src/components/comparables/SubjectPropertyCard.tsx`, `CompRecordDetailCard.tsx`, `UnifiedComparablesResults.tsx`, `ComparablesLanding.tsx` (flip tab + parcel picker) |
| Flip UI | `client/src/components/flip/FlipPredictionResults.tsx`, `client/src/lib/api/flip.ts` |

See also: `LOCAL_DEVELOPMENT.md` for environment and troubleshooting.
