// The centerpiece: a two-sided ("mirror") throughput chart over time. Egress
// grows UP from a neon zero-axis, ingress grows DOWN — newest sample on the
// right. Each column is a bar with sub-cell (eighth-block) resolution; cells
// are colored by their height into a synthwave sunset (warm up / cool down),
// so tall bars glow toward gold and pale-cyan tips.
//
// Interactive: hovering the plot lights a vertical crosshair band on that
// column and shows a floating readout of the exact ↑/↓ rates and how long ago.
//
// Perf: the grid depends only on `net` (redraws ~2×/s with new data), never on
// the pointer — the crosshair + readout are separate cheap overlays that read
// `hoverCol`, so mouse motion never rebuilds the grid. And each row's cells are
// coalesced into color *runs* (a handful of <Text> per row) instead of one
// node per cell, since a row's bar color is constant and empties share a color.
import { Box, Text, Layer } from "yeet:tui";
import {
  NEON,
  FULL,
  barCells,
  tipUp,
  tipDown,
  heatUp,
  heatDown,
  splitRate,
  lpad,
} from "@/lib/retro.js";
import { hoverCol } from "@/lib/ui.js";
import { SAMPLE_MS } from "@/probes/netstat.js";

const BG = "#0a0a12"; // near-black with a faint blue cast — the CRT void
export const GUTTER = 9; // gutter width for the value axis (also used for hit-testing)
const XHAIR_BG = "#ff4fd870"; // neon crosshair band (alpha keeps bars readable)

// Cell kinds used by the run-coalescer: an empty (grid) cell, a normal bar
// cell (solid fg), or a down-side tip drawn with the reverse trick.
const K_GRID = 0, K_BAR = 1, K_TIP = 2;

// Newest-aligned window: the last `cols` samples, right-justified, zero-padded.
const take = (arr, cols) => {
  const out = new Array(cols).fill(0);
  const s = arr.slice(-cols);
  for (let i = 0; i < s.length; i++) out[cols - s.length + i] = s[i];
  return out;
};

// Coalesce a row of (char, kind) into as few <Text> runs as possible: adjacent
// cells of the same kind become one styled string. `barColor` is the row's
// (constant) bar color; grid/tip get their own faces.
const runsOf = (chars, kinds, barColor) => {
  const out = [];
  let s = null, k = -1;
  const flush = () => {
    if (s === null) return;
    if (k === K_GRID) out.push(<Text fg={NEON.grid}>{s}</Text>);
    else if (k === K_TIP) out.push(<Text reverse fg={barColor} bg={BG}>{s}</Text>);
    else out.push(<Text fg={barColor}>{s}</Text>);
  };
  for (let i = 0; i < chars.length; i++) {
    if (kinds[i] === k) s += chars[i];
    else { flush(); k = kinds[i]; s = chars[i]; }
  }
  flush();
  return out;
};

// "how long ago" for a column: newest column is "now", each older column is
// one SAMPLE_MS further back.
const ago = (samples) => {
  if (samples <= 0) return "now";
  const sec = (samples * SAMPLE_MS) / 1000;
  if (sec < 60) return `-${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  return `-${m}m${String(Math.round(sec - m * 60)).padStart(2, "0")}s`;
};

export default function MirrorChart({ net, width, height }) {
  const cols = Math.max(1, width - GUTTER);

  // Value at data column `c` without materializing a windowed copy.
  const at = (arr, c) => {
    const i = arr.length - cols + c;
    return i >= 0 && i < arr.length ? arr[i] : 0;
  };

  // Map a pointer event to a hovered data column (clamped into the plot; the
  // gutter maps to the first column rather than dropping out, so the left edge
  // isn't a dead zone). Bound to move/down/drag so hover works even on
  // terminals that report motion only while a button is held.
  const pick = (e) => hoverCol.set(Math.max(0, Math.min(cols - 1, e.clientX - GUTTER)));

  return (
    // Pointer handlers live on the Layer (the common ancestor of the grid and
    // the overlays), so a move over the crosshair/readout still updates
    // hoverCol — a handler on the inner grid would be shadowed by the overlays
    // on top of it. Having a move handler also auto-enables motion reporting.
    <Layer
      width="1fr"
      height="1fr"
      onMouseMove={pick}
      onMouseDown={pick}
      onMouseLeave={() => hoverCol.set(-1)}
    >
      {/* The plot surface. This thunk reads `net` only — NOT hoverCol — so
          pointer motion never rebuilds it. */}
      <Box width="1fr" height="1fr" bg={BG} overflow="hidden">
        {() => {
          const H = Math.max(3, height);
          const topH = (H - 1) >> 1; // egress rows
          const botH = H - 1 - topH; // ingress rows

          const s = net.get();
          const up = take(s.up, cols);
          const down = take(s.down, cols);

          // Joint autoscale so the two halves share one comparable scale.
          let peak = 1;
          for (const v of up) if (v > peak) peak = v;
          for (const v of down) if (v > peak) peak = v;

          const uBar = up.map((v) => barCells((v / peak) * topH));
          const dBar = down.map((v) => barCells((v / peak) * botH));
          const grid = (c) => ((cols - 1 - c) % 8 === 0 ? "·" : " ");

          const chars = new Array(cols);
          const kinds = new Array(cols);
          const rows = [];

          // --- egress: top edge → axis ---
          for (let r = 0; r < topH; r++) {
            const level = topH - r; // 1 at the axis, topH at the top edge
            const color = heatUp(level / topH);
            for (let c = 0; c < cols; c++) {
              const { full, eighths } = uBar[c];
              if (level <= full) { chars[c] = FULL; kinds[c] = K_BAR; }
              else if (level === full + 1 && eighths > 0) { chars[c] = tipUp(eighths); kinds[c] = K_BAR; }
              else { chars[c] = grid(c); kinds[c] = K_GRID; }
            }
            rows.push(<Text height="1" break="none">{[gutterUp(r, topH, peak), ...runsOf(chars, kinds, color)]}</Text>);
          }

          // --- the neon zero axis ---
          rows.push(
            <Text height="1" break="none">
              <Text fg={NEON.dim}>{lpad("0 ", GUTTER)}</Text>
              <Text fg={NEON.axis} bold>{"─".repeat(cols)}</Text>
            </Text>,
          );

          // --- ingress: axis → bottom edge ---
          for (let r = 0; r < botH; r++) {
            const level = r + 1; // 1 at the axis, botH at the bottom edge
            const color = heatDown(level / botH);
            for (let c = 0; c < cols; c++) {
              const { full, eighths } = dBar[c];
              if (level <= full) { chars[c] = FULL; kinds[c] = K_BAR; }
              else if (level === full + 1 && eighths > 0) { chars[c] = tipDown(eighths); kinds[c] = K_TIP; }
              else { chars[c] = grid(c); kinds[c] = K_GRID; }
            }
            rows.push(<Text height="1" break="none">{[gutterDown(r, botH, peak), ...runsOf(chars, kinds, color)]}</Text>);
          }

          return rows;
        }}
      </Box>

      {/* Crosshair band — one Box tinting the hovered column, positioned from
          hoverCol only. Alpha keeps the bars readable underneath. */}
      {() => {
        const hc = hoverCol.get();
        if (hc < 0 || hc >= cols) return null;
        return <Box left={`${GUTTER + hc}`} top="0" width="1" height="1fr" z={20} bg={XHAIR_BG} />;
      }}

      {/* Floating readout. Flips to the side away from the cursor so it never
          covers the column being read, and clamps on-screen. */}
      {() => {
        const hc = hoverCol.get();
        if (hc < 0 || hc >= cols) return null;
        const s = net.get();
        const u = splitRate(at(s.up, hc)), d = splitRate(at(s.down, hc));
        const BW = 16;
        const cx = GUTTER + hc;
        // Prefer the roomier side of the crosshair.
        let left = cx > width / 2 ? cx - BW - 1 : cx + 2;
        left = Math.max(0, Math.min(left, width - BW));
        return (
          <Box left={`${left}`} top="1" width={`${BW}`} height="5" z={30}
               border={{ line: "round", fg: "#ff4fd8" }} bg="#160a20">
            <Text height="1" break="none" fg={NEON.dim}>{` ${ago(cols - 1 - hc)}`}</Text>
            <Text height="1" break="none">
              <Text fg={NEON.gold} bold>{" ▲ "}</Text>
              <Text fg={NEON.gold}>{`${u.num} ${u.unit}`}</Text>
            </Text>
            <Text height="1" break="none">
              <Text fg={NEON.cyan} bold>{" ▼ "}</Text>
              <Text fg={NEON.cyan}>{`${d.num} ${d.unit}`}</Text>
            </Text>
          </Box>
        );
      }}
    </Layer>
  );
}

// Gutter (left value axis) for an egress row. Peak label on the top edge,
// a half-scale tick at the middle, an "↑ TX" marker just above the axis.
function gutterUp(r, topH, peak) {
  if (r === 0) return label(peak, NEON.gold, "▲");
  if (r === Math.max(1, topH >> 1)) return label(peak / 2, NEON.orange, " ");
  if (r === topH - 1) return <Text fg={NEON.gold} bold>{lpad("TX ↑ ", GUTTER)}</Text>;
  return <Text fg={NEON.gridLo}>{lpad("┊ ", GUTTER)}</Text>;
}

// Gutter for an ingress row: "↓ RX" just below the axis, half tick, then the
// peak on the bottom edge.
function gutterDown(r, botH, peak) {
  if (r === 0) return <Text fg={NEON.cyan} bold>{lpad("RX ↓ ", GUTTER)}</Text>;
  if (r === botH >> 1) return label(peak / 2, NEON.blue, " ");
  if (r === botH - 1) return label(peak, NEON.cyan, "▼");
  return <Text fg={NEON.gridLo}>{lpad("┊ ", GUTTER)}</Text>;
}

// A right-aligned "<num><unit>" value tick with a leading marker glyph.
function label(bps, color, marker) {
  const { num, unit } = splitRate(bps);
  return <Text fg={color}>{lpad(`${marker}${num}${unit.replace("/s", "")} `, GUTTER)}</Text>;
}
