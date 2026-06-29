import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  CompRecordDto,
  UnifiedCompSection,
  UnifiedComparablesResponse,
} from "@shared/comparables/types";
import { CompRecordDetailCard } from "./CompRecordDetailCard";

interface UnifiedComparablesResultsProps {
  result: UnifiedComparablesResponse;
}

function compRecordKey(comp: CompRecordDto): string {
  if (comp.listingKey) return comp.listingKey;
  if (comp.propId != null) return `tcad-${comp.propId}`;
  return comp.address;
}

function CompRow({
  comp,
  subjectAddress,
  isOpen,
  onToggle,
}: {
  comp: CompRecordDto;
  subjectAddress: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const priceHint =
    comp.compRole === "listing_comp" && comp.listPrice != null
      ? `$${Math.round(comp.listPrice / 1000)}k list`
      : comp.compRole === "sale_comp" && comp.closePrice != null
        ? `$${Math.round(comp.closePrice / 1000)}k sold`
        : comp.compRole === "tax_reference" && comp.appraisedValue != null
          ? `$${Math.round(comp.appraisedValue / 1000)}k appraised`
          : null;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-3 px-1 text-left hover:bg-secondary/30 rounded transition-colors"
      >
        <span className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {comp.address}
          </span>
          {priceHint && (
            <span className="text-xs font-mono text-muted-foreground">
              {priceHint}
              {comp.standardStatus && comp.compRole === "listing_comp"
                ? ` · ${comp.standardStatus}`
                : ""}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {comp.matchPercent != null && (
            <span className="font-mono text-sm text-amber-400">
              {comp.matchPercent}%
            </span>
          )}
          {isOpen ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </span>
      </button>
      {isOpen && (
        <CompRecordDetailCard comp={comp} subjectAddress={subjectAddress} />
      )}
    </div>
  );
}

function CompSection({
  section,
  subjectAddress,
  openKey,
  onToggle,
}: {
  section: UnifiedCompSection;
  subjectAddress: string;
  openKey: string | null;
  onToggle: (key: string) => void;
}) {
  const nonEmptyBuckets = section.buckets.filter(
    (bucket) => bucket.comparables.length > 0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {section.label}
        </h2>
        <span className="text-sm font-mono text-muted-foreground shrink-0">
          {section.count} {section.count === 1 ? "result" : "results"}
        </span>
      </div>

      {section.count === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No properties in this category for the current search.
        </p>
      ) : (
        nonEmptyBuckets.map((bucket) => (
          <div key={`${section.compRole}-${bucket.mile}`}>
            <h3
              className="text-sm font-semibold text-muted-foreground mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {bucket.label}
            </h3>
            <div className="blueprint-card px-4 py-1">
              {bucket.comparables.map((comp) => {
                const key = compRecordKey(comp);
                return (
                  <CompRow
                    key={key}
                    comp={comp}
                    subjectAddress={subjectAddress}
                    isOpen={openKey === key}
                    onToggle={() => onToggle(key)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function UnifiedComparablesResults({
  result,
}: UnifiedComparablesResultsProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const subjectLabel =
    result.subject?.address ??
    result.subjectTcad?.situsAddress ??
    "subject property";

  const subjectBeds = result.subject?.bedrooms ?? result.filters.minBedrooms;
  const subjectBaths = result.subject?.bathrooms ?? result.filters.minBathrooms;

  function handleToggle(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="space-y-10">
      <div className="blueprint-card p-4 text-sm">
        <div className="section-label mb-1">Subject property</div>
        <div
          className="font-medium"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {subjectLabel}
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          {subjectBeds ?? "—"} bed / {subjectBaths ?? "—"} bath
          {" · "}
          {result.radiusMiles} mi radius
          {result.filters.maxAgeMonths != null && (
            <>
              {" · "}
              closed sales last {result.filters.maxAgeMonths} mo
            </>
          )}
          {" · "}
          {result.count} total comparable{result.count === 1 ? "" : "s"}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs font-mono">
          <span className="text-teal-400/90">
            {result.sections.closedSales.count} closed
          </span>
          <span className="text-amber-400/90">
            {result.sections.openListings.count} on market
          </span>
          {result.filters.includeTcad && (
            <span className="text-muted-foreground">
              {result.sections.taxReferences?.count ?? 0} tax parcels
            </span>
          )}
        </div>
      </div>

      <CompSection
        section={result.sections.closedSales}
        subjectAddress={subjectLabel}
        openKey={openKey}
        onToggle={handleToggle}
      />

      <CompSection
        section={result.sections.openListings}
        subjectAddress={subjectLabel}
        openKey={openKey}
        onToggle={handleToggle}
      />

      {result.filters.includeTcad && result.sections.taxReferences && (
        <CompSection
          section={result.sections.taxReferences}
          subjectAddress={subjectLabel}
          openKey={openKey}
          onToggle={handleToggle}
        />
      )}
    </div>
  );
}
