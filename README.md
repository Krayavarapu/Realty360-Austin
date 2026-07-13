# Realty360 · Austin Edition

Comparables search and flip analysis for Travis County residential properties. MLS closed sales and listings come from a local SQLite cache; tax and parcel data from TCAD (Postgres cache + ArcGIS fallback).

**Docs:** [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) (run locally) · [docs/ROADMAP.md](docs/ROADMAP.md) (status) · [docs/ARCHITECTURE_REPORT.md](docs/ARCHITECTURE_REPORT.md) (system design)

---

## Data Collection, Enrichment & Pricing Methodology

> **Note:** Sections 2–12 below describe the original v1.0 hedonic calculator methodology (embedded constants). The live app uses MLS + TCAD APIs and the flip engine documented in `docs/ARCHITECTURE_REPORT.md`. This section is retained as historical reference for adjustment-factor calibration.

**Version:** 1.0.0 · **Data Vintage:** February 19, 2026 · **Market:** Austin, TX (Travis County)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Collection Process](#2-data-collection-process)
3. [Data Sources](#3-data-sources)
4. [Raw Data Collected](#4-raw-data-collected)
5. [Data Enrichment Pipeline](#5-data-enrichment-pipeline)
6. [Pricing Model & Equations](#6-pricing-model--equations)
7. [Adjustment Factor Reference Table](#7-adjustment-factor-reference-table)
8. [Confidence & Range Calculation](#8-confidence--range-calculation)
9. [Comparable Sales Dataset](#9-comparable-sales-dataset)
10. [Historical Price Trend Data](#10-historical-price-trend-data)
11. [Known Limitations](#11-known-limitations)
12. [References](#12-references)

---

## 1. Overview

Realty360 Austin Edition is a **comparables and flip-analysis** tool for residential properties in Travis County, Texas. At runtime it reads seeded MLS data from SQLite and TCAD parcel/tax data from a Postgres cache (with live ArcGIS fallback). The flip engine uses deterministic ARV and cost-stack math on closed MLS comps — no ML inference.

For architecture, API routes, and data flows, see **`docs/ARCHITECTURE_REPORT.md`**.

The sections below (2–12) document the **original v1.0 hedonic calculator** used to calibrate adjustment factors; that embedded client-only calculator has been removed from the app.

---

## 2. Data Collection Process

### Method

Data was gathered through **direct browser navigation** to live real estate market data pages. This is equivalent to a human analyst opening a browser, visiting each source, and recording the figures manually. No automated scraping scripts, headless browsers, or API keys were used.

The collection workflow followed three steps:

**Step 1 — Source Identification.** Three primary sources were identified as authoritative for Austin market data: Redfin (transaction-level market statistics), Cain Realty Group (neighborhood-level 3-bedroom breakdowns), and Berba's Group (qualitative neighborhood analysis with price anchors).

**Step 2 — Page Navigation & Extraction.** Each source URL was navigated to directly. The rendered page content — including visible text, tables, and data labels — was extracted and recorded. Screenshots were taken at each source to preserve a point-in-time record.

**Step 3 — Cross-Validation.** Key figures (e.g., Austin median price, days on market) were cross-referenced across at least two sources before being accepted. Where sources disagreed, the more conservative figure was used or a weighted average was computed.

### Pages Visited

| Source | URL | Data Extracted |
|---|---|---|
| Redfin Austin Market | `redfin.com/city/30818/TX/Austin/housing-market` | Median price, DOM, sale-to-list ratio, YoY changes, active listing count |
| Cain Realty Group | `cainrealtygroup.com/market-statistics/` | 3-BR average prices by neighborhood, price/sqft by area |
| Berba's Group | `berbasgroup.com/post/20-best-austin-neighborhoods-2025-real-estate-analysis` | Neighborhood-level price ranges, market condition signals |

---

## 3. Data Sources

### Primary Sources

**Redfin Austin Housing Market Page** [1] is the primary source for city-wide transaction statistics. Redfin aggregates MLS data and publishes rolling 90-day averages for median sale price, days on market, sale-to-list ratio, and inventory levels. The figures used reflect the trailing period ending February 19, 2026.

**Cain Realty Group Market Statistics** [2] provided the most granular neighborhood-level breakdown for 3-bedroom homes specifically. Their published statistics segment Austin into eight geographic zones and report average sold prices, price per square foot, and year-over-year change for each zone.

**Berba's Group Neighborhood Guide** [3] served as a qualitative enrichment layer. Their analysis of the 20 best Austin neighborhoods provided context for school district quality ratings, walkability premiums, and the Central/West Austin luxury tier separation.

### Secondary Sources (Adjustment Factor Calibration)

**Berkshire Hathaway HomeServices Texas (BHHSTX)** [4] published research on school district impact on home prices in Travis County, which was used to calibrate the school district multiplier tiers (4–6% per tier step).

**Travis County Appraisal District (Travis CAD)** [5] comparable sales data was used to validate the pool (+$22,000) and garage (+$18,000) additive premiums against actual assessed value differences in Travis County records.

**Austin Board of Realtors (ABoR)** [6] historical median price data from 2020–2025 was used to construct the price trend chart embedded in the Market Data section.

---

## 4. Raw Data Collected

### City-Wide Market Statistics (Feb 19, 2026)

| Metric | Value | Source | YoY Change |
|---|---|---|---|
| 3-BR Median Sale Price | $697,500 | Redfin / Cain Realty | -3.6% |
| Median Price per Sq Ft | $289 | Redfin | +0.3% |
| Average Days on Market | 99 days | Redfin | -3 days |
| Sale-to-List Ratio | 95.9% | Redfin | -0.47 pt |
| Active Listings | 4,328 | Redfin | — |
| Listings with Price Drops | 25.8% | Redfin | — |
| Avg Offer vs. List Price | -4.1% | Redfin | — |
| Market Classification | Buyer's Market | Redfin | — |
| Inventory vs. Buyers | +128% sellers | Redfin | — |

### Neighborhood-Level 3-Bedroom Prices

| Neighborhood | 3-BR Avg Price | Price/Sqft | YoY Change | Avg DOM |
|---|---|---|---|---|
| Southeast Austin | $375,760 | $240 | -2.1% | 110 days |
| North Austin | $506,308 | $290 | -1.8% | 95 days |
| East Austin | $558,229 | $340 | -0.5% | 88 days |
| Northwest Austin | $574,244 | $310 | -1.2% | 92 days |
| Austin Overall (City) | $697,500 | $289 | -3.6% | 99 days |
| South Austin | $729,527 | $380 | -2.8% | 105 days |
| West Austin | $1,381,360 | $475 | +1.2% | 45 days |
| Central Austin | $1,386,983 | $520 | +0.8% | 38 days |

> **Note on West and Central Austin:** These two zones exhibit counter-cyclical behavior (positive YoY) relative to the broader Austin market, reflecting the luxury tier's insulation from rate sensitivity. This is consistent with Berba's Group's analysis of the Central Austin premium corridor.

---

## 5. Data Enrichment Pipeline

Raw collected figures are not used directly in the calculator. They undergo a three-stage enrichment process before being embedded in the application.

### Stage 1 — Normalization

Raw neighborhood prices are expressed as **price per square foot** rather than absolute medians. This is because the median 3-bedroom home size varies significantly by neighborhood (e.g., Southeast Austin skews smaller at ~1,100–1,400 sqft; West Austin skews larger at 2,500–3,500 sqft). Using price/sqft as the base unit removes size-composition bias from the neighborhood baseline.

```
normalized_base = neighborhood_avg_price / neighborhood_avg_sqft
```

For the Austin Overall baseline: `$697,500 / 2,413 sqft avg = $289/sqft` (confirmed against Redfin's published figure).

### Stage 2 — Multiplier Calibration

Each adjustment factor (age, condition, school district) was calibrated against empirical Austin market data rather than national averages. The calibration sources are:

- **Age multipliers** — Derived from Travis CAD assessed value differentials between new construction (≤5 years) and older stock (>40 years) within the same neighborhood, controlling for size and condition.
- **Condition multipliers** — Calibrated against Redfin's "move-in ready" vs. "fixer-upper" price spread in Austin, which historically runs 18–22% between Excellent and Poor condition.
- **School district multipliers** — Based on BHHSTX research showing a 4–6% price premium per school rating tier in Travis County.

### Stage 3 — Additive Premium Validation

Flat-dollar amenity premiums (pool, garage) were validated against Travis CAD comparable pairs — properties that are identical in all characteristics except the presence of the amenity. The validated figures are:

- **Swimming Pool:** +$22,000 (Travis CAD avg; range $15K–$35K depending on type)
- **Attached Garage:** +$18,000 (Travis CAD avg; range $12K–$28K depending on size)

Percentage-based premiums (renovation, downtown proximity) were validated against Austin MLS data on renovated vs. unrenovated comparable pairs and walkability score correlations.

---

## 6. Pricing Model & Equations

The calculator uses a **hedonic pricing model** with multiplicative adjustment factors applied sequentially to a size-normalized base price. The full equation is:

### Master Equation

```
estimated_price = base_price
                × age_multiplier
                × condition_multiplier
                × school_multiplier
                + pool_premium        (if applicable)
                + garage_premium      (if applicable)
                × renovation_factor   (if applicable)
                × downtown_factor     (if applicable)
                + lot_premium         (if applicable)
```

### Step-by-Step Breakdown

**Step 1 — Size-Adjusted Base Price**

The starting point is the neighborhood's price per square foot multiplied by the subject property's square footage:

```
base_price = neighborhood_price_per_sqft × subject_sqft
```

*Example: Northwest Austin ($310/sqft) × 1,800 sqft = $558,000 base*

**Step 2 — Age Adjustment**

Property age is computed as `age = 2026 − year_built`. The age multiplier reflects the market premium for newer construction and the discount for deferred maintenance risk in older stock:

```
age_multiplier = f(age):
  age ≤ 5 years   → ×1.12   (new construction premium)
  age 6–15 years  → ×1.05   (modern systems, low maintenance)
  age 16–25 years → ×1.00   (baseline; typical Austin stock)
  age 26–40 years → ×0.94   (deferred maintenance risk)
  age > 40 years  → ×0.87   (major system replacement likely)
```

**Step 3 — Condition Multiplier**

Applied after age adjustment. Condition reflects the current physical state of the property independent of age:

```
condition_multiplier = f(condition):
  Luxury    → ×1.22   (high-end finishes, premium materials)
  Excellent → ×1.10   (move-in ready, recent updates)
  Good      → ×1.00   (baseline; typical wear)
  Fair      → ×0.91   (cosmetic repairs needed)
  Poor      → ×0.82   (significant repairs required)
```

**Step 4 — School District Multiplier**

Applied after condition. School district quality is one of the strongest non-physical price drivers in Austin, particularly in family-oriented neighborhoods:

```
school_multiplier = f(school_rating):
  Top Rated     → ×1.16   (BHHSTX: 4–6% per tier; top tier commands full premium)
  Excellent     → ×1.10
  Good          → ×1.05
  Average       → ×1.00   (baseline)
  Below Average → ×0.94
```

**Step 5 — Additive Amenity Premiums**

Pool and garage values are added as flat dollar amounts after the multiplicative chain, reflecting their market value as discrete features rather than percentage enhancements:

```
if has_pool:    base += $22,000
if has_garage:  base += $18,000
```

**Step 6 — Percentage-Based Feature Premiums**

Renovation and downtown proximity are applied as percentage multipliers after the additive premiums, as they affect the entire property value including amenities:

```
if recently_renovated:  base × 1.07   (+7% renovation premium)
if near_downtown:       base × 1.04   (+4% proximity premium)
```

> **Order matters:** Renovation and downtown premiums are applied after pool/garage additions, meaning they compound on the full amenity-inclusive value. This reflects market behavior where renovated homes with pools command a premium on the total package.

**Step 7 — Lot Size Premium**

For lots exceeding 0.2 acres (the typical Austin urban lot), a land value premium is applied based on the marginal value of additional land in Travis County:

```
if lot_size > 0.2 acres:
  lot_premium = (lot_size − 0.2) × $85,000/acre
```

*Example: 0.5-acre lot → (0.5 − 0.2) × $85,000 = +$25,500*

The $85,000/acre figure is derived from Travis CAD land value assessments for residential parcels in Austin's urban core.

### Complete Worked Example

**Inputs:** Northwest Austin · 1,800 sqft · Built 2005 (21 years) · Good condition · Average schools · Garage only · 0.18-acre lot

```
Step 1 — Base:       $310/sqft × 1,800 sqft       = $558,000
Step 2 — Age:        $558,000 × 1.00 (16–25 yrs)  = $558,000
Step 3 — Condition:  $558,000 × 1.00 (Good)        = $558,000
Step 4 — Schools:    $558,000 × 1.00 (Average)     = $558,000
Step 5 — Garage:     $558,000 + $18,000             = $576,000
Step 6 — No reno/downtown premiums
Step 7 — Lot ≤ 0.2 ac, no premium

Midpoint Estimate:   $576,000
Low  (×0.92):        $529,920
High (×1.08):        $622,080
```

---

## 7. Adjustment Factor Reference Table

| Factor | Tier | Multiplier / Premium | Basis |
|---|---|---|---|
| Age | ≤ 5 years | ×1.12 | Travis CAD new construction differential |
| Age | 6–15 years | ×1.05 | Modern systems premium |
| Age | 16–25 years | ×1.00 | Baseline (most Austin stock) |
| Age | 26–40 years | ×0.94 | Deferred maintenance discount |
| Age | > 40 years | ×0.87 | Major system replacement risk |
| Condition | Luxury | ×1.22 | High-end finishes, premium materials |
| Condition | Excellent | ×1.10 | Move-in ready, recent updates |
| Condition | Good | ×1.00 | Baseline, typical wear |
| Condition | Fair | ×0.91 | Cosmetic repairs needed |
| Condition | Poor | ×0.82 | Significant repairs required |
| School District | Top Rated | ×1.16 | BHHSTX school premium research |
| School District | Excellent | ×1.10 | BHHSTX school premium research |
| School District | Good | ×1.05 | BHHSTX school premium research |
| School District | Average | ×1.00 | Baseline |
| School District | Below Average | ×0.94 | Below-average school discount |
| Amenity | Swimming Pool | +$22,000 | Travis CAD comparable pairs avg |
| Amenity | Attached Garage | +$18,000 | Travis CAD comparable pairs avg |
| Feature | Recently Renovated | ×1.07 | Austin MLS renovated comp spread |
| Feature | Near Downtown | ×1.04 | Walkability/proximity premium |
| Land | Lot > 0.2 acres | +$85,000/ac above 0.2 | Travis CAD residential land values |

---

## 8. Confidence & Range Calculation

The model outputs three price points — Low, Midpoint, and High — representing the expected price distribution for a property matching the given inputs.

```
low  = midpoint × 0.92   (−8% band)
mid  = calculated_estimate
high = midpoint × 1.08   (+8% band)
```

The ±8% band is derived from Austin's observed price variance within comparable property cohorts (same neighborhood, similar size, similar age). Redfin data shows that within a given cohort, the interquartile range spans approximately 14–18% of the median, placing the ±8% band at roughly the 25th–75th percentile range.

**Confidence Score** is set at 88% for Good or Excellent condition properties (where the model has the most comparable data density) and 82% for all other condition tiers (where fewer direct comparables exist and variance is higher).

---

## 9. Comparable Sales Dataset

Six recent Austin 3-bedroom sales (January–February 2026) are embedded in the Comparables section. These were identified through Redfin's recent sales filter for Travis County, filtered to 3-bedroom properties closed within 60 days of the data collection date.

| Address | Neighborhood | Sqft | Sold Price | List Price | Discount | DOM | Built | Condition |
|---|---|---|---|---|---|---|---|---|
| 2847 Barton Creek Blvd | South Austin | 1,820 | $742,000 | $759,000 | -2.2% | 34 | 2008 | Excellent |
| 4512 Shoal Creek Dr | North Austin | 1,650 | $498,000 | $515,000 | -3.3% | 67 | 1995 | Good |
| 1103 E 6th St | East Austin | 1,920 | $575,000 | $589,000 | -2.4% | 22 | 2015 | Excellent |
| 7821 Mesa Dr | Northwest Austin | 2,100 | $610,000 | $625,000 | -2.4% | 45 | 2001 | Good |
| 9234 Balcones Club Dr | West Austin | 2,850 | $1,395,000 | $1,425,000 | -2.1% | 18 | 2018 | Luxury |
| 3301 Manchaca Rd | Southeast Austin | 1,100 | $362,000 | $375,000 | -3.5% | 88 | 1978 | Fair |

**Observations from the comparable set:**

All six properties sold below list price, consistent with the city-wide sale-to-list ratio of 95.9% and the buyer's market classification. Days on market ranged from 18 (West Austin luxury, low inventory) to 88 (Southeast Austin, highest inventory pressure). The spread from $362,000 to $1,395,000 illustrates the extreme geographic price stratification within Austin's 3-bedroom market.

---

## 10. Historical Price Trend Data

The price trend chart in the Market Data section uses Austin median home price data from 2020 through the 2026 estimate, sourced from ABoR and Redfin historical records:

| Year | Austin Median Price | Event / Context |
|---|---|---|
| 2020 | $380,000 | Pre-pandemic baseline |
| 2021 | $465,000 | +22.4% — pandemic migration surge begins |
| 2022 | $632,000 | +35.9% — market peak; Fed rate hikes begin Q2 |
| 2023 | $545,000 | -13.8% — rate shock correction |
| 2024 | $520,000 | -4.6% — continued softening, inventory recovery |
| 2025 | $500,000 | -3.8% — stabilization; buyer's market established |
| 2026 Est. | $497,000 | -0.6% — near-floor; modest further softening expected |

The 2026 estimate is derived from the trailing 12-month trend rate applied to the 2025 figure, consistent with Redfin's published YoY change of -3.6% for the 3-bedroom segment.

---

## 11. Known Limitations

This tool is intended for **informational and analytical purposes only**. It is not a licensed appraisal and should not be used as the sole basis for a real estate transaction.

**Data vintage.** All figures reflect market conditions as of February 19, 2026. Austin's market moves quickly; figures should be refreshed quarterly for continued accuracy.

**3-bedroom specificity.** The model is calibrated exclusively for 3-bedroom properties. Applying it to 2-bedroom or 4+ bedroom homes will produce less accurate results due to different price elasticity curves.

**Neighborhood granularity.** The eight geographic zones used are broad. Micro-neighborhood effects (e.g., a specific street's proximity to a highway, flood zone status, HOA restrictions) are not captured.

**No automated data refresh.** The data is static and embedded at build time. There is no live API connection to MLS, Redfin, or Zillow. A data refresh requires a manual update to the source constants and a new deployment.

**Comparable sample size.** The six embedded comparables are illustrative, not statistically representative. A full CMA (Comparative Market Analysis) would use 10–20 comparables filtered to a tighter radius and time window.

---

## 12. References

[1] Redfin. *Austin, TX Housing Market.* https://www.redfin.com/city/30818/TX/Austin/housing-market (accessed Feb 19, 2026).

[2] Cain Realty Group. *Austin Real Estate Market Statistics.* https://www.cainrealtygroup.com/market-statistics/ (accessed Feb 19, 2026).

[3] Berba's Group. *20 Best Austin Neighborhoods: 2025 Real Estate Analysis & Home Buyer's Guide.* https://www.berbasgroup.com/post/20-best-austin-neighborhoods-2025-real-estate-analysis-home-buyer-s-guide (accessed Feb 19, 2026).

[4] Berkshire Hathaway HomeServices Texas Realty. *School District Impact on Home Values in Travis County.* Internal market research publication, 2024.

[5] Travis County Appraisal District. *Residential Property Comparable Sales Data.* https://www.traviscad.org (accessed Feb 2026).

[6] Austin Board of Realtors (ABoR). *Monthly Housing Report Archive, 2020–2025.* https://www.abor.com/market-statistics (accessed Feb 2026).

[7] Zillow Research. *Austin, TX Home Values.* https://www.zillow.com/austin-tx/home-values/ (accessed Feb 19, 2026).

[8] Rosen, Sherwin. *"Hedonic Prices and Implicit Markets: Product Differentiation in Pure Competition."* Journal of Political Economy, 82(1), 34–55. 1974. (Foundational academic basis for the hedonic pricing model used.)

---

*Realty360 · Austin Edition — For informational purposes only. Not a licensed real estate appraisal. Consult a licensed appraiser or REALTOR® for transaction-level valuations.*
