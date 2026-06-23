import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  ComparablesByRadiusResponse,
  RadiusComparableDto,
} from "@shared/comparables/types";
import { ComparableDetailCard } from "./ComparableDetailCard";

interface ComparablesResultsProps {
  result: ComparablesByRadiusResponse;
}

function ComparableRow({
  property,
  subjectAddress,
  isOpen,
  onToggle,
}: {
  property: RadiusComparableDto;
  subjectAddress: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-3 px-1 text-left hover:bg-secondary/30 rounded transition-colors"
      >
        <span
          className="text-sm font-medium flex-1 min-w-0 truncate"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {property.address}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm text-amber-400">
            {property.matchPercent}%
          </span>
          {isOpen ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </span>
      </button>
      {isOpen && (
        <ComparableDetailCard
          property={property}
          subjectAddress={subjectAddress}
        />
      )}
    </div>
  );
}

export function ComparablesResults({ result }: ComparablesResultsProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const subjectLabel = result.subject.address;

  return (
    <div className="space-y-8">
      <div className="blueprint-card p-4 text-sm">
        <div className="section-label mb-1">Subject property</div>
        <div className="font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {result.subject.address}
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          {result.subject.bedrooms ?? "—"} bed / {result.subject.bathrooms ?? "—"} bath
          {" · "}
          {result.radiusMiles} mi radius
          {" · "}
          {result.count} comparable{result.count === 1 ? "" : "s"}
        </div>
      </div>

      {result.buckets.map((bucket) => (
        <div key={bucket.mile}>
          <h3
            className="text-lg font-semibold mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {bucket.label}
          </h3>
          {bucket.properties.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No properties in this range.
            </p>
          ) : (
            <div className="blueprint-card px-4 py-1">
              {bucket.properties.map((property) => (
                <ComparableRow
                  key={property.listingKey}
                  property={property}
                  subjectAddress={subjectLabel}
                  isOpen={openKey === property.listingKey}
                  onToggle={() =>
                    setOpenKey((prev) =>
                      prev === property.listingKey ? null : property.listingKey,
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
