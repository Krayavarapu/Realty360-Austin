# Realty360 Austin — Application Architecture Report

**Version:** 1.1 · **Generated:** July 2026 · **Market:** Austin / Travis County, TX

This document describes what the application does today, how data flows through the system, key design decisions, and the planned evolution path. It reflects the codebase as of the `feature/tax-data-pipeline` branch (MLS SQLite cache, TCAD Postgres cache, rules-based flip engine).

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
- **Unified comparables search** (closed sales, active listings, optional tax-reference parcels)
- **Post-flip deal analysis** (ARV from comps, rehab tiers, hold/financing costs, margin viability)

The app is built as **Vite + React** (client) and **Express** (API), with shared TypeScript logic in `shared/`. Production serves a single Node process; development runs Vite on port 3000 proxying `/api` to Express on 3001.

**What it is not (yet):** a production MLS Grid proxy for the browser, a machine-learning ARV model, or a forced MLS↔TCAD crosswalk. Those are documented future phases.

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
└───────────────┘  └──────────────┘      └──────────────────┘
        ▲                 ▲                      ▲
        │                 │                      │
   pnpm seed:mls     pnpm seed:tcad         fallback reads
   pnpm seed:mls:open
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
| `scripts/` | Seed jobs (`seed-mls`, `seed-mls-open`, `seed-tcad`), `smoke-flip` |
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
| **Seed commands** | `pnpm seed:mls` (closed residential), `pnpm seed:mls:open` (active/pending) |
| **Runtime** | API reads SQLite only; no live MLS Grid on user requests |
| **Token** | `MLS_GRID_TOKEN` or `VITE_MLS_GRID_TOKEN` in `.env.local` (seed + optional client fetch on Home page) |

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

### 4.3 Data Independence Principle

MLS and TCAD are **intentionally separate**. There is no required `listing_key` ↔ `prop_id` crosswalk in v1. Profiles compose both sources at request time when possible; partial profiles are valid.

---

## 5. Core User Flows

### 5.1 Comparables Search

1. User enters address (with typeahead from MLS SQLite).
2. UI calls `GET /api/comparables/unified` with radius, recency, optional `includeTcad`.
3. Server resolves subject from MLS and/or TCAD.
4. Returns three optional sections:
   - **Closed sales** (MLS) — primary sale comps
   - **Active listings** (MLS open status)
   - **Tax references** (TCAD radius) — reference only, not sale comps

Comps are bucketed into exclusive mile rings (0–0.5, 0.5–1, 1–2 mi, …) with match % from beds/baths/distance.

### 5.2 Property Profile

1. `GET /api/property/profile?address=` or `?propId=`
2. `fetchPropertyProfile()` loads MLS by address and TCAD by address or propId.
3. `composePropertyProfile()` merges identifiers, physical, MLS sale, tax, location.
4. TCAD is always attempted for tax data even when MLS supplies coordinates.
5. Ambiguous TCAD matches surface as `taxCandidates` rather than silent failure.

### 5.3 Flip Analysis

1. User runs comparables search, switches to **Flip analysis** tab.
2. Enters purchase price and rehab scope tier (cosmetic / moderate / full).
3. `POST /api/predict/flip` in **enriched** mode:
   - Loads property profile (MLS + TCAD)
   - Derives ARV from similar closed MLS comps (median $/sqft × subject sqft)
   - Computes rehab, closing, hold (tax basis from assessed/appraised), financing
   - Returns viability band: strong / marginal / weak / negative

**Manual mode:** user supplies explicit `arv` + `livingAreaSqft` without subject lookup.

---

## 6. API Surface

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Liveness check |
| GET | `/api/properties/suggest` | Address typeahead (MLS) |
| GET | `/api/properties/by-address` | Single MLS property |
| GET | `/api/properties/by-radius` | Closed comps in radius |
| GET | `/api/comparables/unified` | Closed + open + optional TCAD |
| GET | `/api/property/profile` | Composed MLS + TCAD profile |
| GET | `/api/tcad/property` | TCAD parcel by propId or address |
| POST | `/api/predict/flip` | Rules-based flip prediction |

All routes are mounted in `server/app.ts`.

---

## 7. Domain Modules

### 7.1 `shared/mls/`

- RESO property types, MLS Grid client, address normalization
- `scripts/mls-db.ts`: SQLite schema, radius queries, address resolution

### 7.2 `shared/tcad/`

- ArcGIS client with retry/timeout
- Address fuzzy matching (`address-query.ts`)
- Postgres cache (`db.ts`)
- Parcel centroids from polygon geometry

### 7.3 `shared/comparables/`

- `match-score.ts` — mile rings, match %, distance score
- `comp-record.ts` — unified `CompRecordDto` with `source` and `compRole`
- `unified-search.ts` — orchestrates MLS + TCAD comp sections

### 7.4 `shared/property-profile/`

- `fetch-profile.ts` — enrichment orchestration
- `compose.ts` — merges partial MLS/TCAD into `PropertyProfileDto`
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
| Rehab | tier $/sqft × living area |
| Buy closing | % of purchase price |
| Hold | property tax (assessed → appraised → purchase), insurance, utilities, HOA |
| Financing | hard-money style: LTC ratio, points, interest during hold |
| Sell closing | % of ARV |

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
| **TCAD in Postgres (Neon)** | ~387k parcels; eliminates ArcGIS timeouts on hot paths |
| **Cache-first TCAD with ArcGIS fallback** | Works before seed completes; resilient to cache gaps |
| **No forced MLS↔TCAD link in v1** | Address matching is messy; partial profiles OK; crosswalk is Phase 5 optional |
| **TCAD tax comps are reference only** | Appraised ≠ market sale price; prevents misleading ARV |
| **Rules engine before ML** | Auditable math; same API contract for future Python model |
| **Shared TypeScript domain layer** | One source of truth for comps, flip, and profile logic |
| **Enriched vs manual flip modes** | Supports full subject lookup or spreadsheet-style what-if |
| **Dedupe PROP_ID on TCAD seed** | ArcGIS pages can repeat prop_ids (multipart parcels) |

---

## 10. Operational Commands

```bash
pnpm install
pnpm seed:mls              # MLS closed → data/mls.sqlite
pnpm seed:mls:open         # Active/pending into same DB
pnpm seed:tcad             # Full county → Neon tcad_parcels
pnpm dev:api               # API :3001
pnpm dev                   # UI :3000
pnpm smoke:flip            # API/engine regression checks
pnpm build && pnpm start   # Production-style single server
```

**Environment (`.env.local`):**

- `VITE_MLS_GRID_TOKEN` / `MLS_GRID_TOKEN` — MLS Grid bearer token
- `DATABASE_URL` — Neon Postgres for TCAD cache

---

## 11. Roadmap & Gaps

### Completed (Phases 1–4 + partial 5)

- MLS schema extensions, mile-bucket comps, unified comparables API
- Property profile composition, TCAD propId/address APIs
- Flip rules engine v0, flip UI on comparables landing
- TCAD Postgres ETL (`seed:tcad`), cache-first reads
- TCAD skip fix (always fetch tax when enriching by address)

### Planned

| Item | Description |
|------|-------------|
| MLS → TCAD crosswalk | Precomputed `listing_key` ↔ `prop_id` links |
| Deal ledger | Labeled flips for ML training |
| Python ML ARV model | Same `POST /api/predict/flip` contract |
| `geoId` lookup | Alternate TCAD key |
| Monthly TCAD refresh | Cron re-run `seed:tcad` |

### Known Limitations

- MLS seed cap (~2k–5k rows configurable) — not full ACTRIS history
- Non-Travis addresses have MLS data but no TCAD tax
- Flip ARV requires sufficient similar closed comps in radius
- Home page calculator may still use embedded constants if MLS token unset

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
        ├─ enriched? ──► fetchPropertyProfile (MLS + TCAD)
        │
        ├─ resolve livingAreaSqft (profile or override)
        │
        ├─ ARV: manual override OR comp median $/sqft × sqft
        │         └─ MLS closed comps in radius (SQLite)
        │
        ├─ taxBasis: assessed → appraised → purchasePrice
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
┌──────────────────┬──────────┬─────────────────────────────┐
│ compRole         │ source   │ Use                         │
├──────────────────┼──────────┼─────────────────────────────┤
│ sale_comp        │ mls      │ Closed sale comparables     │
│ listing_comp     │ mls      │ Active/pending market refs  │
│ tax_reference    │ tcad     │ Tax values — reference only │
└──────────────────┴──────────┴─────────────────────────────┘
```

---

*End of report. Source: Realty360-Austin codebase and docs/ROADMAP.md.*
