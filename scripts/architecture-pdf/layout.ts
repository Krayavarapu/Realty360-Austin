import type PDFKit from "pdfkit";
import { COLORS, FONTS, PAGE, TYPE } from "./theme";

export type PdfDoc = PDFKit.PDFDocument;

export function contentWidth(doc: PdfDoc): number {
  return doc.page.width - PAGE.margin * 2;
}

export function ensureSpace(doc: PdfDoc, height: number): void {
  const bottom = doc.page.height - PAGE.margin - 24;
  if (doc.y + height > bottom) doc.addPage();
}

export function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function drawPageFooter(doc: PdfDoc, pageNum: number): void {
  const y = PAGE.footerY;
  const w = doc.page.width;
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE.margin, y - 12)
    .lineTo(w - PAGE.margin, y - 12)
    .stroke();
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.caption)
    .fillColor(COLORS.slate);
  doc.text("Realty360 Austin — Architecture Report v1.3", PAGE.margin, y - 4, {
    width: contentWidth(doc) / 2,
    align: "left",
  });
  doc.text(`Page ${pageNum}`, PAGE.margin, y - 4, {
    width: contentWidth(doc),
    align: "right",
  });
}

export function drawSectionBanner(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 48);
  const w = contentWidth(doc);
  const y = doc.y;
  doc.roundedRect(PAGE.margin, y, w, 32, 4).fill(COLORS.navy);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.h1)
    .fillColor(COLORS.white)
    .text(title, PAGE.margin + 14, y + 9, { width: w - 28 });
  doc.y = y + 44;
}

export function drawSubheading(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 28);
  doc.moveDown(0.35);
  const y = doc.y;
  doc.rect(PAGE.margin, y, 4, 18).fill(COLORS.amber);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.h2)
    .fillColor(COLORS.navy)
    .text(title, PAGE.margin + 12, y + 1, { width: contentWidth(doc) - 12 });
  doc.y = y + 26;
}

export function drawMinorHeading(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 22);
  doc.moveDown(0.2);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.h3)
    .fillColor(COLORS.navyMid)
    .text(title, PAGE.margin, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.15);
}

export function drawParagraph(doc: PdfDoc, text: string): void {
  ensureSpace(doc, 18);
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.body)
    .fillColor(COLORS.text)
    .text(stripMd(text), PAGE.margin, doc.y, {
      width: contentWidth(doc),
      lineGap: 3,
    });
  doc.moveDown(0.35);
}

export function drawBullets(doc: PdfDoc, items: string[]): void {
  const w = contentWidth(doc) - 16;
  for (const item of items) {
    doc.font(FONTS.regular).fontSize(TYPE.body);
    const h = doc.heightOfString(stripMd(item), { width: w, lineGap: 2 }) + 6;
    ensureSpace(doc, h);
    const y = doc.y;
    doc.circle(PAGE.margin + 6, y + 5, 2.5).fill(COLORS.amber);
    doc
      .fillColor(COLORS.text)
      .text(stripMd(item), PAGE.margin + 16, y, { width: w, lineGap: 2 });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.2);
}

export function drawNumberedList(doc: PdfDoc, items: string[]): void {
  const w = contentWidth(doc) - 22;
  items.forEach((item, i) => {
    doc.font(FONTS.regular).fontSize(TYPE.body);
    const h = doc.heightOfString(stripMd(item), { width: w, lineGap: 2 }) + 6;
    ensureSpace(doc, h);
    const y = doc.y;
    doc
      .font(FONTS.bold)
      .fontSize(TYPE.small)
      .fillColor(COLORS.teal)
      .text(String(i + 1), PAGE.margin, y + 1, { width: 14 });
    doc
      .font(FONTS.regular)
      .fontSize(TYPE.body)
      .fillColor(COLORS.text)
      .text(stripMd(item), PAGE.margin + 18, y, { width: w, lineGap: 2 });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.2);
}

export function drawTable(
  doc: PdfDoc,
  rows: string[][],
  opts?: { colWidths?: number[] },
): void {
  if (rows.length === 0) return;
  const totalW = contentWidth(doc);
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths =
    opts?.colWidths ??
    Array.from({ length: colCount }, () => totalW / colCount);

  const padding = 6;
  const heights = rows.map((row) => {
    let maxH = 18;
    row.forEach((cell, c) => {
      doc.font(FONTS.regular).fontSize(TYPE.small);
      const h =
        doc.heightOfString(stripMd(cell), {
          width: (colWidths[c] ?? totalW / colCount) - padding * 2,
        }) + padding * 2;
      maxH = Math.max(maxH, h);
    });
    return maxH;
  });

  ensureSpace(doc, heights.reduce((a, b) => a + b, 0) + 8);
  let y = doc.y;
  const x0 = PAGE.margin;

  rows.forEach((row, r) => {
    const rowH = heights[r]!;
    const isHeader = r === 0;
    if (isHeader) {
      doc.roundedRect(x0, y, totalW, rowH, 3).fill(COLORS.navyMid);
    } else if (r % 2 === 0) {
      doc.rect(x0, y, totalW, rowH).fill(COLORS.bg);
    }
    let x = x0;
    row.forEach((cell, c) => {
      const cw = colWidths[c] ?? totalW / colCount;
      doc
        .font(isHeader ? FONTS.bold : FONTS.regular)
        .fontSize(TYPE.small)
        .fillColor(isHeader ? COLORS.white : COLORS.text)
        .text(stripMd(cell), x + padding, y + padding, {
          width: cw - padding * 2,
          lineGap: 1,
        });
      x += cw;
    });
    y += rowH;
  });

  doc
    .strokeColor(COLORS.border)
    .rect(x0, doc.y, totalW, y - doc.y)
    .stroke();
  doc.y = y + 10;
}

export function drawCodeBlock(doc: PdfDoc, lines: string[]): void {
  const text = lines.join("\n");
  const w = contentWidth(doc);
  doc.font(FONTS.mono).fontSize(TYPE.mono);
  const innerW = w - 20;
  const h = doc.heightOfString(text, { width: innerW, lineGap: 1 }) + 18;
  ensureSpace(doc, h + 8);
  const y = doc.y;
  doc.roundedRect(PAGE.margin, y, w, h, 4).fillAndStroke(COLORS.bgAlt, COLORS.border);
  doc
    .fillColor(COLORS.navyMid)
    .text(text, PAGE.margin + 10, y + 9, { width: innerW, lineGap: 1 });
  doc.y = y + h + 8;
}

export function drawCallout(doc: PdfDoc, text: string, variant: "info" | "note" = "info"): void {
  const w = contentWidth(doc);
  doc.font(FONTS.regular).fontSize(TYPE.small);
  const innerW = w - 24;
  const h = doc.heightOfString(stripMd(text), { width: innerW, lineGap: 2 }) + 20;
  ensureSpace(doc, h + 6);
  const y = doc.y;
  const accent = variant === "info" ? COLORS.teal : COLORS.amber;
  doc.roundedRect(PAGE.margin, y, w, h, 4).fill("#ecfeff");
  doc.rect(PAGE.margin, y, 4, h).fill(accent);
  doc
    .fillColor(COLORS.textMuted)
    .text(stripMd(text), PAGE.margin + 14, y + 10, { width: innerW, lineGap: 2 });
  doc.y = y + h + 10;
}

export function drawDiagramCaption(doc: PdfDoc, caption: string): void {
  doc.moveDown(0.15);
  doc
    .font(FONTS.oblique)
    .fontSize(TYPE.caption)
    .fillColor(COLORS.slate)
    .text(caption, PAGE.margin, doc.y, {
      width: contentWidth(doc),
      align: "center",
    });
  doc.moveDown(0.5);
}
