/* netwatch — a synthwave network throughput monitor.
 *
 * A two-sided ("mirror") bar chart of live throughput over time: egress (TX)
 * grows UP from a neon zero-axis, ingress (RX) grows DOWN, newest sample on
 * the right. Everything is graph-polled — no BPF:
 *
 *   kernel → user : probes/netstat.js polls network_interface_stats
 *                   (/proc/net/dev byte counters) on a window and differences
 *                   consecutive samples into per-second rates, exposed as the
 *                   reactive `net` snapshot signal.
 *
 * Interaction: click the interface chip for a dropdown, or ←/→ / wheel to
 * cycle; hover the chart for a per-column readout; q / Esc quits.
 *
 * Layout: probes/ (data) → components/ (pure UI) → lib/ (retro kit + ui state),
 * composed here. The root is a Layer so the dropdown and its scrim float over
 * the dashboard.
 */
import { Box, Layer, mount } from "yeet:tui";
import { net, cycleIface } from "@/probes/netstat.js";
import { menuOpen } from "@/lib/ui.js";
import TitleBar from "@/components/titlebar.jsx";
import MirrorChart from "@/components/mirrorchart.jsx";
import IfaceMenu from "@/components/ifacemenu.jsx";
import Footer from "@/components/footer.jsx";

tty.on("keydown", (e) => {
  const code = e.code;
  const k = (e.key ?? "").toLowerCase();
  if (code === "Escape") return menuOpen.get() ? menuOpen.set(false) : yeet.exit();
  if (k === "q") return yeet.exit();
  if (code === "ArrowLeft" || k === "h" || k === "[") cycleIface(-1);
  else if (code === "ArrowRight" || k === "l" || k === "]") cycleIface(1);
});

// Wheel also cycles the interface — a nice tactile touch.
tty.on?.("wheel", (e) => cycleIface(e.deltaY > 0 ? 1 : -1));

// The root receives the terminal's reactive size signal; reading it inside the
// body thunk reflows the chart on resize. Fixed 1-row title + footer, the
// mirror chart fills the flex body between them. A scrim + dropdown float on
// top when the interface menu is open.
const Root = (size) => (
  <Layer>
    <Box width="1fr" height="1fr">
      <TitleBar net={net} />
      <Box height="1fr" overflow="hidden">
        {() => {
          const { cols, rows } = size.get();
          return <MirrorChart net={net} width={cols} height={Math.max(1, rows - 2)} />;
        }}
      </Box>
      <Footer />
    </Box>
    {() => (menuOpen.get()
      ? <Box width="1fr" height="1fr" z={10} bg="#00000066" onClick={() => menuOpen.set(false)} />
      : null)}
    {() => (menuOpen.get() ? <IfaceMenu /> : null)}
  </Layer>
);

mount(Root);
await new Promise(() => {}); // keep the script alive; the TUI owns the screen
