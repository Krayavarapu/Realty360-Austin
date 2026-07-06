/**
 * Generate docs/ARCHITECTURE_REPORT.pdf from docs/ARCHITECTURE_REPORT.md
 *
 * Usage: pnpm docs:architecture-pdf
 */
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const MD_PATH = path.join(REPO_ROOT, "docs", "ARCHITECTURE_REPORT.md");
const PDF_PATH = path.join(REPO_ROOT, "docs", "ARCHITECTURE_REPORT.pdf");

const PAGE_MARGIN = 54;
const CODE_FONT = "Courier";
const BODY_FONT = "Helvetica";
const BOLD_FONT = "Helvetica-Bold";
const MONO_SIZE = 8.5;
const BODY_SIZE = 10;
const H1_SIZE = 18;
const H2_SIZE = 14;
const H3_SIZE = 11.5;

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "hr" }
  | { kind: "table"; rows: string[][] };

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", lines: codeLines });
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
        .map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim().replace(/\*\*/g, "")),
        );
      if (rows.length > 0) blocks.push({ kind: "table", rows });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: stripMd(line.slice(2)) });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: stripMd(line.slice(3)) });
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: stripMd(line.slice(4)) });
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("#") &&
      !lines[i]!.startsWith("```") &&
      !lines[i]!.startsWith("|") &&
      !/^---+$/.test(lines[i]!.trim())
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ kind: "p", text: stripMd(para.join(" ")) });
  }

  return blocks;
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

function renderBlocks(doc: PDFKit.PDFDocument, blocks: Block[]): void {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  for (const block of blocks) {
    switch (block.kind) {
      case "h1":
        ensureSpace(doc, 40);
        doc.moveDown(0.6);
        doc.font(BOLD_FONT).fontSize(H1_SIZE).fillColor("#1a1a2e");
        doc.text(block.text, PAGE_MARGIN, doc.y, { width: contentWidth });
        doc.moveDown(0.4);
        break;
      case "h2":
        ensureSpace(doc, 32);
        doc.moveDown(0.5);
        doc.font(BOLD_FONT).fontSize(H2_SIZE).fillColor("#16213e");
        doc.text(block.text, PAGE_MARGIN, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
        break;
      case "h3":
        ensureSpace(doc, 24);
        doc.moveDown(0.3);
        doc.font(BOLD_FONT).fontSize(H3_SIZE).fillColor("#0f3460");
        doc.text(block.text, PAGE_MARGIN, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        break;
      case "p":
        ensureSpace(doc, 16);
        doc.font(BODY_FONT).fontSize(BODY_SIZE).fillColor("#222");
        doc.text(block.text, PAGE_MARGIN, doc.y, {
          width: contentWidth,
          align: "left",
          lineGap: 2,
        });
        doc.moveDown(0.25);
        break;
      case "code": {
        const text = block.lines.join("\n");
        doc.font(CODE_FONT).fontSize(MONO_SIZE);
        const h = doc.heightOfString(text, { width: contentWidth - 16 }) + 16;
        ensureSpace(doc, h + 8);
        const y = doc.y;
        doc
          .rect(PAGE_MARGIN, y, contentWidth, h)
          .fillAndStroke("#f4f4f8", "#d0d0d8");
        doc.fillColor("#1a1a1a").text(text, PAGE_MARGIN + 8, y + 8, {
          width: contentWidth - 16,
          lineGap: 1,
        });
        doc.y = y + h;
        doc.moveDown(0.4);
        break;
      }
      case "hr":
        ensureSpace(doc, 12);
        doc
          .moveTo(PAGE_MARGIN, doc.y)
          .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
          .strokeColor("#ccc")
          .stroke();
        doc.moveDown(0.5);
        break;
      case "table": {
        const colCount = Math.max(...block.rows.map((r) => r.length));
        const colWidth = contentWidth / colCount;
        const rowH = 16;
        ensureSpace(doc, rowH * block.rows.length + 8);
        let y = doc.y;
        for (let r = 0; r < block.rows.length; r++) {
          const row = block.rows[r]!;
          const isHeader = r === 0;
          if (isHeader) {
            doc.rect(PAGE_MARGIN, y, contentWidth, rowH).fill("#e8eaf0");
          }
          for (let c = 0; c < colCount; c++) {
            const cell = row[c] ?? "";
            doc
              .font(isHeader ? BOLD_FONT : BODY_FONT)
              .fontSize(8.5)
              .fillColor("#222")
              .text(cell, PAGE_MARGIN + c * colWidth + 4, y + 4, {
                width: colWidth - 8,
                height: rowH - 4,
                ellipsis: true,
              });
          }
          y += rowH;
        }
        doc.y = y;
        doc.moveDown(0.4);
        break;
      }
    }
  }
}

async function main(): Promise<void> {
  const md = fs.readFileSync(MD_PATH, "utf-8");
  const blocks = parseMarkdown(md);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      info: {
        Title: "Realty360 Austin — Architecture Report",
        Author: "Realty360",
        Subject: "Application architecture and design decisions",
      },
    });

    const out = fs.createWriteStream(PDF_PATH);
    doc.pipe(out);

    doc
      .font(BOLD_FONT)
      .fontSize(9)
      .fillColor("#666")
      .text("Realty360 Austin · Architecture Report · July 2026", {
        align: "right",
      });
    doc.moveDown(0.5);

    renderBlocks(doc, blocks);

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
