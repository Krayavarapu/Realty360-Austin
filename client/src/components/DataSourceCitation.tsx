import { cn } from "@/lib/utils";
import {
  formatPropertyDataSource,
  type PropertyDataSource,
} from "@/lib/data-sources";

type CitationKind =
  | PropertyDataSource
  | "mls-closed-sales"
  | "manual-override"
  | "deal-config";

function formatCitation(kind: CitationKind): string {
  switch (kind) {
    case "mls":
    case "tcad":
    case "both":
      return `Source: ${formatPropertyDataSource(kind)}`;
    case "mls-closed-sales":
      return "Source: MLS closed sales";
    case "manual-override":
      return "Source: Manual override";
    case "deal-config":
      return "Source: Travis County deal defaults (derived)";
  }
}

interface DataSourceCitationProps {
  source: CitationKind;
  className?: string;
}

export function DataSourceCitation({
  source,
  className,
}: DataSourceCitationProps) {
  return (
    <p
      className={cn(
        "text-[10px] text-muted-foreground/80 font-mono pt-2 mt-auto border-t border-border/50",
        className,
      )}
    >
      {formatCitation(source)}
    </p>
  );
}
