import type PDFKit from "pdfkit";
import { COLORS, FONTS, PAGE, TYPE } from "./theme";
import { contentWidth, pdfSafeText } from "./layout";
import { tocEntries } from "./parse-md";

export function drawCoverPage(doc: PDFKit.PDFDocument): void {
  const w = doc.page.width;
  const h = doc.page.height;

  // Background bands
  doc.rect(0, 0, w, h * 0.42).fill(COLORS.navy);
  doc.rect(0, h * 0.42, w, 6).fill(COLORS.amber);
  doc.rect(0, h * 0.42 + 6, w, h).fill(COLORS.bg);

  // Accent grid dots
  doc.fillColor(COLORS.navyLight);
  for (let x = 40; x < w; x += 24) {
    for (let y = 40; y < h * 0.38; y += 24) {
      doc.circle(x, y, 0.8).fill();
    }
  }

  doc
    .font(FONTS.bold)
    .fontSize(11)
    .fillColor(COLORS.amberLight)
    .text("REALTY360 AUSTIN", 56, 72, { characterSpacing: 2 });

  doc
    .font(FONTS.bold)
    .fontSize(TYPE.coverTitle)
    .fillColor(COLORS.white)
    .text("Application\nArchitecture Report", 56, 100, { lineGap: 4 });

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.coverSubtitle)
    .fillColor("#cbd5e1")
    .text(
      "System design, data flows, and engineering decisions\nfor Travis County property analysis",
      56,
      175,
      { lineGap: 4 },
    );

  // Version badge
  const badgeY = h * 0.42 + 36;
  doc.roundedRect(56, badgeY, 88, 26, 4).fill(COLORS.amber);
  doc
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(COLORS.navy)
    .text("Version 1.4", 56, badgeY + 7, { width: 88, align: "center" });

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.body)
    .fillColor(COLORS.textMuted)
    .text(pdfSafeText("July 13, 2026  |  Austin / Travis County, TX"), 156, badgeY + 8);

  // Feature pills
  const pills = [
    "MLS SQLite",
    "TCAD Neon Cache",
    "Unified Comps",
    "Flip Engine",
    "Policy B Tax",
  ];
  let px = 56;
  const py = badgeY + 48;
  pills.forEach((pill) => {
    doc.font(FONTS.regular).fontSize(8);
    const pw = doc.widthOfString(pill) + 20;
    doc.roundedRect(px, py, pw, 22, 11).fillAndStroke(COLORS.white, COLORS.border);
    doc.fillColor(COLORS.navyMid).text(pill, px + 10, py + 6);
    px += pw + 8;
  });

  // Stack summary
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.h3)
    .fillColor(COLORS.navy)
    .text("Technology stack", 56, py + 48);

  const stackItems = [
    "Client: Vite + React + shadcn/ui",
    "API: Express (TypeScript)",
    "Domain: shared/ - comps, flip, TCAD, property-profile",
    "Data: data/mls.sqlite + Neon tcad_parcels",
  ];
  doc.font(FONTS.regular).fontSize(TYPE.body).fillColor(COLORS.text);
  stackItems.forEach((item, idx) => {
    doc.circle(62, py + 72 + idx * 18, 2).fill(COLORS.teal);
    doc.text(item, 72, py + 66 + idx * 18);
  });

  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font(FONTS.oblique)
    .fontSize(TYPE.caption)
    .fillColor(COLORS.slate)
    .text(
      pdfSafeText(
        "Generated from docs/ARCHITECTURE_REPORT.md | feature/tax-data-pipeline",
      ),
      56,
      h - 48,
      { width: w - 112, align: "center", lineBreak: false },
    );
  doc.page.margins.bottom = savedBottom;
}

export function drawTocPage(doc: PDFKit.PDFDocument, md: string): void {
  doc.addPage();
  const entries = tocEntries(md);

  doc
    .font(FONTS.bold)
    .fontSize(TYPE.h1)
    .fillColor(COLORS.navy)
    .text("Contents", PAGE.margin, PAGE.margin);

  doc.moveDown(0.8);
  const startY = doc.y;

  entries.forEach((entry, idx) => {
    const y = startY + idx * 22;
    const num = entry.match(/^(\d+)\./)?.[1] ?? String(idx + 1);
    const title = entry.replace(/^\d+\.\s*/, "");

    doc
      .font(FONTS.bold)
      .fontSize(TYPE.body)
      .fillColor(COLORS.amber)
      .text(num, PAGE.margin, y, { width: 24 });

    doc
      .font(FONTS.regular)
      .fontSize(TYPE.body)
      .fillColor(COLORS.text)
      .text(title, PAGE.margin + 28, y, { width: contentWidth(doc) - 28 });

    doc
      .strokeColor(COLORS.border)
      .dash(2, { space: 3 })
      .moveTo(PAGE.margin + 28, y + 14)
      .lineTo(doc.page.width - PAGE.margin, y + 14)
      .stroke()
      .undash();
  });

  doc.y = startY + entries.length * 22 + 20;

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.textMuted)
    .text(
      "Diagrams are embedded inline throughout the report. The markdown appendix uses ASCII placeholders; this PDF renders vector architecture diagrams instead.",
      PAGE.margin,
      doc.y,
      { width: contentWidth(doc), lineGap: 3 },
    );
}
