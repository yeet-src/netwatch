// Retrowave presentation kit — pure strings + color, no signals, no BPF.
// A synthwave palette (neon on near-black), two vertical "sunset" gradients
// for the mirror chart (warm for egress ↑, cool for ingress ↓), sub-cell
// block-glyph helpers, and byte-rate formatting. Imported by the components
// through the `@/` alias.
import { idx } from "yeet:tui";

// --- palette ------------------------------------------------------------
export const NEON = {
  pink: idx(198), // hot magenta-pink — the brand accent
  magenta: idx(201), // pure fuchsia
  cyan: idx(51), // electric cyan
  blue: idx(39), // deep sky
  purple: idx(93), // grid violet
  gold: idx(220), // sunset gold
  orange: idx(208),
  white: idx(231),
  grid: idx(53), // faint violet — background grid dots
  gridLo: idx(235), // near-black rail
  axis: idx(201), // the zero line
  dim: idx(245),
  faint: idx(240),
};

// Vertical gradients, indexed bottom (near the axis) → top (the peak). Egress
// climbs purple→magenta→pink→orange→gold→pale-yellow (a sunset); ingress
// climbs navy→blue→teal→cyan→pale-cyan (its cool mirror). Coloring a cell by
// its row position gives every bar the iconic synthwave gradient.
const UP_RAMP = [53, 55, 91, 127, 163, 199, 205, 211, 215, 221, 227, 229].map(idx);
const DOWN_RAMP = [17, 18, 19, 20, 26, 32, 39, 45, 51, 87, 123, 159].map(idx);

const pick = (ramp, t) =>
  ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)))];

// t in 0..1 = fraction of the way from the axis to the top/bottom edge.
export const heatUp = (t) => pick(UP_RAMP, t);
export const heatDown = (t) => pick(DOWN_RAMP, t);

// A left→right neon sweep for spelling the brand a letter at a time:
// cyan → blue → violet → magenta → hot-pink → gold.
const BRAND_RAMP = [51, 45, 39, 63, 99, 135, 171, 201, 199, 205, 214, 220].map(idx);
export const brandColor = (t) => pick(BRAND_RAMP, t);

// --- sub-cell block glyphs ----------------------------------------------
// Eighth blocks that fill from the BOTTOM of a cell (▁..▇), plus the full
// block. A bar's tip cell is fractionally filled; everything below it is full.
export const FULL = "█";
const LOWER = ["", "▁", "▂", "▃", "▄", "▅", "▆", "▇"]; // 0..7 eighths from bottom

// Split a bar height (in fractional cells) into whole full cells + the tip's
// fill in eighths (0..8). e.g. 3.4 → { full: 3, eighths: 3 }.
export const barCells = (cells) => {
  const full = Math.floor(cells);
  const eighths = Math.round((cells - full) * 8);
  if (eighths >= 8) return { full: full + 1, eighths: 0 };
  return { full, eighths };
};

// Tip glyph for an egress (upward) bar: partial fill sits at the cell bottom,
// adjacent to the full cells below → a lower block, drawn normally.
export const tipUp = (eighths) => LOWER[eighths] ?? "";

// Tip glyph for an ingress (downward) bar: the fill must sit at the cell TOP.
// There's no full set of upper-eighth glyphs, so we draw the *complementary*
// lower block and let the caller render it with `reverse` (swaps fg/bg), which
// flips a bottom-k/8 block into a top-(8-k)/8 block. Returns null when empty.
export const tipDown = (eighths) => (eighths <= 0 ? null : LOWER[8 - eighths] ?? FULL);

// --- formatting ---------------------------------------------------------
export const lpad = (s, n) => (" ".repeat(n) + s).slice(-n);
export const rpad = (s, n) => (s + " ".repeat(n)).slice(0, n);

const UNITS = ["B", "K", "M", "G", "T"];
// A byte-rate as a compact 1024-based string, e.g. 6320 → "6.2K". `unit`
// controls the suffix ("/s" for rates, "" for totals).
export const fmtRate = (bps, suffix = "/s") => {
  let v = bps < 0 ? 0 : bps, u = 0;
  while (v >= 1024 && u < UNITS.length - 1) { v /= 1024; u++; }
  const num = v >= 100 || u === 0 ? Math.round(v).toString() : v.toFixed(1);
  return `${num}${UNITS[u]}${u === 0 ? "" : "B"}${suffix}`;
};

// Same magnitude, but split so the number and unit can be styled apart.
export const splitRate = (bps) => {
  let v = bps < 0 ? 0 : bps, u = 0;
  while (v >= 1024 && u < UNITS.length - 1) { v /= 1024; u++; }
  const num = v >= 100 || u === 0 ? Math.round(v).toString() : v.toFixed(1);
  return { num, unit: `${UNITS[u]}${u === 0 ? "" : "B"}/s` };
};

// A cumulative byte total for the status rail, e.g. 1.8GB.
export const fmtBytes = (n) => {
  let v = n < 0 ? 0 : n, u = 0;
  while (v >= 1024 && u < UNITS.length - 1) { v /= 1024; u++; }
  const num = v >= 100 || u === 0 ? Math.round(v) : v.toFixed(1);
  return `${num}${UNITS[u]}${u === 0 ? "" : "B"}`;
};
