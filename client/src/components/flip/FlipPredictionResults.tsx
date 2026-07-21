import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  FlipArvCompRecord,
  FlipPredictionResponse,
  FlipViability,
} from "@shared/flip/prediction-types";
import { getRehabTierConfig } from "@shared/flip/config";
import { formatDistanceMiles } from "@shared/comparables/format";
import { DataSourceCitation } from "@/components/DataSourceCitation";
import {
  flipSubjectDataSource,
  formatPropertyDataSource,
} from "@/lib/data-sources";

interface FlipPredictionResultsProps {
  result: FlipPredictionResponse;
}

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const VIABILITY_STYLES: Record<
  FlipViability,
  { label: string; className: string }
> = {
  strong: {
    label: "Strong",
    className: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  },
  marginal: {
    label: "Marginal",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  weak: {
    label: "Weak",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  },
  negative: {
    label: "Negative",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
  },
};

function CostRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && (
          <div className="text-[11px] text-muted-foreground/80 mt-0.5">{sub}</div>
        )}
      </div>
      <span className="font-mono text-sm shrink-0">{value}</span>
    </div>
  );
}

function ArvCompRow({ comp }: { comp: FlipArvCompRecord }) {
  return (
    <div className="py-2 border-b border-border/60 last:border-b-0 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="font-medium truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {comp.address}
          </div>
          <div className="font-mono text-muted-foreground mt-0.5">
            {comp.bedrooms}/{comp.bathrooms} bed/bath ·{" "}
            {comp.livingAreaSqft.toLocaleString()} sqft ·{" "}
            {formatDistanceMiles(comp.distanceMiles)}
          </div>
        </div>
        <div className="text-right shrink-0 font-mono">
          <div>{formatUsd(comp.closePrice)}</div>
          <div className="text-muted-foreground">
            {formatUsd(comp.pricePerSqft)}/sqft
          </div>
        </div>
      </div>
      <DataSourceCitation
        source="mls-closed-sales"
        className="pt-1.5 mt-1 border-t-0"
      />
    </div>
  );
}

export function FlipPredictionResults({ result }: FlipPredictionResultsProps) {
  const { subject, arv, costs, margins, viability, scopeTier } = result;
  const rehabTier = getRehabTierConfig(scopeTier);
  const viabilityStyle = VIABILITY_STYLES[viability];
  const [compsOpen, setCompsOpen] = useState(true);

  const arvSourceLabel =
    arv.source === "manual_override"
      ? "Manual ARV override"
      : arv.sliceLabel ?? `Median $/sqft from ${arv.compCount} closed sale${arv.compCount === 1 ? "" : "s"}`;

  const subjectSource = flipSubjectDataSource(subject);
  const arvCitationSource =
    arv.source === "manual_override" ? "manual-override" : "mls-closed-sales";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-label mb-1">Flip analysis</div>
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {subject.address ?? "Subject property"}
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {subject.livingAreaSqft.toLocaleString()} sqft
            {subject.bedrooms != null && subject.bathrooms != null && (
              <>
                {" · "}
                {subject.bedrooms} bed / {subject.bathrooms} bath
              </>
            )}
            {" · "}
            {rehabTier.label} rehab
          </p>
          <DataSourceCitation
            source={subjectSource}
            className="mt-2 pt-2 border-t border-border/40"
          />
        </div>
        <span
          className={`border rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${viabilityStyle.className}`}
        >
          {viabilityStyle.label}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="blueprint-card p-4 flex flex-col">
          <div className="section-label mb-1">ARV</div>
          <div
            className="text-2xl font-semibold text-amber-400"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {formatUsd(arv.arv)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{arvSourceLabel}</p>
          {arv.medianPricePerSqft != null && (
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {formatUsd(arv.medianPricePerSqft)}/sqft median
            </p>
          )}
          <DataSourceCitation source={arvCitationSource} />
        </div>

        <div className="blueprint-card p-4 flex flex-col">
          <div className="section-label mb-1">Net profit</div>
          <div
            className={`text-2xl font-semibold ${margins.netProfit >= 0 ? "text-teal-400" : "text-red-400"}`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {formatUsd(margins.netProfit)}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            {formatPct(margins.netMarginPct)} net margin
          </p>
          <DataSourceCitation source="deal-config" />
        </div>

        <div className="blueprint-card p-4 flex flex-col">
          <div className="section-label mb-1">Total project cost</div>
          <div
            className="text-2xl font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {formatUsd(costs.totalProjectCost)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Net sale proceeds {formatUsd(costs.netSaleProceeds)}
          </p>
          <DataSourceCitation source="deal-config" />
        </div>
      </div>

      {arv.source === "comp_median_psf" && (
        <div className="blueprint-card p-4 space-y-3">
          <button
            type="button"
            onClick={() => setCompsOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              ARV comps ({arv.compCount} of {arv.similarCompCount ?? arv.compCount}{" "}
              similar)
            </h3>
            {compsOpen ? (
              <ChevronUp size={14} className="text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
            )}
          </button>

          {arv.warning && (
            <p className="text-xs text-amber-300/90 border border-amber-400/30 bg-amber-400/10 rounded px-3 py-2">
              {arv.warning}
            </p>
          )}

          {compsOpen && (
            <div className="pt-1">
              {arv.comps.map((comp) => (
                <ArvCompRow key={`${comp.address}-${comp.closePrice}`} comp={comp} />
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {arv.sliceLabel} from {arv.compCount} of{" "}
            {arv.similarCompCount ?? arv.compCount} physically similar closed sales
            within {arv.radiusMiles} mi
            {arv.maxAgeMonths != null && ` (last ${arv.maxAgeMonths} mo)`}.
            {arv.rejectedCompCount > 0 &&
              ` ${arv.rejectedCompCount} excluded as not similar enough.`}
            {arv.fallbackUsed && !arv.warning && " Wider comp slice used."}
          </p>
          <DataSourceCitation source="mls-closed-sales" />
        </div>
      )}

      <div className="blueprint-card p-4 flex flex-col">
        <h3
          className="text-sm font-semibold mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Cost breakdown
        </h3>
        <CostRow label="Purchase price" value={formatUsd(costs.purchasePrice)} />
        <CostRow
          label={`Rehab (${rehabTier.label})`}
          value={formatUsd(costs.rehab.totalRehab)}
          sub={`${formatUsd(costs.rehab.costPerSqft)}/sqft × ${costs.rehab.livingAreaSqft.toLocaleString()} sqft`}
        />
        <CostRow label="Buy-side closing" value={formatUsd(costs.buyClosing)} />
        <CostRow
          label={`Hold (${costs.hold.holdMonths} mo)`}
          value={formatUsd(costs.hold.totalHold)}
          sub={`Tax ${formatUsd(costs.hold.propertyTax)} · Insurance ${formatUsd(costs.hold.insurance)} · Utilities ${formatUsd(costs.hold.utilities)}`}
        />
        <CostRow
          label="Financing"
          value={formatUsd(costs.financing.totalFinancing)}
          sub={`Interest ${formatUsd(costs.financing.interestDuringHold)} · Points ${formatUsd(costs.financing.originationFee)}`}
        />
        <CostRow label="Sell-side closing" value={formatUsd(costs.sellClosing)} />
        <DataSourceCitation source="deal-config" />
      </div>

      <div className="blueprint-card p-4 flex flex-col">
        <h3
          className="text-sm font-semibold mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Returns
        </h3>
        <CostRow
          label="Gross profit (before carry)"
          value={formatUsd(margins.grossProfit)}
        />
        <CostRow
          label="Gross margin"
          value={formatPct(margins.grossMarginPct)}
        />
        <CostRow
          label="Net margin"
          value={formatPct(margins.netMarginPct)}
        />
        {margins.cashInvested != null && margins.roiOnCashPct != null && (
          <CostRow
            label="ROI on cash invested"
            value={formatPct(margins.roiOnCashPct)}
            sub={`Cash in deal ${formatUsd(margins.cashInvested)}`}
          />
        )}
        <DataSourceCitation source="deal-config" />
      </div>

      <p className="text-[11px] text-muted-foreground/90 font-mono border border-border/60 rounded px-3 py-2.5">
        <span className="section-label text-[9px] block mb-1">Data sources</span>
        Subject property: {formatPropertyDataSource(subjectSource)}
        {" · "}
        ARV:{" "}
        {arv.source === "manual_override"
          ? "Manual override"
          : "MLS closed sales"}
        {" · "}
        Costs & returns: Travis County deal defaults (derived)
      </p>
    </div>
  );
}
