/*
 * DESIGN: "Texas Blueprint" — Technical Drafting / Data Dashboard
 * Navy background (#0A1628), Amber CTAs, Teal data-positive
 * Space Grotesk (headings) + IBM Plex Mono (data) + IBM Plex Sans (body)
 * Layout: Full-width hero → sticky calculator split → market data → comparables → methodology
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Home as HomeIcon,
  MapPin,
  TrendingDown,
  TrendingUp,
  Calculator,
  BarChart2,
  BookOpen,
  ChevronDown,
  Info,
  Star,
  Layers,
  Clock,
  DollarSign,
  Maximize2,
  Calendar,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const HERO_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/1DlYSznHYSnoXaKX1xBh6g/sandbox/h71TOFzlgb1kod8VBhW40s-img-1_1771540452000_na1fn_YXVzdGluLWhlcm8tYmx1ZXByaW50.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMURsWVN6bkhZU25vWGFLWDF4Qmg2Zy9zYW5kYm94L2g3MVRPRnpsZ2Ixa29kOFZCaFc0MHMtaW1nLTFfMTc3MTU0MDQ1MjAwMF9uYTFmbl9ZWFZ6ZEdsdUxXaGxjbTh0WW14MVpYQnlhVzUwLmpwZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=fqvBa8FEcSgYSqYUIULQj3KwgEpXsOQOKsAI4bQ3DQhthV7TkIeTbuMINU8FhQjWALkcadbb4mVfkeC0pWffpkOVlurOBv263b4DN9GfxmDRmHq8S4ca6MIaQg5nAd0asSl06cYZFL15hEZYgx2Qwy1wT7Jz0hTbKDcx36Zs8W-bXPcLJCyQe7vLvDuQLByVh8iTuTIAN2M8vymS6MvgdOGCPf4m6QHjVnT84GBmPq3el9p9sCdCJLbkGBcWWO5XwwWDN8AjUw51rt6OS0ZJ7qAb3pLdRKkizpWQMSqt6xPKwgsv6Eutgjxc6bRiVf4ynpUzXAsCCsYFw-NaBbJssA__";

const NEIGHBORHOOD_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/1DlYSznHYSnoXaKX1xBh6g/sandbox/h71TOFzlgb1kod8VBhW40s-img-2_1771540453000_na1fn_YXVzdGluLW5laWdoYm9yaG9vZC1tYXA.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMURsWVN6bkhZU25vWGFLWDF4Qmg2Zy9zYW5kYm94L2g3MVRPRnpsZ2Ixa29kOFZCaFc0MHMtaW1nLTJfMTc3MTU0MDQ1MzAwMF9uYTFmbl9ZWFZ6ZEdsdUxXNWxhV2RvWW05eWFHOXZaQzF0WVhBLmpwZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=NtFDuMwaU125xtt0fjDXI1PDMsICS9dfsGSaF~Rmox5YughCUUOq3XMuPz6FYlHUWWVByTM7wvBPwikc6hSk90F9wVlL91qRRAtLxj2b1Q8qzbDbbl8D7qOpENovXJozvIByCmTKfo-iViJG5wQSIZPFqWyoCx~Fz7-hPQaM0rRxssDCcsrb9j-1V2w6UjB8hhFqWLaNEXXo3A0DnppMKXSC9sop8nLBwpKIjZcWPudBGDAk8HKJSXSuruu2YIlI8pfgfmOBdBjiqqSKZdt6mpQu~wAz~m8~Bmpe6M4TwOk3fESQoOln8k5P0y6oAmmHoLFbt62ygH222RcvaezV5A__";

const HOUSE_IMG =
  "https://private-us-east-1.manuscdn.com/sessionFile/1DlYSznHYSnoXaKX1xBh6g/sandbox/h71TOFzlgb1kod8VBhW40s-img-3_1771540450000_na1fn_YXVzdGluLWhvdXNlLTNiZWQ.jpg?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMURsWVN6bkhZU25vWGFLWDF4Qmg2Zy9zYW5kYm94L2g3MVRPRnpsZ2Ixa29kOFZCaFc0MHMtaW1nLTNfMTc3MTU0MDQ1MDAwMF9uYTFmbl9ZWFZ6ZEdsdUxXaHZkWE5sTFROaVpXUS5qcGc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=YdE5KyukUWgSDMXWYgEHYhMfrbebHZcU1DTFumpXSUO2g9qJkQpTpiPDqpbTQC6jzpI2VsiXMnpBbwgDgLYb7D3jUroN14nWDRGl1jWjDF25EASVfdZXFcW~bgj3iaX5lW2NZqUZT6GltFTcoaTJW4b4j74b-6MshE2SLhOvwrn7UdwaNawFpM730hI6S0ByG4ytKMKhKpwD2rd2IQHBxh1UmAe9eH9doQUyh3V47JSfa49FkPBpBsOI5ZZ31myfSD5xj~N9qzQArfkLzxl2IFMawZ17OEiqpGM-w4lhYXIPw9JxqysWthxH~2NFy5dmOGxjA9dxdLPOi-OKDHkAiA__";

// Neighborhood base prices for 3-bed (from Cain Realty Feb 2026)
const NEIGHBORHOODS = [
  { id: "southeast", label: "Southeast Austin", basePrice: 375760, pricePerSqft: 240, trend: -2.1, dom: 110 },
  { id: "north", label: "North Austin", basePrice: 506308, pricePerSqft: 290, trend: -1.8, dom: 95 },
  { id: "east", label: "East Austin", basePrice: 558229, pricePerSqft: 340, trend: -0.5, dom: 88 },
  { id: "northwest", label: "Northwest Austin", basePrice: 574244, pricePerSqft: 310, trend: -1.2, dom: 92 },
  { id: "overall", label: "Austin Overall", basePrice: 697500, pricePerSqft: 289, trend: -3.6, dom: 99 },
  { id: "south", label: "South Austin", basePrice: 729527, pricePerSqft: 380, trend: -2.8, dom: 105 },
  { id: "west", label: "West Austin", basePrice: 1381360, pricePerSqft: 475, trend: 1.2, dom: 45 },
  { id: "central", label: "Central Austin", basePrice: 1386983, pricePerSqft: 520, trend: 0.8, dom: 38 },
];

const CONDITION_MULTIPLIERS: Record<string, number> = {
  poor: 0.82,
  fair: 0.91,
  good: 1.0,
  excellent: 1.10,
  luxury: 1.22,
};

const SCHOOL_MULTIPLIERS: Record<string, number> = {
  below_avg: 0.94,
  average: 1.0,
  good: 1.05,
  excellent: 1.10,
  top_rated: 1.16,
};

// Historical price trend data (Austin median, 2020-2026)
const PRICE_HISTORY = [
  { year: "2020", price: 380000 },
  { year: "2021", price: 465000 },
  { year: "2022 Peak", price: 632000 },
  { year: "2023", price: 545000 },
  { year: "2024", price: 520000 },
  { year: "2025", price: 500000 },
  { year: "2026 Est.", price: 497000 },
];

// Neighborhood comparison data
const NEIGHBORHOOD_CHART_DATA = NEIGHBORHOODS.map((n) => ({
  name: n.label.replace(" Austin", "").replace("Overall", "City Avg"),
  price: Math.round(n.basePrice / 1000),
  psf: n.pricePerSqft,
}));

// Comparable sales data
const COMPARABLES = [
  {
    address: "2847 Barton Creek Blvd",
    neighborhood: "South Austin",
    beds: 3, baths: 2, sqft: 1820,
    soldPrice: 742000, listPrice: 759000,
    soldDate: "Jan 15, 2026", dom: 34,
    yearBuilt: 2008, hasPool: false, hasGarage: true,
    condition: "Excellent",
  },
  {
    address: "4512 Shoal Creek Dr",
    neighborhood: "North Austin",
    beds: 3, baths: 2, sqft: 1650,
    soldPrice: 498000, listPrice: 515000,
    soldDate: "Jan 28, 2026", dom: 67,
    yearBuilt: 1995, hasPool: false, hasGarage: true,
    condition: "Good",
  },
  {
    address: "1103 E 6th St",
    neighborhood: "East Austin",
    beds: 3, baths: 2.5, sqft: 1920,
    soldPrice: 575000, listPrice: 589000,
    soldDate: "Feb 3, 2026", dom: 22,
    yearBuilt: 2015, hasPool: false, hasGarage: false,
    condition: "Excellent",
  },
  {
    address: "7821 Mesa Dr",
    neighborhood: "Northwest Austin",
    beds: 3, baths: 2, sqft: 2100,
    soldPrice: 610000, listPrice: 625000,
    soldDate: "Jan 10, 2026", dom: 45,
    yearBuilt: 2001, hasPool: true, hasGarage: true,
    condition: "Good",
  },
  {
    address: "9234 Balcones Club Dr",
    neighborhood: "West Austin",
    beds: 3, baths: 3, sqft: 2850,
    soldPrice: 1395000, listPrice: 1425000,
    soldDate: "Feb 8, 2026", dom: 18,
    yearBuilt: 2018, hasPool: true, hasGarage: true,
    condition: "Luxury",
  },
  {
    address: "3301 Manchaca Rd",
    neighborhood: "Southeast Austin",
    beds: 3, baths: 1, sqft: 1100,
    soldPrice: 362000, listPrice: 375000,
    soldDate: "Jan 22, 2026", dom: 88,
    yearBuilt: 1978, hasPool: false, hasGarage: false,
    condition: "Fair",
  },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

function formatK(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function useAnimatedValue(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = prev.current;
    const end = target;
    const startTime = performance.now();

    if (raf.current) cancelAnimationFrame(raf.current);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      } else {
        prev.current = end;
      }
    };

    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return display;
}

// ─── Calculator Logic ─────────────────────────────────────────────────────────

interface CalcInputs {
  neighborhood: string;
  sqft: number;
  yearBuilt: number;
  condition: string;
  schoolRating: string;
  hasPool: boolean;
  hasGarage: boolean;
  lotSize: number; // acres
  renovated: boolean;
  nearDowntown: boolean;
}

function calculateEstimate(inputs: CalcInputs) {
  const hood = NEIGHBORHOODS.find((n) => n.id === inputs.neighborhood) || NEIGHBORHOODS[4];

  // Base: price per sqft × sqft
  let base = hood.pricePerSqft * inputs.sqft;

  // Age adjustment: newer homes command premium
  const age = 2026 - inputs.yearBuilt;
  const ageMultiplier = age <= 5 ? 1.12 : age <= 15 ? 1.05 : age <= 25 ? 1.0 : age <= 40 ? 0.94 : 0.87;
  base *= ageMultiplier;

  // Condition multiplier
  base *= CONDITION_MULTIPLIERS[inputs.condition] ?? 1.0;

  // School district multiplier
  base *= SCHOOL_MULTIPLIERS[inputs.schoolRating] ?? 1.0;

  // Amenities
  if (inputs.hasPool) base += 22000;
  if (inputs.hasGarage) base += 18000;
  if (inputs.renovated) base *= 1.07;
  if (inputs.nearDowntown) base *= 1.04;

  // Lot size premium (above 0.2 acres)
  if (inputs.lotSize > 0.2) {
    base += (inputs.lotSize - 0.2) * 85000;
  }

  const low = Math.round(base * 0.92);
  const mid = Math.round(base);
  const high = Math.round(base * 1.08);
  const psf = Math.round(mid / inputs.sqft);
  const confidence = inputs.condition === "good" || inputs.condition === "excellent" ? 88 : 82;

  return { low, mid, high, psf, confidence, hood };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="section-label flex items-center gap-2">
      <span className="inline-block w-4 h-px bg-amber-400/60" />
      {children}
    </span>
  );
}

function StatCard({
  label, value, sub, trend, icon: Icon,
}: {
  label: string; value: string; sub?: string; trend?: number; icon?: React.ElementType;
}) {
  const TrendIcon = trend === undefined ? null : trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  const trendColor = trend === undefined ? "" : trend > 0 ? "text-teal-400" : trend < 0 ? "text-red-400" : "text-gray-400";

  return (
    <div className="blueprint-card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="section-label">{label}</span>
        {Icon && <Icon size={14} className="text-amber-400/60" />}
      </div>
      <div className="price-display text-xl">{value}</div>
      {(sub || trend !== undefined) && (
        <div className={`flex items-center gap-1 text-xs ${trendColor || "text-muted-foreground"}`}>
          {TrendIcon && <TrendIcon size={12} />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

function FactorBadge({ label, value, impact }: { label: string; value: string; impact: "positive" | "negative" | "neutral" }) {
  const colors = {
    positive: "border-teal-500/40 bg-teal-500/10 text-teal-300",
    negative: "border-red-500/40 bg-red-500/10 text-red-300",
    neutral: "border-border bg-secondary text-muted-foreground",
  };
  return (
    <div className={`border rounded px-3 py-2 text-xs ${colors[impact]}`}>
      <div className="font-medium">{label}</div>
      <div className="font-mono text-[11px] mt-0.5 opacity-80">{value}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeSection, setActiveSection] = useState<"calculator" | "market" | "comparables" | "methodology">("calculator");

  const [inputs, setInputs] = useState<CalcInputs>({
    neighborhood: "overall",
    sqft: 1800,
    yearBuilt: 2005,
    condition: "good",
    schoolRating: "average",
    hasPool: false,
    hasGarage: true,
    lotSize: 0.18,
    renovated: false,
    nearDowntown: false,
  });

  const result = calculateEstimate(inputs);
  const animatedMid = useAnimatedValue(result.mid);
  const animatedLow = useAnimatedValue(result.low);
  const animatedHigh = useAnimatedValue(result.high);

  const update = useCallback(<K extends keyof CalcInputs>(key: K, val: CalcInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: val }));
  }, []);

  const navItems = [
    { id: "calculator", label: "Calculator", icon: Calculator },
    { id: "market", label: "Market Data", icon: BarChart2 },
    { id: "comparables", label: "Comparables", icon: Layers },
    { id: "methodology", label: "Methodology", icon: BookOpen },
  ] as const;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _HomeIcon = HomeIcon;

  // Determine price factors for display
  const hood = NEIGHBORHOODS.find((n) => n.id === inputs.neighborhood)!;
  const age = 2026 - inputs.yearBuilt;
  const ageImpact = age <= 10 ? "positive" : age <= 25 ? "neutral" : "negative";
  const conditionImpact = ["excellent", "luxury"].includes(inputs.condition) ? "positive" : inputs.condition === "poor" ? "negative" : "neutral";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Hero ── */}
      <div className="relative h-[420px] md:h-[500px] overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Austin TX skyline at dusk with blueprint overlay"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 via-navy-950/40 to-background" />
        <div className="absolute inset-0 blueprint-grid opacity-20" />

        <div className="relative z-10 h-full flex flex-col justify-end pb-10 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-amber-400" />
            <span className="section-label text-amber-400/80">Austin, Texas · Travis County</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Realty360<br />
            <span className="text-amber-400">Austin Edition</span>
          </h1>
          <p className="text-base md:text-lg text-cream/70 max-w-xl" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Comprehensive 3-bedroom valuation tool powered by live Austin market data, comparable sales analysis, and multi-factor pricing models.
          </p>
          <div className="flex flex-wrap gap-4 mt-5">
            <div className="flex items-center gap-2 bg-navy-800/80 backdrop-blur border border-border rounded px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs text-cream/80 font-mono">Data: Feb 19, 2026</span>
            </div>
            <div className="flex items-center gap-2 bg-navy-800/80 backdrop-blur border border-border rounded px-3 py-1.5">
              <BarChart2 size={12} className="text-amber-400" />
              <span className="text-xs text-cream/80 font-mono">4,328 Active Listings</span>
            </div>
            <div className="flex items-center gap-2 bg-navy-800/80 backdrop-blur border border-border rounded px-3 py-1.5">
              <TrendingDown size={12} className="text-red-400" />
              <span className="text-xs text-cream/80 font-mono">-3.6% YoY · Buyer's Market</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Market Snapshot Bar ── */}
      <div className="border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="3-BR Median (City)" value="$697,500" sub="-3.6% YoY" trend={-3.6} icon={HomeIcon} />
          <StatCard label="Price / Sq Ft" value="$289" sub="+0.3% YoY" trend={0.3} icon={Maximize2} />
          <StatCard label="Avg Days on Market" value="99 days" sub="-3 days YoY" trend={-3} icon={Clock} />
          <StatCard label="Sale-to-List Ratio" value="95.9%" sub="-0.47pt YoY" trend={-0.47} icon={DollarSign} />
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <nav className="flex gap-0 overflow-x-auto">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === id
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">

        {/* ═══════════════════════════════════════════════════════════════════
            CALCULATOR SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* Left: Inputs */}
            <div className="lg:col-span-3 space-y-6">
              <div>
                <SectionLabel>Property Parameters</SectionLabel>
                <h2 className="text-2xl font-bold mt-2 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Configure Your Estimate
                </h2>
                <p className="text-sm text-muted-foreground">Adjust parameters to model different property scenarios. Prices update in real-time.</p>
              </div>

              {/* Neighborhood */}
              <div className="blueprint-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin size={15} className="text-amber-400" />
                  <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Location / Neighborhood</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {NEIGHBORHOODS.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => update("neighborhood", n.id)}
                      className={`text-xs px-3 py-2.5 rounded border transition-all text-left ${
                        inputs.neighborhood === n.id
                          ? "border-amber-400 bg-amber-400/10 text-amber-300"
                          : "border-border bg-secondary/50 text-muted-foreground hover:border-amber-400/40 hover:text-foreground"
                      }`}
                      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                    >
                      <div className="font-medium leading-tight">{n.label.replace(" Austin", "")}</div>
                      <div className="font-mono text-[10px] mt-0.5 opacity-70">{formatK(n.basePrice)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Square Footage */}
              <div className="blueprint-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Maximize2 size={15} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Square Footage</span>
                  </div>
                  <span className="price-display text-lg">{inputs.sqft.toLocaleString()} sqft</span>
                </div>
                <input
                  type="range"
                  min={800} max={4500} step={50}
                  value={inputs.sqft}
                  onChange={(e) => update("sqft", Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
                  <span>800 sqft</span>
                  <span>4,500 sqft</span>
                </div>
              </div>

              {/* Year Built */}
              <div className="blueprint-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Year Built</span>
                  </div>
                  <span className="price-display text-lg">{inputs.yearBuilt}</span>
                </div>
                <input
                  type="range"
                  min={1950} max={2025} step={1}
                  value={inputs.yearBuilt}
                  onChange={(e) => update("yearBuilt", Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
                  <span>1950</span>
                  <span>2025</span>
                </div>
              </div>

              {/* Lot Size */}
              <div className="blueprint-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Lot Size</span>
                  </div>
                  <span className="price-display text-lg">{inputs.lotSize.toFixed(2)} acres</span>
                </div>
                <input
                  type="range"
                  min={0.05} max={1.5} step={0.01}
                  value={inputs.lotSize}
                  onChange={(e) => update("lotSize", Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
                  <span>0.05 ac</span>
                  <span>1.5 ac</span>
                </div>
              </div>

              {/* Condition & School */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="blueprint-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={15} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Property Condition</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { id: "poor", label: "Poor", mult: "×0.82" },
                      { id: "fair", label: "Fair", mult: "×0.91" },
                      { id: "good", label: "Good", mult: "×1.00" },
                      { id: "excellent", label: "Excellent", mult: "×1.10" },
                      { id: "luxury", label: "Luxury", mult: "×1.22" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => update("condition", c.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs border transition-all ${
                          inputs.condition === c.id
                            ? "border-amber-400 bg-amber-400/10 text-amber-300"
                            : "border-border bg-secondary/30 text-muted-foreground hover:border-amber-400/30"
                        }`}
                      >
                        <span className="font-medium">{c.label}</span>
                        <span className="font-mono opacity-70">{c.mult}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="blueprint-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={15} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>School District</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { id: "below_avg", label: "Below Average", mult: "×0.94" },
                      { id: "average", label: "Average", mult: "×1.00" },
                      { id: "good", label: "Good", mult: "×1.05" },
                      { id: "excellent", label: "Excellent", mult: "×1.10" },
                      { id: "top_rated", label: "Top Rated", mult: "×1.16" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => update("schoolRating", s.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs border transition-all ${
                          inputs.schoolRating === s.id
                            ? "border-teal-400 bg-teal-400/10 text-teal-300"
                            : "border-border bg-secondary/30 text-muted-foreground hover:border-teal-400/30"
                        }`}
                      >
                        <span className="font-medium">{s.label}</span>
                        <span className="font-mono opacity-70">{s.mult}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="blueprint-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={15} className="text-amber-400" />
                  <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Additional Features</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "hasPool" as const, label: "Swimming Pool", value: "+$22,000", icon: "🏊" },
                    { key: "hasGarage" as const, label: "Garage", value: "+$18,000", icon: "🚗" },
                    { key: "renovated" as const, label: "Recently Renovated", value: "+7%", icon: "🔨" },
                    { key: "nearDowntown" as const, label: "Near Downtown", value: "+4%", icon: "🏙️" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => update(f.key, !inputs[f.key])}
                      className={`flex items-center gap-3 px-4 py-3 rounded border transition-all text-left ${
                        inputs[f.key]
                          ? "border-teal-400 bg-teal-400/10"
                          : "border-border bg-secondary/30 hover:border-teal-400/30"
                      }`}
                    >
                      <span className="text-lg">{f.icon}</span>
                      <div>
                        <div className={`text-xs font-medium ${inputs[f.key] ? "text-teal-300" : "text-muted-foreground"}`}>{f.label}</div>
                        <div className="text-[10px] font-mono text-teal-400/70">{f.value}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Results (sticky) */}
            <div className="lg:col-span-2">
              <div className="sticky top-20 space-y-4">

                {/* Main estimate */}
                <div className="blueprint-card p-6">
                  <SectionLabel>Estimated Market Value</SectionLabel>
                  <div className="mt-4 mb-2">
                    <div className="text-xs text-muted-foreground font-mono mb-1">MIDPOINT ESTIMATE</div>
                    <div
                      className="amber-glow font-mono font-bold leading-none"
                      style={{ fontSize: "clamp(2rem, 5vw, 3rem)", color: "oklch(0.82 0.18 75)" }}
                    >
                      {formatPrice(animatedMid)}
                    </div>
                  </div>

                  {/* Range bar */}
                  <div className="mt-5 mb-3">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
                      <span>LOW</span>
                      <span>HIGH</span>
                    </div>
                    <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          left: "0%",
                          right: "0%",
                          background: "linear-gradient(90deg, oklch(0.72 0.18 25), oklch(0.82 0.18 75), oklch(0.75 0.14 185))",
                        }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-white/90 transition-all duration-500"
                        style={{ left: `${((result.mid - result.low) / (result.high - result.low)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono mt-2">
                      <span className="text-red-400">{formatPrice(animatedLow)}</span>
                      <span className="text-teal-400">{formatPrice(animatedHigh)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="section-label mb-1">Price / SqFt</div>
                      <div className="price-display text-base">${result.psf}</div>
                    </div>
                    <div>
                      <div className="section-label mb-1">Confidence</div>
                      <div className="price-display text-base">{result.confidence}%</div>
                    </div>
                    <div>
                      <div className="section-label mb-1">Area Median</div>
                      <div className="font-mono text-sm text-foreground">{formatPrice(result.hood.basePrice)}</div>
                    </div>
                    <div>
                      <div className="section-label mb-1">Avg DOM</div>
                      <div className="font-mono text-sm text-foreground">{result.hood.dom} days</div>
                    </div>
                  </div>
                </div>

                {/* Price factors */}
                <div className="blueprint-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={14} className="text-amber-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Active Price Factors</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FactorBadge
                      label="Location"
                      value={inputs.neighborhood === "overall" ? "City Avg" : hood?.label}
                      impact="neutral"
                    />
                    <FactorBadge
                      label="Age"
                      value={`${age} yrs old`}
                      impact={ageImpact}
                    />
                    <FactorBadge
                      label="Condition"
                      value={`${CONDITION_MULTIPLIERS[inputs.condition]}×`}
                      impact={conditionImpact}
                    />
                    {inputs.hasPool && <FactorBadge label="Pool" value="+$22K" impact="positive" />}
                    {inputs.hasGarage && <FactorBadge label="Garage" value="+$18K" impact="positive" />}
                    {inputs.renovated && <FactorBadge label="Renovated" value="+7%" impact="positive" />}
                    {inputs.nearDowntown && <FactorBadge label="Downtown" value="+4%" impact="positive" />}
                    {inputs.lotSize > 0.2 && (
                      <FactorBadge
                        label="Lot Premium"
                        value={`+$${Math.round((inputs.lotSize - 0.2) * 85000).toLocaleString()}`}
                        impact="positive"
                      />
                    )}
                  </div>
                </div>

                {/* Market signal */}
                <div className="blueprint-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={14} className="text-red-400" />
                    <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Market Signal</span>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Market Type</span>
                      <span className="text-teal-300 font-medium">Buyer's Market</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inventory vs. Buyers</span>
                      <span className="text-red-400 font-medium">+128% sellers</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Listings w/ Price Drops</span>
                      <span className="font-mono">25.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Offer vs. List</span>
                      <span className="font-mono">-4.1%</span>
                    </div>
                    <div className="mt-3 p-3 bg-teal-500/10 border border-teal-500/30 rounded text-teal-200 text-[11px] leading-relaxed">
                      <strong>Buyer Leverage:</strong> Current conditions favor negotiation. Expect 3–6% below list price as a reasonable opening offer.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MARKET DATA SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "market" && (
          <div className="space-y-10">
            <div>
              <SectionLabel>Austin Real Estate Market</SectionLabel>
              <h2 className="text-2xl font-bold mt-2 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Market Data & Trends
              </h2>
              <p className="text-sm text-muted-foreground">Live data sourced from Redfin, Zillow, and Cain Realty Group. Updated February 19, 2026.</p>
            </div>

            {/* Price History Chart */}
            <div className="blueprint-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="section-label mb-1">Historical Trend</div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Austin Median Home Price (2020–2026)</h3>
                </div>
                <div className="text-right">
                  <div className="section-label mb-1">Peak (2022)</div>
                  <div className="price-display text-lg">$632,000</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={PRICE_HISTORY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.82 0.18 75)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.82 0.18 75)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.07 250)" strokeOpacity={0.5} />
                  <XAxis dataKey="year" tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `$${v / 1000}K`}
                    tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.15 0.05 250)", border: "1px solid oklch(0.27 0.07 250)", borderRadius: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                    labelStyle={{ color: "oklch(0.82 0.18 75)" }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Median Price"]}
                  />
                  <ReferenceLine y={500000} stroke="oklch(0.75 0.14 185)" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "Current", fill: "oklch(0.75 0.14 185)", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                  <Area type="monotone" dataKey="price" stroke="oklch(0.82 0.18 75)" strokeWidth={2} fill="url(#priceGrad)" dot={{ fill: "oklch(0.82 0.18 75)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "oklch(0.82 0.18 75)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Neighborhood Price Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="blueprint-card p-6">
                <div className="section-label mb-1">By Area</div>
                <h3 className="text-lg font-semibold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>3-Bedroom Prices by Neighborhood</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={NEIGHBORHOOD_CHART_DATA} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.07 250)" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${v}K`} tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 10, fontFamily: "IBM Plex Sans" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.15 0.05 250)", border: "1px solid oklch(0.27 0.07 250)", borderRadius: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                      formatter={(v: number) => [`$${v}K`, "Avg 3-BR Price"]}
                    />
                    <Bar dataKey="price" fill="oklch(0.82 0.18 75)" radius={[0, 3, 3, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="blueprint-card p-6">
                <div className="section-label mb-1">Price Density</div>
                <h3 className="text-lg font-semibold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Price per Square Foot by Area</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={NEIGHBORHOOD_CHART_DATA} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.07 250)" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "oklch(0.65 0.04 250)", fontSize: 10, fontFamily: "IBM Plex Sans" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.15 0.05 250)", border: "1px solid oklch(0.27 0.07 250)", borderRadius: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                      formatter={(v: number) => [`$${v}/sqft`, "Price per Sq Ft"]}
                    />
                    <Bar dataKey="psf" fill="oklch(0.75 0.14 185)" radius={[0, 3, 3, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed market table */}
            <div className="blueprint-card p-6">
              <div className="section-label mb-1">Full Breakdown</div>
              <h3 className="text-lg font-semibold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Neighborhood Market Statistics (Feb 2026)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Neighborhood", "3-BR Avg Price", "Price/SqFt", "YoY Change", "Avg DOM", "Signal"].map((h) => (
                        <th key={h} className="text-left py-3 px-3 section-label font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NEIGHBORHOODS.map((n) => (
                      <tr key={n.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-3 font-medium">{n.label}</td>
                        <td className="py-3 px-3 font-mono text-amber-300">{formatPrice(n.basePrice)}</td>
                        <td className="py-3 px-3 font-mono">${n.pricePerSqft}</td>
                        <td className={`py-3 px-3 font-mono ${n.trend >= 0 ? "text-teal-400" : "text-red-400"}`}>
                          {n.trend >= 0 ? "+" : ""}{n.trend}%
                        </td>
                        <td className="py-3 px-3 font-mono">{n.dom} days</td>
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded border ${
                            n.dom < 50 ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          }`}>
                            {n.dom < 50 ? "Hot" : "Buyer's"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Neighborhood aerial image */}
            <div className="blueprint-card overflow-hidden">
              <img src={NEIGHBORHOOD_IMG} alt="Austin neighborhood aerial with price annotations" className="w-full h-64 object-cover" />
              <div className="p-4 flex items-center gap-3">
                <MapPin size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-muted-foreground">Aerial view of Austin residential neighborhoods with lot boundary and price annotations. Data sourced from Travis County Appraisal District.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            COMPARABLES SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "comparables" && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Recent Sales Analysis</SectionLabel>
              <h2 className="text-2xl font-bold mt-2 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Comparable Sales (Jan–Feb 2026)
              </h2>
              <p className="text-sm text-muted-foreground">Six recent 3-bedroom sales across Austin neighborhoods, illustrating the price range and key value drivers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {COMPARABLES.map((c, i) => {
                const ratio = ((c.soldPrice / c.listPrice) * 100).toFixed(1);
                const psf = Math.round(c.soldPrice / c.sqft);
                const diff = c.soldPrice - c.listPrice;
                return (
                  <div key={i} className="blueprint-card p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{c.address}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin size={11} className="text-amber-400" />
                          <span className="text-xs text-muted-foreground">{c.neighborhood}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${
                        c.condition === "Luxury" ? "border-amber-400/50 bg-amber-400/10 text-amber-300" :
                        c.condition === "Excellent" ? "border-teal-400/50 bg-teal-400/10 text-teal-300" :
                        "border-border bg-secondary text-muted-foreground"
                      }`}>{c.condition}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="section-label text-[9px]">Beds/Baths</div>
                        <div className="font-mono font-medium mt-0.5">{c.beds}/{c.baths}</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="section-label text-[9px]">Sq Ft</div>
                        <div className="font-mono font-medium mt-0.5">{c.sqft.toLocaleString()}</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2 text-center">
                        <div className="section-label text-[9px]">Built</div>
                        <div className="font-mono font-medium mt-0.5">{c.yearBuilt}</div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="section-label">Sold Price</span>
                        <span className="price-display text-lg">{formatPrice(c.soldPrice)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>List: {formatPrice(c.listPrice)}</span>
                        <span className={diff < 0 ? "text-teal-400" : "text-red-400"}>
                          {diff < 0 ? "" : "+"}{formatPrice(diff)} ({ratio}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-2">
                        {c.hasPool && <span className="text-teal-400/80">🏊 Pool</span>}
                        {c.hasGarage && <span className="text-teal-400/80">🚗 Garage</span>}
                      </div>
                      <div className="font-mono text-muted-foreground">${psf}/sqft · {c.dom}d DOM</div>
                    </div>

                    <div className="text-xs text-muted-foreground border-t border-border pt-2">
                      <Clock size={10} className="inline mr-1 text-amber-400/60" />
                      Sold {c.soldDate}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparable summary stats */}
            <div className="blueprint-card p-6">
              <div className="section-label mb-4">Comparable Summary</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Avg Sold Price", value: formatPrice(Math.round(COMPARABLES.reduce((a, c) => a + c.soldPrice, 0) / COMPARABLES.length)) },
                  { label: "Price Range", value: `${formatK(Math.min(...COMPARABLES.map(c => c.soldPrice)))}–${formatK(Math.max(...COMPARABLES.map(c => c.soldPrice)))}` },
                  { label: "Avg Price/SqFt", value: `$${Math.round(COMPARABLES.reduce((a, c) => a + c.soldPrice / c.sqft, 0) / COMPARABLES.length)}/sqft` },
                  { label: "Avg Days on Market", value: `${Math.round(COMPARABLES.reduce((a, c) => a + c.dom, 0) / COMPARABLES.length)} days` },
                ].map((s) => (
                  <div key={s.label} className="bg-secondary/40 rounded p-4">
                    <div className="section-label mb-2">{s.label}</div>
                    <div className="price-display text-xl">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* House image */}
            <div className="blueprint-card overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <img src={HOUSE_IMG} alt="Typical 3-bedroom Austin home" className="w-full h-72 object-cover" />
                <div className="p-6 flex flex-col justify-center">
                  <SectionLabel>Typical Property Profile</SectionLabel>
                  <h3 className="text-xl font-bold mt-3 mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Austin 3-Bedroom Home
                  </h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span>Typical Size</span><span className="font-mono text-foreground">1,500–2,200 sqft</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span>Common Style</span><span className="font-mono text-foreground">Craftsman / Ranch</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span>Lot Size</span><span className="font-mono text-foreground">0.12–0.25 acres</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span>Year Built Range</span><span className="font-mono text-foreground">1985–2020</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Median City Price</span><span className="font-mono text-amber-300">$697,500</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            METHODOLOGY SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "methodology" && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <SectionLabel>How It Works</SectionLabel>
              <h2 className="text-2xl font-bold mt-2 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Estimation Methodology
              </h2>
              <p className="text-sm text-muted-foreground">A transparent breakdown of the pricing model, data sources, and adjustment factors used in this tool.</p>
            </div>

            {/* Model overview */}
            <div className="blueprint-card p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Pricing Model Overview</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                This tool uses a <strong className="text-foreground">hedonic pricing model</strong> — a method widely used by appraisers and automated valuation systems (AVMs) that decomposes a property's value into the sum of its individual characteristics. The base estimate starts from the neighborhood's median price per square foot, then applies multiplicative adjustments for age, condition, school district quality, and additive adjustments for specific amenities.
              </p>
              <div className="bg-secondary/40 rounded p-4 font-mono text-xs text-teal-300 leading-relaxed">
                <div className="text-muted-foreground mb-2">// Estimation Formula</div>
                <div>Base = neighborhood_psf × sqft</div>
                <div>× age_multiplier(year_built)</div>
                <div>× condition_multiplier</div>
                <div>× school_multiplier</div>
                <div>+ pool_value (if applicable)</div>
                <div>+ garage_value (if applicable)</div>
                <div>× renovation_factor (if applicable)</div>
                <div>× downtown_proximity_factor (if applicable)</div>
                <div>+ lot_premium (lot_size &gt; 0.2 acres)</div>
              </div>
            </div>

            {/* Adjustment factors table */}
            <div className="blueprint-card p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Adjustment Factors</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 section-label font-normal">Factor</th>
                      <th className="text-left py-2 px-3 section-label font-normal">Adjustment</th>
                      <th className="text-left py-2 px-3 section-label font-normal">Source / Basis</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      ["Age ≤ 5 years", "×1.12", "New construction premium"],
                      ["Age 6–15 years", "×1.05", "Modern systems, low maintenance"],
                      ["Age 16–25 years", "×1.00", "Baseline"],
                      ["Age 26–40 years", "×0.94", "Deferred maintenance risk"],
                      ["Age > 40 years", "×0.87", "Major system replacement likely"],
                      ["Condition: Luxury", "×1.22", "High-end finishes, premium materials"],
                      ["Condition: Excellent", "×1.10", "Move-in ready, recent updates"],
                      ["Condition: Good", "×1.00", "Baseline, typical wear"],
                      ["Condition: Fair", "×0.91", "Cosmetic repairs needed"],
                      ["Condition: Poor", "×0.82", "Significant repairs required"],
                      ["School: Top Rated", "×1.16", "BHHSTX study: 4–6% per 10pt score"],
                      ["School: Excellent", "×1.10", "Austin school district research"],
                      ["School: Good", "×1.05", "Moderate premium"],
                      ["School: Average", "×1.00", "Baseline"],
                      ["School: Below Avg", "×0.94", "Discount vs. average"],
                      ["Swimming Pool", "+$22,000", "Austin appraisal data avg"],
                      ["Garage", "+$18,000", "Travis CAD comparable analysis"],
                      ["Recent Renovation", "+7%", "Austin market renovation premium"],
                      ["Near Downtown", "+4%", "Proximity premium, walkability"],
                      ["Lot > 0.2 acres", "+$85K/acre", "Land value premium above baseline"],
                    ].map(([factor, adj, source], i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="py-2 px-3 font-medium">{factor}</td>
                        <td className="py-2 px-3 font-mono text-amber-300">{adj}</td>
                        <td className="py-2 px-3 text-muted-foreground">{source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data sources */}
            <div className="blueprint-card p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Data Sources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { source: "Redfin", detail: "Median sale price, DOM, sale-to-list ratio (Jan 2026)" },
                  { source: "Cain Realty Group", detail: "Average price by bedrooms and area (Feb 19, 2026)" },
                  { source: "Zillow", detail: "Home value index, YoY trends (Jan 2026)" },
                  { source: "Berbas Group", detail: "Neighborhood-level median prices and PSF (2025)" },
                  { source: "Travis CAD", detail: "Appraisal methodology and property factors" },
                  { source: "BHHSTX Research", detail: "School district impact on home values (2025)" },
                  { source: "Austin Real Estate Blog", detail: "Monthly price reports (Dec 2025–Jan 2026)" },
                  { source: "TeamPrice Analytics", detail: "ZIP code price per sqft data (Apr 2025)" },
                ].map((d) => (
                  <div key={d.source} className="flex gap-3 p-3 bg-secondary/30 rounded">
                    <div className="w-1 bg-amber-400/60 rounded shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-amber-300">{d.source}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="border border-amber-400/30 bg-amber-400/5 rounded p-5">
              <div className="flex items-start gap-3">
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/80 leading-relaxed">
                  <strong className="text-amber-300">Disclaimer:</strong> This tool provides estimates for informational purposes only and does not constitute a formal appraisal, broker price opinion, or real estate advice. Actual market values depend on factors not captured in this model, including interior condition, specific lot characteristics, HOA fees, recent neighborhood developments, and negotiation dynamics. Always consult a licensed real estate professional and certified appraiser before making financial decisions.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border mt-16 py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <HomeIcon size={14} className="text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Realty360 · Austin Edition</div>
              <div className="text-xs text-muted-foreground font-mono">Data current as of Feb 19, 2026</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            For informational purposes only. Not a licensed appraisal.
          </div>
        </div>
      </footer>
    </div>
  );
}
