/** Realty360 architecture report visual theme */
export const COLORS = {
  navy: "#0f1729",
  navyMid: "#1e293b",
  navyLight: "#334155",
  amber: "#d97706",
  amberLight: "#fbbf24",
  teal: "#0d9488",
  tealLight: "#5eead4",
  sky: "#0284c7",
  purple: "#7c3aed",
  slate: "#64748b",
  slateLight: "#94a3b8",
  border: "#e2e8f0",
  bg: "#f8fafc",
  bgAlt: "#f1f5f9",
  white: "#ffffff",
  text: "#1e293b",
  textMuted: "#475569",
  strong: "#15803d",
  weak: "#b45309",
  negative: "#b91c1c",
} as const;

export const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
  mono: "Courier",
} as const;

export const PAGE = {
  margin: 56,
  /** Must stay above the bottom content margin (LETTER 792 - margin - 20 ≈ 716). */
  footerY: 700,
} as const;

export const TYPE = {
  coverTitle: 28,
  coverSubtitle: 13,
  h1: 20,
  h2: 15,
  h3: 11.5,
  body: 10.5,
  small: 9,
  caption: 8.5,
  mono: 9,
} as const;
