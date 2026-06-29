/*
 * Realty360 comparables landing — address + radius search with mile-bucketed results.
 */

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
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
import { ComparablesResults } from "@/components/comparables/ComparablesResults";
import {
  fetchAddressSuggestions,
  fetchComparablesByRadius,
  PropertiesApiError,
  validatePropertyAddress,
  type ComparablesByRadiusResponse,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparablesByRadiusResponse | null>(null);

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

      const data = await fetchComparablesByRadius(trimmed, radius, {
        maxAgeMonths:
          maxAgeMonths === "all" ? undefined : Number(maxAgeMonths),
      });
      setResult(data);
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
          Enter address and search radius to get comparables now.
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
            <ComparablesResults result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
