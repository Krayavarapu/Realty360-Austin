/*
 * Realty360 comparables landing — address + radius search with mile-bucketed results.
 */

import { useState } from "react";
import { Calculator, MapPin, Search } from "lucide-react";
import type { FlipPredictionResponse } from "@shared/flip/prediction-types";
import type { RehabScopeTier } from "@shared/flip/types";
import {
  REHAB_SCOPE_TIERS,
  TRAVIS_COUNTY_FLIP_DEAL_CONFIG,
} from "@shared/flip/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressSuggestInput } from "@/components/comparables/AddressSuggestInput";
import { UnifiedComparablesResults } from "@/components/comparables/UnifiedComparablesResults";
import { FlipPredictionResults } from "@/components/flip/FlipPredictionResults";
import { FlipApiError, predictFlip } from "@/lib/api/flip";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAddressSuggestions,
  fetchUnifiedComparables,
  PropertiesApiError,
  validatePropertyAddress,
  type UnifiedComparablesResponse,
} from "@/lib/api/properties";

const HERO_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/1DlYSznHYSnoXaKX1xBh6g/sandbox/h71TOFzlgb1kod8VBhW40s-img-1_1771540452000_na1fn_YXVzdGluLWhlcm8tYmx1ZXByaW50.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMURsWVN6bkhZU25vWGFLWDF4Qmg2Zy9zYW5kYm94L2g3MVRPRnpsZ2Ixa29kOFZCaFc0MHMtaW1nLTFfMTc3MTU0MDQ1MjAwMF9uYTFmbl9ZWFZ6ZEdsdUxXaGxjbTh0WW14MVpYQnlhVzUwLmpwZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=fqvBa8FEcSgYSqYUIULQj3KwgEpXsOQOKsAI4bQ3DQhthV7TkIeTbuMINU8FhQjWALkcadbb4mVfkeC0pWffpkOVlurOBv263b4DN9GfxmDRmHq8S4ca6MIaQg5nAd0asSl06cYZFL15hEZYgx2Qwy1wT7Jz0hTbKDcx36Zs8W-bXPcLJCyQe7vLvDuQLByVh8iTuTIAN2M8vymS6MvgdOGCPf4m6QHjVnT84GBmPq3el9p9sCdCJLbkGBcWWO5XwwWDN8AjUw51rt6OS0ZJ7qAb3pLdRKkizpWQMSqt6xPKwgsv6Eutgjxc6bRiVf4ynpUzXAsCCsYFw-NaBbJssA__";

const RECENCY_OPTIONS = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
  { value: "all", label: "All closed sales" },
] as const;

export default function ComparablesLanding() {
  const [address, setAddress] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("2");
  const [maxAgeMonths, setMaxAgeMonths] = useState("12");
  const [includeTcad, setIncludeTcad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnifiedComparablesResponse | null>(null);

  const [purchasePrice, setPurchasePrice] = useState("");
  const [scopeTier, setScopeTier] = useState<RehabScopeTier>("moderate");
  const [livingAreaSqftOverride, setLivingAreaSqftOverride] = useState("");
  const [flipLoading, setFlipLoading] = useState(false);
  const [flipError, setFlipError] = useState<string | null>(null);
  const [flipResult, setFlipResult] = useState<FlipPredictionResponse | null>(
    null,
  );
  const [resultsTab, setResultsTab] = useState<"comparables" | "flip">(
    "comparables",
  );

  const [selectedPropId, setSelectedPropId] = useState<number | null>(null);

  async function runComparablesSearch(
    trimmed: string,
    radius: number,
    propId?: number | null,
  ) {
    const data = await fetchUnifiedComparables(trimmed, radius, {
      propId: propId ?? undefined,
      maxAgeMonths:
        maxAgeMonths === "all" ? undefined : Number(maxAgeMonths),
      includeTcad,
    });
    setResult(data);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = address.trim();
    const radius = Number(radiusMiles);
    if (!trimmed) {
      setError("Please enter an address.");
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      setError("Search radius must be a positive number.");
      return;
    }

    if (trimmed.length < 2) {
      setError("Enter at least 2 characters to search for an address.");
      return;
    }

    setFlipResult(null);
    setFlipError(null);
    setResultsTab("comparables");
    setSelectedPropId(null);
    setLoading(true);
    try {
      const { suggestions } = await fetchAddressSuggestions(trimmed, { limit: 10 });
      if (suggestions.length === 0) {
        const valid = await validatePropertyAddress(trimmed);
        if (!valid) {
          setResult(null);
          setError(
            "No matching address found in the MLS database. Choose an address from the dropdown suggestions.",
          );
          return;
        }
      }

      await runComparablesSearch(trimmed, radius);
    } catch (err) {
      setResult(null);
      if (err instanceof PropertiesApiError) {
        setError(err.message);
      } else {
        setError("Failed to fetch comparables. Is the API server running?");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPropId(propId: number | null) {
    setSelectedPropId(propId);
    if (!address.trim()) return;

    const radius = Number(radiusMiles);
    if (!Number.isFinite(radius) || radius <= 0) return;

    setError(null);
    setLoading(true);
    try {
      await runComparablesSearch(address.trim(), radius, propId);
    } catch (err) {
      if (err instanceof PropertiesApiError) {
        setError(err.message);
      } else {
        setError("Failed to refresh comparables for selected parcel.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFlipAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setFlipError(null);

    const trimmed = address.trim();
    const radius = Number(radiusMiles);
    const price = Number(purchasePrice.replace(/,/g, ""));
    const sqftOverride = livingAreaSqftOverride.trim()
      ? Number(livingAreaSqftOverride.replace(/,/g, ""))
      : undefined;

    if (!trimmed) {
      setFlipError("Enter an address before running flip analysis.");
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      setFlipError("Search radius must be a positive number.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setFlipError("Enter a valid purchase price.");
      return;
    }
    if (
      sqftOverride != null &&
      (!Number.isFinite(sqftOverride) || sqftOverride <= 0)
    ) {
      setFlipError("Living area override must be a positive number.");
      return;
    }

    setFlipLoading(true);
    try {
      const data = await predictFlip({
        address: trimmed,
        purchasePrice: price,
        scopeTier,
        radiusMiles: radius,
        maxAgeMonths:
          maxAgeMonths === "all" ? undefined : Number(maxAgeMonths),
        livingAreaSqft: sqftOverride,
      });
      setFlipResult(data);
    } catch (err) {
      setFlipResult(null);
      if (err instanceof FlipApiError) {
        setFlipError(err.message);
      } else {
        setFlipError("Failed to run flip analysis. Is the API server running?");
      }
    } finally {
      setFlipLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative h-[320px] md:h-[380px] overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Austin TX skyline"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 via-navy-950/40 to-background" />
        <div className="absolute inset-0 blueprint-grid opacity-20" />

        <div className="relative z-10 h-full flex flex-col justify-end pb-10 px-6 md:px-12 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-amber-400" />
            <span className="section-label text-amber-400/80">
              Austin, Texas · Travis County
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Realty360
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <p
          className="text-base text-muted-foreground mb-6"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          Enter address and search radius to get closed sales, active listings,
          and optional nearby tax parcels.
        </p>

        <form onSubmit={handleSearch} className="blueprint-card p-6 space-y-5">
          <AddressSuggestInput
            value={address}
            onChange={setAddress}
            disabled={loading}
          />

          <div className="space-y-2">
            <Label htmlFor="radius">Search radius (mi)</Label>
            <Input
              id="radius"
              type="number"
              min={0.1}
              step={0.1}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(e.target.value)}
              className="font-mono text-sm max-w-[160px]"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recency">Sale recency</Label>
            <Select
              value={maxAgeMonths}
              onValueChange={setMaxAgeMonths}
              disabled={loading}
            >
              <SelectTrigger id="recency" className="max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="include-tcad"
              checked={includeTcad}
              onCheckedChange={(checked) => setIncludeTcad(checked === true)}
              disabled={loading}
              className="mt-0.5 size-4 border-amber-400/80 bg-secondary/60 data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-400 data-[state=checked]:text-navy-950 dark:bg-secondary/60"
            />
            <div className="grid gap-1 leading-none">
              <Label
                htmlFor="include-tcad"
                className="text-sm font-medium cursor-pointer"
              >
                Include nearby tax parcels (TCAD)
              </Label>
              <p className="text-xs text-muted-foreground">
                Tax appraised values are reference only — not sale comparables.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-400 text-navy-950 hover:bg-amber-400/90 font-semibold"
          >
            <Search size={16} className="mr-2" />
            {loading ? "Searching…" : "Generate Comparables"}
          </Button>

          {error && (
            <p className="text-sm text-red-400 border border-red-400/30 bg-red-400/10 rounded px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {result && (
          <div className="mt-10">
            <Tabs
              value={resultsTab}
              onValueChange={(v) =>
                setResultsTab(v as "comparables" | "flip")
              }
              className="gap-6"
            >
              <TabsList className="w-full max-w-md bg-secondary/50 border border-border h-10 p-1">
                <TabsTrigger value="comparables" className="flex-1">
                  Comparables
                </TabsTrigger>
                <TabsTrigger value="flip" className="flex-1">
                  Flip analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comparables" className="mt-0">
                <UnifiedComparablesResults
                  result={result}
                  selectedPropId={selectedPropId}
                  onSelectPropId={handleSelectPropId}
                />
              </TabsContent>

              <TabsContent value="flip" className="mt-0 space-y-5">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Flip analysis
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Uses the same address, radius, and sale recency above. Enter
                    your acquisition price and rehab scope to estimate ARV,
                    costs, and margins.
                  </p>
                </div>

                <form
                  onSubmit={handleFlipAnalysis}
                  className="blueprint-card p-6 space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="purchase-price">Purchase price</Label>
                    <Input
                      id="purchase-price"
                      type="text"
                      inputMode="numeric"
                      placeholder="350000"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="font-mono text-sm max-w-[220px]"
                      disabled={flipLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your offer or acquisition price — not pulled from MLS.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope-tier">Rehab scope</Label>
                    <Select
                      value={scopeTier}
                      onValueChange={(v) => setScopeTier(v as RehabScopeTier)}
                      disabled={flipLoading}
                    >
                      <SelectTrigger id="scope-tier" className="max-w-[320px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REHAB_SCOPE_TIERS.map((tier) => {
                          const cfg =
                            TRAVIS_COUNTY_FLIP_DEAL_CONFIG.rehabTiers[tier];
                          return (
                            <SelectItem key={tier} value={tier}>
                              {cfg.label} — ${cfg.costPerSqft}/sqft
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        TRAVIS_COUNTY_FLIP_DEAL_CONFIG.rehabTiers[scopeTier]
                          .shortDescription
                      }
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sqft-override">
                      Living area override (sqft, optional)
                    </Label>
                    <Input
                      id="sqft-override"
                      type="text"
                      inputMode="numeric"
                      placeholder="Leave blank to use TCAD / MLS"
                      value={livingAreaSqftOverride}
                      onChange={(e) =>
                        setLivingAreaSqftOverride(e.target.value)
                      }
                      className="font-mono text-sm max-w-[220px]"
                      disabled={flipLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={flipLoading}
                    variant="outline"
                    className="border-amber-400/50 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
                  >
                    <Calculator size={16} className="mr-2" />
                    {flipLoading ? "Analyzing…" : "Run flip analysis"}
                  </Button>

                  {flipError && (
                    <p className="text-sm text-red-400 border border-red-400/30 bg-red-400/10 rounded px-3 py-2">
                      {flipError}
                    </p>
                  )}
                </form>

                {flipResult && <FlipPredictionResults result={flipResult} />}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
