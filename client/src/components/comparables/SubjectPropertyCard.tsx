import { Clock, Car, Droplets, Trees } from "lucide-react";
import {
  formatGarageSpaces,
  formatLotAcres,
  formatOptionalYesNo,
  formatPrice,
  formatSoldDate,
} from "@shared/comparables/format";
import type {
  PropertyDetailDto,
  UnifiedComparablesResponse,
} from "@shared/comparables/types";
import type { PropertyProfileTaxCandidate } from "@shared/property-profile/types";
import {
  pickProfileTaxValue,
  sumDisplayTaxValueFromCandidates,
} from "@shared/property-profile/tcad-tax";
import { DataSourceCitation } from "@/components/DataSourceCitation";
import { unifiedSubjectDataSource } from "@/lib/data-sources";
import { Button } from "@/components/ui/button";

interface SubjectPropertyCardProps {
  result: UnifiedComparablesResponse;
  selectedPropId?: number | null;
  onSelectPropId?: (propId: number | null) => void;
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

function isOpenListing(subject: PropertyDetailDto): boolean {
  const status = subject.standardStatus?.toLowerCase() ?? "";
  if (status === "active" || status === "pending" || status === "coming soon") {
    return true;
  }
  if (subject.closePrice != null) return false;
  return subject.listPrice != null && subject.closeDate == null;
}

function TaxCandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: PropertyProfileTaxCandidate;
  selected: boolean;
  onSelect?: (propId: number) => void;
}) {
  const taxValue = pickProfileTaxValue(candidate.tax);
  const acres = candidate.tax.tcadAcres ?? candidate.tax.gisAcres;

  return (
    <div
      className={`rounded border px-3 py-2 space-y-1.5 text-xs ${
        selected
          ? "border-amber-400/50 bg-amber-400/5"
          : "border-border/80 bg-secondary/40"
      }`}
    >
      <div className="font-medium text-sm leading-tight">
        {candidate.situsAddress ?? `PROP_ID ${candidate.propId}`}
      </div>
      <div className="font-mono text-muted-foreground">
        TCAD PROP_ID: {candidate.propId}
      </div>
      {taxValue != null && (
        <div className="flex items-center justify-between">
          <span className="section-label">Tax Value</span>
          <span className="font-mono font-medium">{formatPrice(taxValue)}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="section-label">TCAD Acres</span>
        <span className="font-mono">{formatLotAcres(acres)}</span>
      </div>
      {onSelect && (
        <Button
          type="button"
          size="sm"
          variant={selected ? "secondary" : "outline"}
          className="w-full h-7 text-xs mt-1"
          onClick={() => onSelect(candidate.propId)}
        >
          {selected ? "Selected parcel" : "Use this parcel"}
        </Button>
      )}
    </div>
  );
}

function SubjectTaxSection({
  result,
  selectedPropId,
  onSelectPropId,
}: SubjectPropertyCardProps) {
  const profile = result.subjectProfile;
  if (!profile) return null;

  const { tax, taxCandidates, tcadMatch } = profile;
  const hasTax = tax != null || (taxCandidates?.length ?? 0) > 0;
  if (!hasTax) return null;

  const isAmbiguous = tcadMatch.status === "ambiguous" && taxCandidates?.length;

  if (isAmbiguous) {
    const combinedTax = sumDisplayTaxValueFromCandidates(taxCandidates);
    const combinedAcres = taxCandidates.reduce((sum, c) => {
      const acres = c.tax.tcadAcres ?? c.tax.gisAcres;
      return acres != null ? sum + acres : sum;
    }, 0);

    return (
      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-xs text-muted-foreground border border-amber-400/30 bg-amber-400/5 rounded px-3 py-2">
          {tcadMatch.message ??
            "Multiple TCAD tax records match this address. Hold-cost tax uses the combined assessed value (Policy B)."}
        </div>
        {combinedTax != null && (
          <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-3 py-2">
            <span className="section-label">Combined Tax Value</span>
            <span className="font-mono font-medium">
              {formatPrice(combinedTax)}
            </span>
          </div>
        )}
        {combinedAcres > 0 && (
          <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-3 py-2">
            <span className="section-label">Combined TCAD Acres</span>
            <span className="font-mono">{formatLotAcres(combinedAcres)}</span>
          </div>
        )}
        <div className="space-y-2">
          <div className="section-label text-[10px]">TCAD parcels</div>
          {taxCandidates.map((candidate) => (
            <TaxCandidateRow
              key={candidate.propId}
              candidate={candidate}
              selected={selectedPropId === candidate.propId}
              onSelect={onSelectPropId}
            />
          ))}
        </div>
        {onSelectPropId && selectedPropId != null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onSelectPropId(null)}
          >
            Clear parcel selection
          </Button>
        )}
      </div>
    );
  }

  if (!tax) return null;

  const taxValue = pickProfileTaxValue(tax);
  const acres = tax.tcadAcres ?? tax.gisAcres ?? profile.physical.lotSizeAcres;
  const propId =
    result.subjectTcad?.propId ?? profile.identifiers.propId ?? null;

  return (
    <div className="border-t border-border pt-3 space-y-2">
      {propId != null && (
        <div className="text-xs font-mono text-muted-foreground">
          TCAD PROP_ID: {propId}
        </div>
      )}
      {taxValue != null && (
        <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-3 py-2">
          <span className="section-label">Tax Value</span>
          <span className="font-mono font-medium">{formatPrice(taxValue)}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-3 py-2">
        <span className="section-label">TCAD Acres</span>
        <span className="font-mono">{formatLotAcres(acres)}</span>
      </div>
      {tax.deedDate && (
        <div className="text-xs text-muted-foreground">
          <Clock size={10} className="inline mr-1 text-amber-400/60" />
          Deed date {formatSoldDate(tax.deedDate)}
        </div>
      )}
    </div>
  );
}

export function SubjectPropertyCard({
  result,
  selectedPropId,
  onSelectPropId,
}: SubjectPropertyCardProps) {
  const subject = result.subject;
  const subjectLabel =
    subject?.address ??
    result.subjectTcad?.situsAddress ??
    "Subject property";

  const subjectBeds = subject?.bedrooms ?? result.filters.minBedrooms;
  const subjectBaths = subject?.bathrooms ?? result.filters.minBathrooms;

  const hasMlsDetails = subject != null;
  const showPropIdHeader =
    result.subjectTcad?.propId != null &&
    result.subjectProfile?.tcadMatch.status !== "ambiguous";

  return (
    <div className="blueprint-card p-5 text-sm space-y-4 flex flex-col">
      <div>
        <div className="section-label mb-1">Subject property</div>
        <div
          className="font-semibold text-base"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {subjectLabel}
        </div>
        {showPropIdHeader && (
          <div className="text-xs font-mono text-muted-foreground mt-1">
            TCAD PROP_ID: {result.subjectTcad!.propId}
          </div>
        )}
      </div>

      {hasMlsDetails ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Beds/Baths</div>
              <div className="font-mono font-medium mt-0.5">
                {subjectBeds ?? "—"}/{subjectBaths ?? "—"}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Sq Ft</div>
              <div className="font-mono font-medium mt-0.5">
                {subject.livingAreaSqft?.toLocaleString() ?? "—"}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px]">Built</div>
              <div className="font-mono font-medium mt-0.5">
                {subject.yearBuilt ?? "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Droplets size={9} className="text-amber-400/70" />
                Pool
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatOptionalYesNo(subject.hasPool)}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Car size={9} className="text-amber-400/70" />
                Garage
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatGarageSpaces(subject.garageSpaces, subject.hasGarage)}
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2 text-center">
              <div className="section-label text-[9px] flex items-center justify-center gap-1">
                <Trees size={9} className="text-amber-400/70" />
                Lot
              </div>
              <div className="font-mono font-medium mt-0.5">
                {formatLotAcres(subject.lotSizeAcres)}
              </div>
            </div>
          </div>

          {subject.condition && (
            <div className="flex items-center justify-between gap-3 text-xs bg-secondary/50 rounded px-3 py-2">
              <span className="section-label">House Condition</span>
              <span
                className={`px-2 py-0.5 rounded border font-medium ${conditionBadgeClass(subject.condition)}`}
              >
                {subject.condition}
              </span>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            {isOpenListing(subject) ? (
              <div className="flex justify-between items-baseline">
                <span className="section-label">List Price</span>
                <span className="price-display text-lg">
                  {subject.listPrice != null
                    ? formatPrice(subject.listPrice)
                    : "—"}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-baseline">
                  <span className="section-label">Sold Price</span>
                  <span className="price-display text-lg">
                    {subject.closePrice != null
                      ? formatPrice(subject.closePrice)
                      : "—"}
                  </span>
                </div>
                {subject.listPrice != null && (
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="section-label">List Price (at sale)</span>
                    <span className="font-mono text-muted-foreground">
                      {formatPrice(subject.listPrice)}
                    </span>
                  </div>
                )}
              </>
            )}
            {(subject.propertyType || subject.standardStatus) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {subject.propertyType && <span>{subject.propertyType}</span>}
                {subject.standardStatus && (
                  <span
                    className={`px-2 py-0.5 rounded border font-medium ${statusBadgeClass(subject.standardStatus)}`}
                  >
                    {subject.standardStatus}
                  </span>
                )}
              </div>
            )}
            {subject.pricePerSqft != null && (
              <div className="text-xs font-mono text-muted-foreground">
                ${subject.pricePerSqft}/sqft
              </div>
            )}
            {!isOpenListing(subject) && subject.soldDate !== "—" && (
              <div className="text-xs text-muted-foreground">
                <Clock size={10} className="inline mr-1 text-amber-400/60" />
                Sold {subject.soldDate}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground border border-border/80 bg-secondary/40 rounded px-3 py-2">
          No MLS listing on file for this address — physical details may be
          limited. Comparables search still uses TCAD coordinates.
        </p>
      )}

      <SubjectTaxSection
        result={result}
        selectedPropId={selectedPropId}
        onSelectPropId={onSelectPropId}
      />

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-xs text-muted-foreground font-mono">
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
        <div className="flex flex-wrap gap-3 text-xs font-mono">
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

      <DataSourceCitation source={unifiedSubjectDataSource(result)} />
    </div>
  );
}
