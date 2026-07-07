// Status rail: a gradient neon wordmark, a clickable interface chip (opens the
// dropdown), live ↑/↓ throughput (warm egress / cool ingress), the window peak,
// and session byte totals. One tinted row, laid out as fixed brand + chip +
// flexible stats so the chip sits at a known column for the dropdown to anchor.
import { Box, Text } from "yeet:tui";
import { NEON, brandColor, splitRate, fmtBytes } from "@/lib/retro.js";
import { menuOpen, BRAND_W, CHIP_W } from "@/lib/ui.js";

const RAIL = "#12071c"; // deep violet-black rail
const CHIP = "#251038"; // chip tile at rest
const CHIP_ON = "#3a1a5c"; // chip tile while the dropdown is open
const WORD = "NETWATCH";

// Spell the wordmark one letter at a time across the neon sweep.
const brand = WORD.split("").map((ch, i) => (
  <Text bold fg={brandColor(i / (WORD.length - 1))}>{ch}</Text>
));

const sep = () => <Text fg={NEON.purple}>{"  ▏  "}</Text>;

// A "12.4 MB/s" readout with the number bold and the unit dimmed.
const rate = (bps, color) => {
  const { num, unit } = splitRate(bps);
  return [
    <Text bold fg={color}>{num}</Text>,
    <Text fg={color} dim>{` ${unit}`}</Text>,
  ];
};

export default function TitleBar({ net }) {
  return (
    <Box height="1" direction="row" bg={RAIL}>
      <Box width={`${BRAND_W}`} overflow="hidden">
        <Text break="none">
          {[
            <Text fg={NEON.pink} bold>{" ◢◤ "}</Text>,
            ...brand,
            <Text fg={NEON.pink} bold>{" ◥◣ "}</Text>,
          ]}
        </Text>
      </Box>

      {/* The clickable interface chip — click to toggle the dropdown. */}
      <Box
        width={`${CHIP_W}`}
        overflow="hidden"
        bg={() => (menuOpen.get() ? CHIP_ON : CHIP)}
        onClick={() => menuOpen.update((v) => !v)}
      >
        <Text break="none">
          {() => {
            const open = menuOpen.get();
            return [
              <Text fg={NEON.dim}>{" iface "}</Text>,
              <Text bold fg={NEON.white}>{net.get().name}</Text>,
              <Text fg={open ? NEON.pink : NEON.cyan} bold>{open ? " ▴" : " ▾"}</Text>,
            ];
          }}
        </Text>
      </Box>

      <Box width="1fr" overflow="hidden">
        <Text break="none">
          {() => {
            const s = net.get();
            const pk = splitRate(Math.max(s.upPeak, s.downPeak));
            return [
              sep(),
              <Text fg={NEON.gold} bold>{"▲ "}</Text>, ...rate(s.upNow, NEON.gold),
              <Text fg={NEON.faint}>{"   "}</Text>,
              <Text fg={NEON.cyan} bold>{"▼ "}</Text>, ...rate(s.downNow, NEON.cyan),
              sep(),
              <Text fg={NEON.dim}>{"peak "}</Text>,
              <Text fg={NEON.orange}>{`${pk.num}${pk.unit}`}</Text>,
              sep(),
              <Text fg={NEON.dim}>{"Σ "}</Text>,
              <Text fg={NEON.gold}>{`↑${fmtBytes(s.sUp)}`}</Text>,
              <Text fg={NEON.dim}>{"  "}</Text>,
              <Text fg={NEON.cyan}>{`↓${fmtBytes(s.sDown)}`}</Text>,
            ];
          }}
        </Text>
      </Box>
    </Box>
  );
}
