import { Car, Clock, Droplets, MapPin, Trees } from "lucide-react";
import {
  formatDistanceMiles,
  formatGarageSpaces,
  formatLotAcres,
  formatOptionalYesNo,
  formatPrice,
} from "@shared/comparables/format";
import type { RadiusComparableDto } from "@shared/comparables/types";

interface ComparableDetailCardProps {
  property: RadiusComparableDto;
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

export function ComparableDetailCard({
  property,
  subjectAddress,
}: ComparableDetailCardProps) {
  const beds = property.bedrooms ?? "—";
  const baths = property.bathrooms ?? "—";
  const sqft = property.livingAreaSqft?.toLocaleString() ?? "—";
  const yearBuilt = property.yearBuilt ?? "—";
  const soldPrice =
    property.closePrice != null ? formatPrice(property.closePrice) : "—";
  const listPrice =
    property.listPrice != null ? formatPrice(property.listPrice) : null;
  const psf =
    property.pricePerSqft != null ? `$${property.pricePerSqft}/sqft` : "—";
  const dom =
    property.daysOnMarket != null ? `${property.daysOnMarket}d DOM` : "—";

  return (
    <div className="blueprint-card p-5 flex flex-col gap-3 mt-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="font-semibold text-sm leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {property.address}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={11} className="text-amber-400 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {[property.city, property.state].filter(Boolean).join(", ") ||
                "Austin area"}
            </span>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded border shrink-0 border-amber-400/50 bg-amber-400/10 text-amber-300 font-mono">
          {property.matchPercent}% match
        </span>
      </div>

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
            {formatOptionalYesNo(property.hasPool)}
          </div>
        </div>
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="section-label text-[9px] flex items-center justify-center gap-1">
            <Car size={9} className="text-amber-400/70" />
            Garage
          </div>
          <div className="font-mono font-medium mt-0.5">
            {formatGarageSpaces(property.garageSpaces, property.hasGarage)}
          </div>
        </div>
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="section-label text-[9px] flex items-center justify-center gap-1">
            <Trees size={9} className="text-amber-400/70" />
            Lot
          </div>
          <div className="font-mono font-medium mt-0.5">
            {formatLotAcres(property.lotSizeAcres)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs bg-secondary/50 rounded px-3 py-2">
        <span className="section-label">House Condition</span>
        {property.condition ? (
          <span
            className={`px-2 py-0.5 rounded border font-medium ${conditionBadgeClass(property.condition)}`}
          >
            {property.condition}
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">—</span>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="section-label">Sold Price</span>
          <span className="price-display text-lg">{soldPrice}</span>
        </div>
        {listPrice && (
          <div className="flex justify-between items-baseline text-xs">
            <span className="section-label">List Price</span>
            <span className="font-mono text-muted-foreground">{listPrice}</span>
          </div>
        )}
        {property.propertyType && (
          <div className="text-xs text-muted-foreground">
            {property.propertyType}
            {property.standardStatus ? ` · ${property.standardStatus}` : ""}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-muted-foreground">{psf}</span>
        <span className="font-mono text-muted-foreground">{dom}</span>
      </div>

      <div className="text-xs text-muted-foreground border-t border-border pt-2">
        <Clock size={10} className="inline mr-1 text-amber-400/60" />
        Sold {property.soldDate}
      </div>

      <div className="text-xs border-t border-border pt-3 flex items-center justify-between gap-2">
        <span className="section-label">Distance from subject</span>
        <span className="font-mono text-teal-400 text-right">
          {formatDistanceMiles(property.distanceMiles)} from {subjectAddress}
        </span>
      </div>
    </div>
  );
}
