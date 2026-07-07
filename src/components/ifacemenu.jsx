// Interface dropdown. A floating, bordered list of selectable interfaces
// (physical links + the "all" aggregate). Rendered as a Layer child so its
// left/top are absolute; anchored under the title-bar chip. Each row is
// clickable; the current selection is checked and highlighted. Reads the
// `iface`/`ifaces` signals so it restyles live.
import { Box, Text } from "yeet:tui";
import { iface, ifaces, setIface } from "@/probes/netstat.js";
import { menuOpen, BRAND_W } from "@/lib/ui.js";
import { NEON } from "@/lib/retro.js";

const MENU_BG = "#1a0d2b"; // panel fill
const SEL_BG = "#3a1a5c"; // selected row highlight
const BORDER = "#7a3fb0"; // neon violet frame
const W = 24; // menu width in cells

export default function IfaceMenu() {
  return (
    <Box
      left={`${BRAND_W}`}
      top="1"
      width={`${W}`}
      height={() => `${ifaces.get().length + 2}`}
      z={20}
      border={{ line: "round", fg: BORDER }}
      bg={MENU_BG}
    >
      {() => {
        const cur = iface.get();
        return ifaces.get().map((name) => {
          const on = name === cur;
          return (
            <Box
              height="1"
              direction="row"
              bg={on ? SEL_BG : undefined}
              onClick={() => { setIface(name); menuOpen.set(false); }}
            >
              <Text break="none" fg={on ? NEON.white : NEON.dim} bold={on}>
                {on ? " ◈ " : "   "}
              </Text>
              <Text break="none" fg={on ? NEON.cyan : "#c9a9e6"} bold={on}>
                {name === "all" ? "all interfaces" : name}
              </Text>
            </Box>
          );
        });
      }}
    </Box>
  );
}
