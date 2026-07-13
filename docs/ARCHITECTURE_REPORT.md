# Realty360 Austin — Application Architecture Report

**Version:** 1.4 · **Generated:** July 13, 2026 · **Market:** Austin / Travis County, TX

This document describes what the application does today, how data flows through the system, key design decisions, and the planned evolution path. It reflects the codebase as of the `feature/tax-data-pipeline` branch (MLS SQLite cache, TCAD Neon Postgres cache, MLS↔TCAD crosswalk, profile cache, multi-parcel TCAD handling, strict comp tax enrichment, rules-based flip engine).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Repository Layout](#3-repository-layout)
4. [Data Sources & Storage](#4-data-sources--storage)
5. [Core User Flows](#5-core-user-flows)
6. [API Surface](#6-api-surface)
7. [Domain Modules](#7-domain-modules)
8. [Flip Prediction Engine](#8-flip-prediction-engine)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Operational Commands](#10-operational-commands)
11. [Roadmap & Gaps](#11-roadmap--gaps)
12. [Appendix: Diagrams](#12-appendix-diagrams)

---

## 1. Executive Summary

**Realty360 Austin** is a full-stack property analysis tool for Travis County real estate investors and analysts. It combines:

- **MLS closed and open listings** (sale comparables, subject lookup)
- **TCAD tax parcel data** (assessed/appraised values, parcel centroids)
- **Unified comparables search** (closed sales, active listings, optional tax-reference parcels; MLS comps enriched with TCAD tax fields)
- **Property profile composition** with in-process cache and multi-parcel TCAD (`taxCandidates`)
- **MLS ↔ TCAD crosswalk** (precomputed `listing_key` ↔ `prop_id` in Neon)
- **Post-flip deal analysis** (ARV from comps, rehab tiers, hold/financing costs with Policy B multi-parcel tax, margin viability)

The app is built as **Vite + React** (client) and **Express** (API), with shared TypeScript logic in `shared/`. Production serves a single Node process; development runs Vite on port 3000 proxying `/api` to Express on 3001.

**What it is not (yet):** a production MLS Grid proxy for the browser, a machine-learning ARV model, or full ACTRIS MLS history in the local seed.

---

## 2. System Architecture

### 2.1 High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                              │
│  ComparablesLanding · Flip analysis tab · Address suggest · Comp cards   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP /api/*
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Express API (server/)                                 │
│  /api/properties  /api/comparables  /api/property  /api/tcad  /predict  │
└───────┬─────────────────┬──────────────────────┬────────────────────────┘
        │                 │                      │
        ▼                 ▼                      ▼
┌───────────────┐  ┌──────────────┐      ┌──────────────────┐
│ data/mls.sqlite│  │ Neon Postgres │      │ Travis County    │
│ (MLS cache)    │  │ tcad_parcels  │      │ ArcGIS (live)    │
│                │  │ mls_tcad_     │      │                  │
│                │  │ crosswalk     │      │                  │
└───────────────┘  └──────────────┘      └──────────────────┘
        ▲                 ▲                      ▲
        │                 │                      │
   pnpm seed:mls   seed:tcad + seed:crosswalk   fallback reads
```

### 2.2 Request Path (Development)

| Component | Port | Role |
|-----------|------|------|
| Vite dev server | 3000 | UI, proxies `/api` → 3001 |
| Express `dev:api` | 3001 | JSON API, reads SQLite + Postgres |
| `pnpm start` (prod) | 3000 | Bundled static + API (or API-only if no build) |

### 2.3 Shared Logic

Business rules live in `shared/` so the same comp-matching, flip math, TCAD address scoring, and DTO composition run in scripts, API routes, and (where applicable) the client via `@shared` alias.

---

## 3. Repository Layout

| Path | Purpose |
|------|---------|
| `client/` | React UI (Comparables landing, flip results, shadcn components) |
| `server/` | Express app, route handlers |
| `shared/` | Domain logic: MLS, TCAD, comparables, property-profile, flip |
| `shared/env/load-env-local.ts` | Loads `.env.local` for Node scripts and Express |
| `shared/mls/sqlite.ts` | MLS SQLite schema and query helpers (runtime) |
| `scripts/` | Seed jobs (`seed-mls`, `seed-tcad`, `seed-crosswalk`), `smoke-flip`, architecture PDF |
| `data/` | Gitignored runtime data (`mls.sqlite`, raw JSON dumps) |
| `docs/` | Roadmap and architecture documentation |

---

## 4. Data Sources & Storage

### 4.1 MLS (Multiple Listing Service)

| Aspect | Detail |
|--------|--------|
| **Upstream** | MLS Grid API (`https://api-demo.mlsgrid.com/v2` or production URL) |
| **Originating system** | `actris` (Austin Board of Realtors) — `shared/mls/constants.ts` |
| **Local store** | SQLite `data/mls.sqlite`, table `properties` |
| **Seed command** | `pnpm seed:mls` (closed + active/pending residential) |
| **Runtime** | API reads SQLite only; no live MLS Grid on user requests |
| **Token** | `MLS_GRID_TOKEN` or `VITE_MLS_GRID_TOKEN` in `.env.local` (seed only) |

**Row shape:** normalized address, lat/lon, beds/baths/sqft, list/close price, close date, pool, garage, lot acres, property condition, status.

### 4.2 TCAD (Travis Central Appraisal District)

| Aspect | Detail |
|--------|--------|
| **Upstream** | ArcGIS MapServer layer `TCAD/MapServer/0` (full county parcels) |
| **Local store** | Postgres `tcad_parcels` (Neon) via `DATABASE_URL` |
| **Seed command** | `pnpm seed:tcad` (~387k parcels, paginated ETL) |
| **Runtime** | Cache-first in `shared/tcad/client.ts`; live ArcGIS fallback |
| **Coverage** | Travis County only — Williamson/Georgetown addresses return `not_found` |

**Fields cached:** `PROP_ID`, geo_id, situs address, tax values (appraised, market, assessed), acres, WGS-84 centroid.

### 4.3 MLS ↔ TCAD Crosswalk

| Aspect | Detail |
|--------|--------|
| **Store** | Neon Postgres table `mls_tcad_crosswalk` (same `DATABASE_URL` as TCAD) |
| **Seed command** | `pnpm seed:crosswalk` (after `seed:mls` + `seed:tcad`); `--fresh` truncates |
| **Row shape** | `listing_key`, `prop_id`, `address_norm`, `match_method`, `match_score` |
| **Build logic** | Cache-only TCAD address lookup per MLS listing; single + ambiguous outcomes stored |
| **Runtime** | Comp enrichment and property profile resolve TCAD via crosswalk before address scoring |

**Current seed stats (6,143 listings):** 1,757 distinct listings linked (~29%); 1,919 total rows (includes multi-parcel ambiguous).

### 4.4 Data Independence Principle

MLS and TCAD remain **separate upstream sources**. The crosswalk is a precomputed optimization layer — not all MLS addresses link to a TCAD situs (~71% still `not_found` after address matching).

---

## 5. Core User Flows

### 5.1 Comparables Search

1. User enters address (with typeahead from MLS SQLite).
2. UI calls `GET /api/comparables/unified` with radius, recency, optional `includeTcad`, optional `propId`.
3. Server loads subject via **`fetchPropertyProfileCached`** (MLS + TCAD profile-first); resolves MLS row for comp filters.
4. Returns sections:
   - **Closed sales** (MLS) — sale comps, each enriched with TCAD `taxValue` and `tcadAcres` when a parcel matches
   - **Active listings** (MLS open status) — same TCAD enrichment on listing comps
   - **Tax references** (TCAD radius, `includeTcad=true`) — reference only, not sale comps
5. Response includes **`subjectProfile`** for subject card tax display and flip cache reuse.

**Subject card:** shows TCAD tax value, acres, deed date when single match; lists all `taxCandidates` with combined tax when ambiguous; optional parcel picker re-runs search with `propId`.

**TCAD enrichment (closed + open comps):** batch crosswalk lookup by `listing_key` (single link only), then strict situs address match against one radius prefetch (`findTcadParcelsInRadiusBBox`). Tax fields attach only when a real TCAD parcel matches — no nearest-parcel coordinate fallback. UI citation: `MLS + TCAD` when enriched.

Comps are bucketed into exclusive mile rings (0–0.5, 0.5–1, 1–2 mi, …) with match % from beds/baths/distance.

### 5.2 Property Profile

1. `GET /api/property/profile?address=` or `?propId=` (or both)
2. `fetchPropertyProfile()` / `fetchPropertyProfileCached()` loads MLS by address.
3. **TCAD linking priority:** user `propId` → MLS `listing_key` crosswalk → address lookup (cache → ArcGIS).
4. `composePropertyProfile()` merges identifiers, physical, MLS sale, tax, location.
5. **Single TCAD match** → `tax` set, `tcadMatch.status: "single"`.
6. **Ambiguous TCAD match** → `tax: null`, `taxCandidates[]`, `tcadMatch.status: "ambiguous"` (e.g. duplex — multiple `prop_id` at same situs).
7. **No TCAD match** → MLS-only profile, `tcadMatch.status: "not_found"`; comparables and flip continue without tax fields.
8. **Address matching** tolerates MLS-style queries (`504 Bramble Dr, Austin, TX 78745`) by excluding city/state tokens from situs scoring (`shared/tcad/address-query.ts`).

**Profile cache:** in-process Map, 30 min TTL, keys `address:{norm}` and/or `propId:{id}|address:{norm}`. Comparables search warms cache; flip reuses same profile without re-fetching TCAD.

### 5.3 Flip Analysis

1. User runs comparables search, switches to **Flip analysis** tab.
2. Enters purchase price and rehab scope tier (cosmetic / moderate / full).
3. `POST /api/predict/flip` in **enriched** mode:
   - Loads property profile via **`fetchPropertyProfileCached`** (address only — preserves `taxCandidates` for Policy B even if UI selected a `propId` for display)
   - Derives ARV from similar closed MLS comps (median $/sqft × subject sqft)
   - Computes rehab, closing, hold, financing
   - **Hold tax basis (Policy B):** single parcel → assessed → appraised; ambiguous → **sum assessed** across all `taxCandidates`; no TCAD → purchase price
   - Returns viability band: strong / marginal / weak / negative

**Manual mode:** user supplies explicit `arv` + `livingAreaSqft` without subject lookup.

---

## 6. API Surface

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Liveness check |
| GET | `/api/properties/suggest` | Address typeahead (MLS) |
| GET | `/api/properties/by-address` | Single MLS property |
| GET | `/api/properties/by-radius` | **Deprecated** — closed comps only; use `/api/comparables/unified` |
| GET | `/api/comparables/unified` | Closed + open + optional TCAD; optional `propId`; returns `subjectProfile` |
| GET | `/api/property/profile` | Composed MLS + TCAD profile |
| GET | `/api/tcad/property` | TCAD parcel by propId or address |
| POST | `/api/predict/flip` | Rules-based flip prediction |

All routes are mounted in `server/app.ts`.

**Deprecation:** `GET /api/properties/by-radius` responds with `Deprecation: true`, a `Warning` header, and a `deprecation` object in the JSON body. Prefer `GET /api/comparables/unified` for all new integrations.

---

## 7. Domain Modules

### 7.1 `shared/mls/`

- RESO property types, MLS Grid client, address normalization
- `shared/mls/sqlite.ts`: SQLite schema, radius queries, address resolution

### 7.2 `shared/tcad/`

- ArcGIS client with retry/timeout
- Address fuzzy matching (`address-query.ts`)
- Postgres cache (`db.ts`)
- **MLS ↔ TCAD crosswalk** (`crosswalk.ts`)
- Parcel centroids from polygon geometry

### 7.3 `shared/comparables/`

- `match-score.ts` — mile rings, match %, distance score
- `comp-record.ts` — unified `CompRecordDto` with `source`, `compRole`, `taxValue`, `tcadAcres`
- `tcad-enrichment.ts` — crosswalk batch lookup + strict situs address match for MLS sale/listing comps
- `unified-search.ts` — orchestrates MLS + TCAD comp sections and enrichment

### 7.4 `shared/property-profile/`

- `fetch-profile.ts` — enrichment orchestration (MLS + crosswalk + TCAD, ambiguous handling)
- `compose.ts` — merges partial MLS/TCAD into `PropertyProfileDto`
- `profile-cache.ts` — in-process TTL cache keyed by address and/or `propId`
- `tcad-tax.ts` — `pickProfileTaxValue`, `taxHoldBasisFromProfile` (Policy B sum for multi-parcel)
- Provenance and completeness scoring

### 7.5 `shared/flip/`

- `config.ts` — Travis County rehab tiers, closing %, hold/financing defaults
- `arv-comps.ts` — similarity filter, tier-based $/sqft slice (top half / quartile)
- `deal-costs.ts` — deterministic cost stack
- `predict-flip.ts` — end-to-end prediction pipeline

---

## 8. Flip Prediction Engine

### 8.1 ARV (After Repair Value)

**Source:** MLS closed sales within radius, filtered by:

- Recency (`maxAgeMonths` on `close_date`)
- Similarity: ±25% sqft, beds/baths within delta rules
- Rehab tier slice: cosmetic uses all similar; moderate uses top 50% $/sqft; full uses top 25%

```
ARV = median(pricePerSqft of slice) × subjectLivingAreaSqft
```

Override: request body `arv` → manual mode.

### 8.2 Cost Stack

| Component | Basis |
|-----------|--------|
| Rehab | tier $/sqft × living area (sqft from MLS profile) |
| Buy closing | 2.5% of purchase price (user input) |
| Hold — property tax | **Policy B:** sum assessed across `taxCandidates` when ambiguous; else single assessed → appraised → purchase price; × 2.2% annual × hold months |
| Hold — insurance / utilities / HOA | fixed monthly amounts from deal config |
| Financing | hard-money style: LTC ratio, points, interest during hold |
| Sell closing | 7% of ARV (ARV from MLS comps) |

### 8.3 Viability Bands

| Net margin % (of ARV) | Label |
|------------------------|-------|
| ≥ 12% | strong |
| 6–12% | marginal |
| 0–6% | weak |
| < 0% | negative |

### 8.4 Explicit Non-Goals

- TCAD appraised value is **not** used as ARV or sale comp
- Tax values affect **hold cost** only (when TCAD resolves)

---

## 9. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **MLS in SQLite, not live API** | Fast radius queries; avoids MLS Grid rate limits on every request |
| **TCAD in Postgres (Neon)** | ~373k parcels; eliminates per-request ArcGIS latency; one bbox query per comp search |
| **Cache-first TCAD with ArcGIS fallback** | Works before seed completes; resilient to cache gaps; `source: tcad-cache \| tcad-arcgis` on DTOs |
| **MLS comp TCAD enrichment** | Crosswalk first (fast); strict situs match fallback; tax only when TCAD parcel exists |
| **Profile cache (30 min TTL)** | Comparables warms profile; flip reuses without duplicate TCAD/MLS fetches |
| **Multi-parcel Policy B** | Duplex/multi-`prop_id` situs: hold tax sums all candidate assessed values; UI lists each parcel |
| **MLS-only fallback** | TCAD `not_found` → valid MLS profile; hold tax uses purchase price |
| **MLS ↔ TCAD crosswalk** | Precomputed `listing_key` ↔ `prop_id` in Neon; ~29% of seeded listings linked |
| **No nearest-parcel comp tax** | Avoids false tax on MLS marketing addresses (e.g. ROW parcels, Tournament/Tourney mismatches) |
| **MLS-style address scoring** | City/state stripped from TCAD situs match so profile + flip resolve full formatted addresses |
| **Batch comp enrichment** | One radius prefetch + crosswalk prop_id batch fetch (not N fuzzy matches per comp) |
| **TCAD tax comps are reference only** | Appraised ≠ market sale price; prevents misleading ARV |
| **Rules engine before ML** | Auditable math; same API contract for future Python model |
| **Shared TypeScript domain layer** | One source of truth for comps, flip, and profile logic |
| **Enriched vs manual flip modes** | Supports full subject lookup or spreadsheet-style what-if |
| **Dedupe PROP_ID on TCAD seed** | ArcGIS pages can repeat prop_ids (multipart parcels) |

---

## 10. Operational Commands

```bash
pnpm install
pnpm seed:mls              # MLS closed + active/pending → data/mls.sqlite
pnpm seed:tcad             # Full county → Neon tcad_parcels
pnpm seed:crosswalk        # MLS listing_key ↔ TCAD prop_id → Neon mls_tcad_crosswalk
pnpm dev:api               # API :3001
pnpm dev                   # UI :3000
pnpm smoke:flip            # API/engine regression checks
pnpm docs:architecture-pdf # Regenerate docs/ARCHITECTURE_REPORT.pdf
pnpm build && pnpm start   # Production-style single server
```

**Environment (`.env.local`):**

- `VITE_MLS_GRID_TOKEN` / `MLS_GRID_TOKEN` — MLS Grid bearer token
- `DATABASE_URL` — Neon Postgres for TCAD cache (`tcad_parcels`). **Must match** the Neon project/branch you intend (verify `ep-…` hostname in connection string vs dashboard).

---

## 11. Roadmap & Gaps

### Completed (Phases 1–5.3)

- MLS schema extensions, mile-bucket comps, unified comparables API
- Property profile composition, TCAD propId/address APIs, **profile cache**, **multi-parcel `taxCandidates`**
- **Subject card TCAD tax display**; optional `propId` parcel picker
- Flip rules engine v0, flip UI on comparables landing (`FlipPredictionResults`)
- **Policy B hold tax** (`taxHoldBasisFromProfile` — sum assessed for ambiguous parcels)
- TCAD Neon ETL (`pnpm seed:tcad`, ~373k parcels), cache-first reads (`shared/tcad/db.ts`)
- **MLS ↔ TCAD crosswalk** (`pnpm seed:crosswalk`, `mls_tcad_crosswalk`, runtime in `crosswalk.ts`)
- MLS sale/listing comp enrichment — crosswalk + strict address match (`tcad-enrichment.ts`)
- MLS-style TCAD address matching (city/state excluded from scoring)
- Flip smoke tests (`pnpm smoke:flip`)
- Legacy `GET /api/properties/by-radius` deprecated (use `/api/comparables/unified`)
- Project cleanup: runtime code in `shared/`, pruned unused UI components and dead client routes

### MLS ↔ TCAD coverage (July 2026)

**Address lookup** (6,139 distinct MLS addresses):

| Outcome | Count |
|---------|------:|
| Single TCAD parcel | 1,573 |
| No TCAD match (MLS-only) | 4,539 |
| Ambiguous (multi-parcel) | 27 |

**Crosswalk table** (6,143 MLS listings seeded):

| Outcome | Count |
|---------|------:|
| Single link | 1,716 |
| Ambiguous listings | 41 |
| Not found | 4,386 |
| Distinct listings linked | 1,757 (~29%) |

Example multi-parcel: `1613 W Braker Ln #B`. MLS-only examples: `507 Hammack Dr`, `34 Tournament Way`, `50 Tournament Way #I-52`.

### Planned

| Item | Description |
|------|-------------|
| Deal ledger | Labeled flips for ML training |
| Python ML ARV model | Same `POST /api/predict/flip` contract |
| `geoId` lookup | Alternate TCAD key |
| Coordinate-based crosswalk seed | Link MLS lat/lon to TCAD parcel when situs address mismatches |
| Monthly TCAD + crosswalk refresh | Cron re-run `seed:tcad` then `seed:crosswalk` |

### Known Limitations

- MLS seed cap (~2k–5k rows configurable) — not full ACTRIS history
- Non-Travis addresses have MLS data but no TCAD tax
- **~71% of MLS listings** have no TCAD crosswalk link (situs vs marketing address gaps, units, numbering)
- **Multi-parcel ambiguous** is rare (~41 listings in crosswalk seed)
- Condos/townhomes often lack unit-level TCAD situs — no tax on comp unless situs matches
- Flip ARV requires sufficient similar closed comps in radius

---

## 12. Appendix: Diagrams

### 12.1 Property Profile Composition

```
                    ┌─────────────────┐
                    │  User query     │
                    │  address/propId │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌────────────────┐           ┌────────────────┐
     │  MLS SQLite    │           │  TCAD cache    │
     │  resolve addr  │           │  or ArcGIS     │
     └───────┬────────┘           └───────┬────────┘
             │                            │
             └────────────┬───────────────┘
                          ▼
                 ┌─────────────────┐
                 │ composeProperty │
                 │ ProfileDto      │
                 └─────────────────┘
                          │
     identifiers · physical · mlsSale · tax · location · provenance
```

### 12.2 Flip Prediction Pipeline

```
POST /api/predict/flip
        │
        ├─ enriched? ──► fetchPropertyProfileCached (MLS + TCAD)
        │
        ├─ resolve livingAreaSqft (profile or override)
        │
        ├─ ARV: manual override OR comp median $/sqft × sqft
        │         └─ MLS closed comps in radius (SQLite)
        │
        ├─ taxBasis (Policy B):
        │     ├─ single tax → assessed → appraised
        │     ├─ taxCandidates → SUM assessed (no purchase fallback)
        │     └─ not_found → purchasePrice
        │
        ├─ costs: rehab + closing + hold + financing
        │
        └─ margins + viability ──► FlipPredictionResponse
```

### 12.3 TCAD Read Path

```
API handler (profile / tcad / unified / flip)
        │
        ▼
shared/tcad/client.ts
        │
        ├─ DATABASE_URL set?
        │     ├─ YES ──► shared/tcad/db.ts (Postgres)
        │     │           propId / address candidates / radius
        │     └─ miss or error ──► live ArcGIS query
        │
        └─ NO ──► live ArcGIS only
```

### 12.4 Comp Roles (Unified API)

```
┌──────────────────┬──────────────┬─────────────────────────────────────────────┐
│ compRole         │ source       │ Use                                         │
├──────────────────┼──────────────┼─────────────────────────────────────────────┤
│ sale_comp        │ mls (+ tcad) │ Closed sale comps; TCAD tax fields merged   │
│ listing_comp     │ mls (+ tcad) │ Active/pending; TCAD tax fields merged      │
│ tax_reference    │ tcad         │ Optional radius section — reference only    │
└──────────────────┴──────────────┴─────────────────────────────────────────────┘
```

`taxValue` on MLS comps = first non-null of appraised / market / assessed from matched TCAD parcel. Not used in ARV calculation.

### 12.5 MLS Comp TCAD Enrichment

```
GET /api/comparables/unified
        │
        ├─ MLS closed + open rows in radius
        │
        ├─ ONE fetch: findTcadParcelsInRadiusBBox (Neon)
        │     └─ build street-number index in memory
        │
        ├─ BATCH: mls_tcad_crosswalk by listing_key
        │     └─ single link → tcad_parcels by prop_id
        │
        ├─ per MLS comp (no crosswalk hit):
        │     └─ strict situs address match (same street number required)
        │
        └─ CompRecordDto with taxValue, tcadAcres, propId when matched
              └─ UI: Source MLS + TCAD (else MLS only)
```

### 12.6 Multi-Parcel TCAD Flow

```
MLS address query
        │
        ▼
TCAD address lookup (cache → ArcGIS)
        │
        ├─ single match ──► profile.tax set
        │
        ├─ ambiguous (top scores within 3 pts)
        │     └─► taxCandidates[] on profile
        │           ├─ UI: list parcels + combined tax value
        │           └─ Flip hold: Policy B SUM assessed
        │
        └─ not_found ──► MLS-only profile (tax null)
              └─ Flip hold: purchasePrice as tax basis
```

---

*End of report. Source: Realty360-Austin codebase and docs/ROADMAP.md.*
