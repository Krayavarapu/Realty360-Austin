import type PDFKit from "pdfkit";
import { COLORS, FONTS, PAGE, TYPE } from "./theme";
import { contentWidth, ensureSpace, pdfSafeText } from "./layout";

type Doc = PDFKit.PDFDocument;

interface BoxSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  fill: string;
  stroke: string;
  textColor?: string;
}

function drawNode(doc: Doc, spec: BoxSpec): void {
  const { x, y, w, h, title, subtitle, fill, stroke, textColor = COLORS.white } = spec;
  const safeTitle = pdfSafeText(title);
  const safeSubtitle = subtitle ? pdfSafeText(subtitle) : undefined;
  doc.roundedRect(x, y, w, h, 6).fillAndStroke(fill, stroke);
  doc.font(FONTS.bold).fontSize(9).fillColor(textColor);
  doc.text(safeTitle, x + 8, y + (subtitle ? 10 : h / 2 - 5), {
    width: w - 16,
    align: "center",
  });
  if (safeSubtitle) {
    doc.font(FONTS.regular).fontSize(7.5).fillColor(textColor);
    doc.text(safeSubtitle, x + 8, y + 24, { width: w - 16, align: "center" });
  }
}

function arrowDown(doc: Doc, cx: number, y1: number, y2: number): void {
  doc.strokeColor(COLORS.slateLight).lineWidth(1.5);
  doc.moveTo(cx, y1).lineTo(cx, y2 - 6).stroke();
  doc
    .fillColor(COLORS.slateLight)
    .moveTo(cx, y2)
    .lineTo(cx - 4, y2 - 7)
    .lineTo(cx + 4, y2 - 7)
    .closePath()
    .fill();
}

function arrowRight(doc: Doc, x1: number, y: number, x2: number): void {
  doc.strokeColor(COLORS.slateLight).lineWidth(1.5);
  doc.moveTo(x1, y).lineTo(x2 - 6, y).stroke();
  doc
    .fillColor(COLORS.slateLight)
    .moveTo(x2, y)
    .lineTo(x2 - 7, y - 4)
    .lineTo(x2 - 7, y + 4)
    .closePath()
    .fill();
}

function diagramFrame(doc: Doc, title: string, height: number): number {
  ensureSpace(doc, height + 36);
  const y0 = doc.y;
  const w = contentWidth(doc);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.caption)
    .fillColor(COLORS.slate)
    .text(pdfSafeText(title).toUpperCase(), PAGE.margin, y0, { width: w });
  return y0 + 14;
}

/** System topology — browser → API → data stores */
export function drawSystemTopology(doc: Doc): void {
  const w = contentWidth(doc);
  const cx = PAGE.margin + w / 2;
  const y0 = diagramFrame(doc, "System topology", 200);
  const boxW = 200;
  const boxH = 44;

  drawNode(doc, {
    x: cx - boxW / 2,
    y: y0,
    w: boxW,
    h: boxH,
    title: "Browser (React SPA)",
    subtitle: "Comparables · Flip · Address suggest",
    fill: COLORS.sky,
    stroke: "#0369a1",
  });
  arrowDown(doc, cx, y0 + boxH, y0 + boxH + 28);

  const apiY = y0 + boxH + 28;
  drawNode(doc, {
    x: cx - boxW / 2,
    y: apiY,
    w: boxW,
    h: boxH,
    title: "Express API",
    subtitle: "properties · comparables · profile · flip",
    fill: COLORS.purple,
    stroke: "#6d28d9",
  });

  const dataY = apiY + boxH + 32;
  const gap = 12;
  const dw = (w - gap * 2) / 3;
  const dx = PAGE.margin;

  drawNode(doc, {
    x: dx,
    y: dataY,
    w: dw,
    h: 52,
    title: "MLS SQLite",
    subtitle: "data/mls.sqlite",
    fill: COLORS.teal,
    stroke: "#0f766e",
  });
  drawNode(doc, {
    x: dx + dw + gap,
    y: dataY,
    w: dw,
    h: 52,
    title: "Neon Postgres",
    subtitle: "tcad_parcels (~373k)",
    fill: COLORS.navyMid,
    stroke: COLORS.navy,
  });
  drawNode(doc, {
    x: dx + (dw + gap) * 2,
    y: dataY,
    w: dw,
    h: 52,
    title: "ArcGIS (live)",
    subtitle: "TCAD fallback",
    fill: COLORS.amber,
    stroke: "#b45309",
    textColor: COLORS.navy,
  });

  const apiBottom = apiY + boxH;
  arrowDown(doc, dx + dw / 2, apiBottom, dataY);
  arrowDown(doc, cx, apiBottom, dataY);
  arrowDown(doc, dx + (dw + gap) * 2 + dw / 2, apiBottom, dataY);

  doc.y = dataY + 62;
}

/** Property profile composition */
export function drawProfileComposition(doc: Doc): void {
  const w = contentWidth(doc);
  const cx = PAGE.margin + w / 2;
  const y0 = diagramFrame(doc, "Property profile composition", 175);
  const bw = 130;
  const bh = 40;

  drawNode(doc, {
    x: cx - 70,
    y: y0,
    w: 140,
    h: 36,
    title: "User query",
    subtitle: "address / propId",
    fill: COLORS.navyMid,
    stroke: COLORS.navy,
  });
  arrowDown(doc, cx, y0 + 36, y0 + 56);

  const splitY = y0 + 56;
  const leftX = PAGE.margin + 20;
  const rightX = PAGE.margin + w - bw - 20;

  drawNode(doc, {
    x: leftX,
    y: splitY,
    w: bw,
    h: bh,
    title: "MLS SQLite",
    subtitle: "resolve address",
    fill: COLORS.teal,
    stroke: "#0f766e",
  });
  drawNode(doc, {
    x: rightX,
    y: splitY,
    w: bw,
    h: bh,
    title: "TCAD cache",
    subtitle: "or ArcGIS",
    fill: COLORS.navyMid,
    stroke: COLORS.navy,
  });

  doc.strokeColor(COLORS.slateLight).lineWidth(1.2);
  doc.moveTo(cx, y0 + 36).lineTo(leftX + bw / 2, splitY).stroke();
  doc.moveTo(cx, y0 + 36).lineTo(rightX + bw / 2, splitY).stroke();

  const mergeY = splitY + bh + 28;
  arrowDown(doc, leftX + bw / 2, splitY + bh, mergeY);
  arrowDown(doc, rightX + bw / 2, splitY + bh, mergeY);

  drawNode(doc, {
    x: cx - 95,
    y: mergeY,
    w: 190,
    h: 40,
    title: "PropertyProfileDto",
    subtitle: "identifiers · physical · tax · MLS sale",
    fill: COLORS.purple,
    stroke: "#6d28d9",
  });

  doc.y = mergeY + 54;
}

/** Flip prediction pipeline */
export function drawFlipPipeline(doc: Doc): void {
  const y0 = diagramFrame(doc, "Flip prediction pipeline", 280);
  const x = PAGE.margin + 16;
  const w = contentWidth(doc) - 32;
  const steps = [
    { label: "POST /api/predict/flip", sub: "enriched or manual mode", color: COLORS.navyMid },
    { label: "Load profile (cached)", sub: "MLS + TCAD via fetchPropertyProfileCached", color: COLORS.teal },
    { label: "Resolve living area", sub: "profile sqft or user override", color: COLORS.sky },
    { label: "Derive ARV", sub: "comp median $/sqft × sqft (SQLite)", color: COLORS.purple },
    { label: "Tax basis (Policy B)", sub: "sum taxCandidates · single · purchase fallback", color: COLORS.amber, darkText: true },
    { label: "Cost stack", sub: "rehab · closing · hold · financing", color: COLORS.navyMid },
    { label: "Margins + viability", sub: "strong · marginal · weak · negative", color: COLORS.strong },
  ];

  let y = y0;
  const stepH = 34;
  const gap = 10;

  steps.forEach((step, i) => {
    drawNode(doc, {
      x,
      y,
      w,
      h: stepH,
      title: step.label,
      subtitle: step.sub,
      fill: step.color,
      stroke: COLORS.border,
      textColor: step.darkText ? COLORS.navy : COLORS.white,
    });
    if (i < steps.length - 1) arrowDown(doc, x + w / 2, y + stepH, y + stepH + gap);
    y += stepH + gap;
  });

  doc.y = y + 4;
}

/** TCAD read path decision tree */
export function drawTcadReadPath(doc: Doc): void {
  const w = contentWidth(doc);
  const cx = PAGE.margin + w / 2;
  const y0 = diagramFrame(doc, "TCAD read path", 200);
  const bw = 180;

  drawNode(doc, {
    x: cx - bw / 2,
    y: y0,
    w: bw,
    h: 36,
    title: "API handler",
    subtitle: "profile · tcad · unified · flip",
    fill: COLORS.navyMid,
    stroke: COLORS.navy,
  });
  arrowDown(doc, cx, y0 + 36, y0 + 52);

  drawNode(doc, {
    x: cx - bw / 2,
    y: y0 + 52,
    w: bw,
    h: 32,
    title: "shared/tcad/client.ts",
    fill: COLORS.purple,
    stroke: "#6d28d9",
  });
  arrowDown(doc, cx, y0 + 84, y0 + 100);

  const diamondY = y0 + 100;
  doc
    .font(FONTS.bold)
    .fontSize(8)
    .fillColor(COLORS.navy)
    .text("DATABASE_URL set?", cx - 40, diamondY + 8, { width: 80, align: "center" });
  doc.roundedRect(cx - 50, diamondY, 100, 28, 4).stroke(COLORS.amber);

  const branchY = diamondY + 44;
  const leftX = PAGE.margin + 30;
  const rightX = PAGE.margin + w - 150;

  drawNode(doc, {
    x: leftX,
    y: branchY,
    w: 140,
    h: 48,
    title: "Postgres cache",
    subtitle: "propId · address · radius",
    fill: COLORS.teal,
    stroke: "#0f766e",
  });
  drawNode(doc, {
    x: rightX,
    y: branchY,
    w: 140,
    h: 48,
    title: "ArcGIS live",
    subtitle: "cache miss / no URL",
    fill: COLORS.amber,
    stroke: "#b45309",
    textColor: COLORS.navy,
  });

  doc.strokeColor(COLORS.slateLight).lineWidth(1.2);
  doc.moveTo(cx - 20, diamondY + 28).lineTo(leftX + 70, branchY).stroke();
  doc.moveTo(cx + 20, diamondY + 28).lineTo(rightX + 70, branchY).stroke();
  doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.slate);
  doc.text("YES", leftX + 50, branchY - 12);
  doc.text("NO / miss", rightX + 40, branchY - 12);

  doc.y = branchY + 60;
}

/** Comp roles visual */
export function drawCompRoles(doc: Doc): void {
  const y0 = diagramFrame(doc, "Comparable record roles", 120);
  const w = contentWidth(doc);
  const gap = 10;
  const cw = (w - gap * 2) / 3;
  const roles = [
    {
      title: "sale_comp",
      sub: "Closed MLS sales",
      detail: "TCAD tax merged",
      fill: COLORS.teal,
      stroke: "#0f766e",
    },
    {
      title: "listing_comp",
      sub: "Active / pending",
      detail: "TCAD tax merged",
      fill: COLORS.sky,
      stroke: "#0369a1",
    },
    {
      title: "tax_reference",
      sub: "TCAD radius only",
      detail: "Reference — not ARV",
      fill: COLORS.amber,
      stroke: "#b45309",
      dark: true,
    },
  ];

  roles.forEach((role, i) => {
    const x = PAGE.margin + i * (cw + gap);
    drawNode(doc, {
      x,
      y: y0,
      w: cw,
      h: 72,
      title: role.title,
      subtitle: role.sub,
      fill: role.fill,
      stroke: role.stroke,
      textColor: role.dark ? COLORS.navy : COLORS.white,
    });
    doc
      .font(FONTS.regular)
      .fontSize(7)
      .fillColor(COLORS.slate)
      .text(pdfSafeText(role.detail), x + 6, y0 + 56, { width: cw - 12, align: "center" });
  });

  doc.y = y0 + 88;
}

/** MLS comp TCAD enrichment flow */
export function drawCompEnrichment(doc: Doc): void {
  const y0 = diagramFrame(doc, "MLS comp TCAD enrichment", 210);
  const x = PAGE.margin + 12;
  const w = contentWidth(doc) - 24;
  const items = [
    "MLS closed + open listings in radius",
    "One Neon bbox fetch (findTcadParcelsInRadiusBBox)",
    "Build street-number index in memory",
    "Per comp: address score → nearest same-street parcel",
    "Output CompRecordDto with taxValue + tcadAcres",
  ];

  let y = y0;
  items.forEach((label, i) => {
    const h = 28;
    doc.roundedRect(x, y, w, h, 4).fillAndStroke(COLORS.bg, COLORS.border);
    doc
      .font(FONTS.bold)
      .fontSize(8)
      .fillColor(COLORS.teal)
      .text(String(i + 1), x + 10, y + 9, { width: 16 });
    doc
      .font(FONTS.regular)
      .fontSize(8.5)
      .fillColor(COLORS.text)
      .text(pdfSafeText(label), x + 28, y + 8, { width: w - 36 });
    if (i < items.length - 1) arrowDown(doc, x + w / 2, y + h, y + h + 8);
    y += h + (i < items.length - 1 ? 8 : 0);
  });

  doc.y = y + 8;
}

/** Multi-parcel TCAD decision flow */
export function drawMultiParcelFlow(doc: Doc): void {
  const w = contentWidth(doc);
  const cx = PAGE.margin + w / 2;
  const y0 = diagramFrame(doc, "Multi-parcel TCAD handling", 220);
  const bw = 160;

  drawNode(doc, {
    x: cx - 80,
    y: y0,
    w: 160,
    h: 32,
    title: "TCAD address lookup",
    fill: COLORS.navyMid,
    stroke: COLORS.navy,
  });
  arrowDown(doc, cx, y0 + 32, y0 + 48);

  const outcomes = [
    { x: PAGE.margin + 8, label: "Single match", sub: "profile.tax set", color: COLORS.strong },
    { x: cx - bw / 2, label: "Ambiguous", sub: "taxCandidates[]", color: COLORS.amber, dark: true },
    { x: PAGE.margin + w - bw - 8, label: "Not found", sub: "MLS-only profile", color: COLORS.slate },
  ];

  const oy = y0 + 48;
  outcomes.forEach((o) => {
    drawNode(doc, {
      x: o.x,
      y: oy,
      w: bw,
      h: 44,
      title: o.label,
      subtitle: o.sub,
      fill: o.color,
      stroke: COLORS.border,
      textColor: o.dark ? COLORS.navy : COLORS.white,
    });
  });

  doc.strokeColor(COLORS.slateLight).lineWidth(1);
  doc.moveTo(cx, y0 + 32).lineTo(PAGE.margin + 8 + bw / 2, oy).stroke();
  doc.moveTo(cx, y0 + 32).lineTo(cx, oy).stroke();
  doc.moveTo(cx, y0 + 32).lineTo(PAGE.margin + w - 8 - bw / 2, oy).stroke();

  const policyY = oy + 60;
  drawNode(doc, {
    x: PAGE.margin + 20,
    y: policyY,
    w: w - 40,
    h: 36,
    title: "Policy B (ambiguous)",
    subtitle: "Hold tax = SUM assessed across all taxCandidates",
    fill: "#fef3c7",
    stroke: COLORS.amber,
    textColor: COLORS.navy,
  });

  doc.y = policyY + 48;
}

/** Viability bands horizontal bar chart */
export function drawViabilityBands(doc: Doc): void {
  const y0 = diagramFrame(doc, "Flip viability bands", 70);
  const x = PAGE.margin;
  const w = contentWidth(doc);
  const bands = [
    { label: "negative", pct: "< 0%", color: COLORS.negative, width: 0.15 },
    { label: "weak", pct: "0–6%", color: COLORS.weak, width: 0.2 },
    { label: "marginal", pct: "6–12%", color: COLORS.amber, width: 0.25 },
    { label: "strong", pct: "≥ 12%", color: COLORS.strong, width: 0.4 },
  ];

  let bx = x;
  bands.forEach((b) => {
    const bw = w * b.width;
    doc.roundedRect(bx, y0, bw - 2, 36, 3).fill(b.color);
    doc
      .font(FONTS.bold)
      .fontSize(8)
      .fillColor(COLORS.white)
      .text(b.label, bx + 4, y0 + 8, { width: bw - 8, align: "center" });
    doc
      .font(FONTS.regular)
      .fontSize(7)
      .fillColor(COLORS.white)
      .text(pdfSafeText(b.pct), bx + 4, y0 + 22, { width: bw - 8, align: "center" });
    bx += bw;
  });

  doc.y = y0 + 48;
}

/** MLS ↔ TCAD coverage stats bar chart */
export function drawCoverageStats(doc: Doc): void {
  const y0 = diagramFrame(doc, "MLS ↔ TCAD address coverage (6,139 MLS addresses)", 100);
  const x = PAGE.margin;
  const w = contentWidth(doc);
  const stats = [
    { label: "No TCAD match", count: 4539, color: COLORS.slate },
    { label: "Single parcel", count: 1573, color: COLORS.teal },
    { label: "Multi-parcel", count: 27, color: COLORS.amber },
  ];
  const total = 6139;
  const barH = 22;
  const gap = 8;

  let y = y0;
  stats.forEach((s) => {
    const frac = s.count / total;
    const barW = Math.max(frac * (w - 120), 4);
    doc.font(FONTS.regular).fontSize(TYPE.small).fillColor(COLORS.text);
    doc.text(`${s.label} (${s.count.toLocaleString()})`, x, y + 4, { width: 110 });
    doc.roundedRect(x + 115, y, barW, barH, 3).fill(s.color);
    doc
      .font(FONTS.bold)
      .fontSize(7.5)
      .fillColor(COLORS.white)
      .text(`${Math.round(frac * 100)}%`, x + 118, y + 6, { width: barW - 6 });
    y += barH + gap;
  });

  doc.y = y + 4;
}

/** Dev stack layers */
export function drawDevStack(doc: Doc): void {
  const y0 = diagramFrame(doc, "Development request path", 90);
  const x = PAGE.margin;
  const w = contentWidth(doc);
  const layers = [
    { port: ":3000", name: "Vite (React UI)", color: COLORS.sky },
    { port: "proxy", name: "→ /api/*", color: COLORS.slate },
    { port: ":3001", name: "Express API", color: COLORS.purple },
  ];
  const lw = (w - 20) / 3;

  layers.forEach((layer, i) => {
    const lx = x + i * (lw + 10);
    drawNode(doc, {
      x: lx,
      y: y0,
      w: lw,
      h: 48,
      title: layer.name,
      subtitle: layer.port,
      fill: layer.color,
      stroke: COLORS.border,
      textColor: COLORS.white,
    });
    if (i < layers.length - 1) arrowRight(doc, lx + lw, y0 + 24, lx + lw + 10);
  });

  doc.y = y0 + 58;
}
