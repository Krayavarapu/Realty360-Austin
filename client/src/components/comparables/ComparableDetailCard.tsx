import { Clock, MapPin } from "lucide-react";
import { formatDistanceMiles, formatPrice } from "@shared/comparables/format";
import type { RadiusComparableDto } from "@shared/comparables/types";

interface ComparableDetailCardProps {
  property: RadiusComparableDto;
  subjectAddress: string;
}

export function ComparableDetailCard({
  property,
  subjectAddress,
}: ComparableDetailCardProps) {
  const beds = property.bedrooms ?? "—";
  const baths = property.bathrooms ?? "—";
  const sqft = property.livingAreaSqft?.toLocaleString() ?? "—";
  const yearBuilt = property.yearBuilt ?? "—";
  const soldPrice = property.closePrice != null ? formatPrice(property.closePrice) : "—";
  const psf =
    property.pricePerSqft != null ? `$${property.pricePerSqft}/sqft` : "—";
  const dom =
    property.daysOnMarket != null ? `${property.daysOnMarket}d DOM` : "—";

  return (
    <div className="blueprint-card p-5 flex flex-col gap-3 mt-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="font-semibold text-sm leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {property.address}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={11} className="text-amber-400" />
            <span className="text-xs text-muted-foreground">
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

      <div className="border-t border-border pt-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="section-label">Sold Price</span>
          <span className="price-display text-lg">{soldPrice}</span>
        </div>
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
        <span className="font-mono text-teal-400">
          {formatDistanceMiles(property.distanceMiles)} from {subjectAddress}
        </span>
      </div>
    </div>
  );
}
