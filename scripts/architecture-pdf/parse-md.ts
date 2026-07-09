import { stripMd } from "./layout";

export type ContentBlock =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[] }
  | { kind: "code"; lines: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "diagram"; id: DiagramId }
  | { kind: "skip" };

export type DiagramId =
  | "topology"
  | "dev-stack"
  | "profile"
  | "comp-enrichment"
  | "multi-parcel"
  | "flip-pipeline"
  | "tcad-read"
  | "comp-roles"
  | "viability"
  | "coverage";

const DIAGRAM_AFTER_HEADING: Record<string, DiagramId> = {
  "### 2.1 High-Level Topology": "topology",
  "### 2.2 Request Path (Development)": "dev-stack",
  "### 3.6 MLS comps enriched with TCAD tax data": "comp-roles",
  "### 5.1 Comparables Search": "comp-enrichment",
  "### 5.2 Property Profile": "profile",
  "### 4.2 TCAD (Travis Central Appraisal District)": "tcad-read",
  "### 8.2 Cost Stack": "flip-pipeline",
  "### 8.3 Viability Bands": "viability",
  "### MLS ↔ TCAD coverage (July 2026 audit)": "coverage",
};

function isAsciiDiagram(lines: string[]): boolean {
  const joined = lines.join("");
  return /[┌└│├─▼▶]/.test(joined) || (lines.length > 4 && joined.includes("│"));
}

function isShellCode(lines: string[]): boolean {
  const first = lines[0]?.trim() ?? "";
  return (
    first.startsWith("pnpm ") ||
    first.startsWith("curl ") ||
    first.startsWith("http") ||
    lines.some((l) => l.trim().startsWith("curl "))
  );
}

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/\*\*/g, ""));
}

export function parseArchitectureMarkdown(md: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = md.split("\n");
  let i = 0;
  let skipUntilH2 = false;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip appendix ASCII diagrams section
    if (line.startsWith("## 12. Appendix")) {
      skipUntilH2 = true;
      i += 1;
      continue;
    }
    if (skipUntilH2) {
      if (line.startsWith("## ") && !line.startsWith("## 12.")) skipUntilH2 = false;
      else {
        i += 1;
        continue;
      }
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;

      if (isAsciiDiagram(codeLines)) {
        blocks.push({ kind: "skip" });
      } else if (codeLines.length === 1 && !codeLines[0]!.includes(" ")) {
        blocks.push({ kind: "p", text: codeLines[0]! });
      } else if (isShellCode(codeLines) || codeLines.length <= 12) {
        blocks.push({ kind: "code", lines: codeLines });
      } else {
        blocks.push({ kind: "skip" });
      }
      continue;
    }

    if (line.startsWith("|") && line.includes("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        tableLines.push(lines[i]!);
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|[\s\-:|]+\|$/.test(row.trim()))
        .map(parseTableRow);
      if (rows.length > 0) blocks.push({ kind: "table", rows });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: stripMd(line.slice(2)) });
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = stripMd(line.slice(3));
      blocks.push({ kind: "h2", text: heading });
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      const raw = line.slice(4).trim();
      const heading = stripMd(raw);
      blocks.push({ kind: "h3", text: heading });

      const diagramId = DIAGRAM_AFTER_HEADING[`### ${raw}`];
      if (diagramId) blocks.push({ kind: "diagram", id: diagramId });

      i += 1;
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "numbered", items });
      continue;
    }

    // Bullet list (including indented sub-bullets flattened)
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "bullets", items });
      continue;
    }

    // Paragraph
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("#") &&
      !lines[i]!.startsWith("```") &&
      !lines[i]!.startsWith("|") &&
      !/^---+$/.test(lines[i]!.trim()) &&
      !/^\d+\.\s/.test(lines[i]!) &&
      !/^[-*]\s/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    const text = stripMd(para.join(" "));
    if (text && !text.startsWith("*End of report")) {
      blocks.push({ kind: "p", text });
    }
  }

  return blocks;
}

/** Table of contents entries (section 1–11, skip appendix) */
export function tocEntries(md: string): string[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## ") && !l.includes("Table of Contents") && !l.startsWith("## 12."))
    .map((l) => stripMd(l.slice(3)));
}
