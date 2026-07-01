import { Car, Clock, Droplets, MapPin, Trees } from "lucide-react";
import {
  formatDistanceMiles,
  formatGarageSpaces,
  formatLotAcres,
  formatOptionalYesNo,
  formatPrice,
  formatSoldDate,
} from "@shared/comparables/format";
import type { CompRecordDto } from "@shared/comparables/types";
import { DataSourceCitation } from "@/components/DataSourceCitation";
import { compRecordDataSource } from "@/lib/data-sources";

interface CompRecordDetailCardProps {
  comp: CompRecordDto;
  subjectAddress: string;
}

function conditionBadgeClass(condition: string | null): string {
  switch (condition?.toLowerCase()) {
    case "luxury":
      return "border-amber-400/50 bg-amber-400/10 text-amber-300";
    case "excellent":
      return "border-teal-400/50 bg-teal-400/10 text-teal-300";
    case "good":
      return "border-border bg-secondary text-muted-foreground";
    case "fair":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-200";
    case "poor":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

function statusBadgeClass(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "active":
      return "border-teal-400/50 bg-teal-400/10 text-teal-300";
    case "pending":
      return "border-amber-400/50 bg-amber-400/10 text-amber-300";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

export function CompRecordDetailCard({
  comp,
  subjectAddress,
}: CompRecordDetailCardProps) {
  const isTax = comp.compRole === "tax_reference";
  const isListing = comp.compRole === "listing_comp";

  const beds = comp.bedrooms ?? "—";
  const baths = comp.bathrooms ?? "—";
  const sqft = comp.livingAreaSqft?.toLocaleString() ?? "—";
  const yearBuilt = comp.yearBuilt ?? "—";
  const listPrice =
    comp.listPrice != null ? formatPrice(comp.listPrice) : null;
  const soldPrice =
    comp.closePrice != null ? formatPrice(comp.closePrice) : "—";
  const psf =
    comp.pricePerSqft != null ? `$${comp.pricePerSqft}/sqft` : "—";
  const dom =
    comp.daysOnMarket != null ? `${comp.daysOnMarket}d DOM` : "—";

  return (
    <div className="blueprint-card p-5 flex flex-col gap-3 mt-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="font-semibold text-sm leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {comp.address}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={11} className="text-amber-400 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {[comp.city, comp.state].filter(Boolean).join(", ") ||
                "Austin area"}
            </span>
          </div>
        </div>
        {comp.matchPercent != null && (
          <span className="text-xs px-2 py-0.5 rounded border shrink-0 border-amber-400/50 bg-amber-400/10 text-amber-300 font-mono">
            {comp.matchPercent}% match
          </span>
        )}
      </div>

      {isTax ? (
        <>
          <p className="text-xs text-muted-foreground border border-border/80 bg-secondary/40 rounded px-3 py-2">
            Tax reference only — appraised values are not sale comparables.
          </p>
          {comp.propId != null && (
            <div className="text-xs font-mono text-muted-foreground">
              TCAD PROP_ID: {comp.propId}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-secondary/50 rounded p-2">
              <div className="section-label text-[9px]">Appraised</div>
              <div className="font-mono font-medium mt-0.5">
                {comp.appraisedValue != null
                  ? formatPrice(comp.appraisedValue)
                  : "—"}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2">
              <div className="section-label text-[9px]">Market value</div>
              <div className="font-mono font-medium mt-0.5">
                {comp.marketValue != null
                  ? formatPrice(comp.marketValue)
                  : "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-3 py-2">
            <span className="section-label">Lot (TCAD)</span>
            <span className="font-mono">
              {formatLotAcres(comp.tcadAcres ?? comp.lotSizeAcres)}
            </span>
          </div>
          {comp.deedDate && (
            <div className="text-xs text-muted-foreground">
              <Clock size={10} className="inline mr-1 text-amber-400/60" />
              Deed date {formatSoldDate(comp.deedDate)}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Beds/Baths</div>
              <div className="font-mono font-medium mt-0.5">
                {beds}/{baths}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Sq Ft</div>
              <div className="font-mono font-medium mt-0.5">{sqft}</div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Built</div>
              <div className="font-mono font-medium mt-0.5">{yearBuilt}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Droplets size={9} className="text-amber-400/70" />
                Pool
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatOptionalYesNo(comp.hasPool)}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Car size={9} className="text-amber-400/70" />
                Garage
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatGarageSpaces(comp.garageSpaces, comp.hasGarage)}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Trees size={9} className="text-amber-400/70" />
                Lot
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatLotAcres(comp.lotSizeAcres)}
              </div>
            </div>
          </div>

          {comp.condition && (
            <div className="flex items-center justify-between gap-3 text-xs bg-secondary/50 rounded px-3 py-2">
              <span className="section-label">House Condition</span>
              <span
                className={`px-2 py-0.5 rounded border font-medium ${conditionBadgeClass(comp.condition)}`}
              >
                {comp.condition}
              </span>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            {isListing ? (
              <div className="flex justify-between items-baseline">
                <span className="section-label">List Price</span>
                <span className="price-display text-lg">
                  {listPrice ?? "—"}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-baseline">
                <span className="section-label">Sold Price</span>
                <span className="price-display text-lg">{soldPrice}</span>
              </div>
            )}
            {!isListing && listPrice && (
              <div className="flex justify-between items-baseline text-xs">
                <span className="section-label">List Price (at sale)</span>
                <span className="font-mono text-muted-foreground">
                  {listPrice}
                </span>
              </div>
            )}
            {(comp.propertyType || comp.standardStatus) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {comp.propertyType && <span>{comp.propertyType}</span>}
                {comp.standardStatus && (
                  <span
                    className={`px-2 py-0.5 rounded border font-medium ${statusBadgeClass(comp.standardStatus)}`}
                  >
                    {comp.standardStatus}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-muted-foreground">{psf}</span>
            {isListing && (
              <span className="font-mono text-muted-foreground">{dom}</span>
            )}
          </div>

          {!isListing && comp.soldDate !== "—" && (
            <div className="text-xs text-muted-foreground border-t border-border pt-2">
              <Clock size={10} className="inline mr-1 text-amber-400/60" />
              Sold {comp.soldDate}
            </div>
          )}
        </>
      )}

      <div className="text-xs border-t border-border pt-3 flex items-center justify-between gap-2">
        <span className="section-label">Distance from subject</span>
        <span className="font-mono text-teal-400 text-right">
          {formatDistanceMiles(comp.distanceMiles)} from {subjectAddress}
        </span>
      </div>

      <DataSourceCitation source={compRecordDataSource(comp)} className="pt-3" />
    </div>
  );
}
