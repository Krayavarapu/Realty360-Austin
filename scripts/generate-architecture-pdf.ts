/**
 * Generate docs/ARCHITECTURE_REPORT.pdf from docs/ARCHITECTURE_REPORT.md
 *
 * Renders a designed PDF with vector diagrams, cover page, and TOC.
 * Usage: pnpm docs:architecture-pdf
 */
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { drawCoverPage, drawTocPage } from "./architecture-pdf/cover";
import {
  drawCompEnrichment,
  drawCompRoles,
  drawCoverageStats,
  drawDevStack,
  drawFlipPipeline,
  drawMultiParcelFlow,
  drawProfileComposition,
  drawSystemTopology,
  drawTcadReadPath,
  drawViabilityBands,
} from "./architecture-pdf/diagrams";
import {
  contentWidth,
  drawBullets,
  drawCallout,
  drawCodeBlock,
  drawDiagramCaption,
  drawMinorHeading,
  drawNumberedList,
  drawPageFooter,
  drawParagraph,
  drawSectionBanner,
  drawSubheading,
  drawTable,
  type PdfDoc,
} from "./architecture-pdf/layout";
import { parseArchitectureMarkdown, type ContentBlock, type DiagramId } from "./architecture-pdf/parse-md";
import { COLORS, FONTS, PAGE, TYPE } from "./architecture-pdf/theme";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const MD_PATH = path.join(REPO_ROOT, "docs", "ARCHITECTURE_REPORT.md");
const PDF_PATH = path.join(REPO_ROOT, "docs", "ARCHITECTURE_REPORT.pdf");

const SKIP_HEADINGS = new Set(["Table of Contents"]);

function drawDiagram(doc: PdfDoc, id: DiagramId): void {
  switch (id) {
    case "topology":
      drawSystemTopology(doc);
      drawDiagramCaption(doc, "Figure 1 — Browser, API, and data store layers");
      break;
    case "dev-stack":
      drawDevStack(doc);
      drawDiagramCaption(doc, "Figure 2 — Development ports and proxy path");
      break;
    case "comp-roles":
      drawCompRoles(doc);
      drawDiagramCaption(doc, "Figure 3 — Unified comparable record roles");
      break;
    case "comp-enrichment":
      drawCompEnrichment(doc);
      drawDiagramCaption(doc, "Figure 4 — Batch TCAD enrichment for MLS comps");
      break;
    case "profile":
      drawProfileComposition(doc);
      drawDiagramCaption(doc, "Figure 5 — MLS + TCAD profile composition");
      drawMultiParcelFlow(doc);
      drawDiagramCaption(doc, "Figure 6 — Multi-parcel TCAD outcomes and Policy B");
      break;
    case "tcad-read":
      drawTcadReadPath(doc);
      drawDiagramCaption(doc, "Figure 7 — Cache-first TCAD read path");
      break;
    case "flip-pipeline":
      drawFlipPipeline(doc);
      drawDiagramCaption(doc, "Figure 8 — Flip prediction pipeline");
      break;
    case "viability":
      drawViabilityBands(doc);
      drawDiagramCaption(doc, "Figure 9 — Net margin viability bands");
      break;
    case "coverage":
      drawCoverageStats(doc);
      drawDiagramCaption(doc, "Figure 10 — MLS address crosswalk outcomes");
      break;
    case "multi-parcel":
      drawMultiParcelFlow(doc);
      break;
  }
}

function renderBlocks(doc: PdfDoc, blocks: ContentBlock[]): void {
  let isFirstH1 = true;
  let isFirstH2 = true;

  for (const block of blocks) {
    switch (block.kind) {
      case "skip":
        break;

      case "h1":
        if (isFirstH1) {
          isFirstH1 = false;
          drawCallout(
            doc,
            block.text +
              " — Version 1.4 for Austin / Travis County. See following sections for system design and data flows.",
            "note",
          );
        }
        break;

      case "h2":
        if (SKIP_HEADINGS.has(block.text)) break;
        if (!isFirstH2) doc.addPage();
        isFirstH2 = false;
        drawSectionBanner(doc, block.text);
        break;

      case "h3":
        drawSubheading(doc, block.text);
        break;

      case "p":
        if (
          block.text.startsWith("Version:") ||
          block.text.startsWith("This document describes")
        ) {
          break;
        }
        if (block.text.startsWith("Deprecation:")) {
          drawCallout(doc, block.text, "note");
          break;
        }
        drawParagraph(doc, block.text);
        break;

      case "bullets":
        drawBullets(doc, block.items);
        break;

      case "numbered":
        drawNumberedList(doc, block.items);
        break;

      case "code":
        drawCodeBlock(doc, block.lines);
        break;

      case "table": {
        const rows = block.rows;
        const isApiTable =
          rows[0]?.[0] === "Method" && rows[0]?.[1] === "Endpoint";
        const isDecisionTable =
          rows[0]?.[0] === "Decision" && rows[0]?.[1] === "Rationale";
        if (isApiTable) {
          drawTable(doc, rows, {
            colWidths: [48, 168, contentWidth(doc) - 216],
          });
        } else if (isDecisionTable) {
          drawTable(doc, rows, {
            colWidths: [145, contentWidth(doc) - 145],
          });
        } else if (rows[0]?.[0] === "Outcome" && rows[0]?.[1] === "Count") {
          drawTable(doc, rows, {
            colWidths: [contentWidth(doc) * 0.72, contentWidth(doc) * 0.28],
          });
        } else if (rows[0]?.[0] === "Net margin % (of ARV)") {
          drawTable(doc, rows, {
            colWidths: [contentWidth(doc) * 0.55, contentWidth(doc) * 0.45],
          });
        } else {
          drawTable(doc, rows);
        }
        break;
      }

      case "diagram":
        doc.moveDown(0.2);
        drawDiagram(doc, block.id);
        break;
    }
  }
}

async function main(): Promise<void> {
  const md = fs.readFileSync(MD_PATH, "utf-8");
  const blocks = parseArchitectureMarkdown(md);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: PAGE.margin,
        bottom: PAGE.margin + 20,
        left: PAGE.margin,
        right: PAGE.margin,
      },
      bufferPages: true,
      info: {
        Title: "Realty360 Austin — Architecture Report",
        Author: "Realty360",
        Subject: "Application architecture and design decisions",
        Keywords: "Realty360, MLS, TCAD, comparables, flip prediction",
      },
    });

    const out = fs.createWriteStream(PDF_PATH);
    doc.pipe(out);

    drawCoverPage(doc);
    drawTocPage(doc, md);

    doc.addPage();
    renderBlocks(doc, blocks);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      if (i === 0) continue; // cover has no footer
      drawPageFooter(doc, i);
    }

    doc.end();
    out.on("finish", () => resolve());
    out.on("error", reject);
  });

  console.log(`Wrote ${PDF_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
