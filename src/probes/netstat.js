// Network throughput data layer — graph-polled, no BPF.
//
// The kernel exposes cumulative per-interface byte counters
// (network_interface_stats: recv_bytes / sent_bytes, i.e. /proc/net/dev).
// We poll them on a fixed window and difference consecutive samples into
// per-second rates: sent = egress (↑), recv = ingress (↓). Each interface
// keeps a rolling history so the mirror chart can scroll through time, and a
// synthetic "all" interface sums every non-loopback link.
//
//   kernel -> user : `net` is built with from() over a poll timer — the
//                    timer's lifecycle is tied to the signal being watched.
//   user  -> user  : cycleIface() moves the selection and republishes the
//                    selected interface's history immediately.
import { from, signal } from "yeet:tui";

// A synchronous log during initial eval attaches `yeet run`'s stdout stream,
// so the async self-test lines below actually reach the terminal.
if (import.meta.main) console.log("netstat self-test — sampling…");

const POLL_MS = 500; // sample window; rate = Δbytes / (POLL_MS/1000)
const MAX_COLS = 512; // history kept per interface (chart shows the newest N)
const SECS = POLL_MS / 1000;
const ALL = "all"; // synthetic aggregate interface

const RATE_Q = `{ network_interface_stats { name recv_bytes sent_bytes } }`;
const META_Q = `{ network_interfaces { name default is_up is_loopback is_physical } }`;

// Per-interface rolling state, keyed by name. up/down are rate histories
// (bytes/s, newest last); sUp/sDown are session byte totals.
const blank = () => ({ up: [], down: [], sUp: 0, sDown: 0 });
const history = new Map();
const prev = new Map(); // name -> { recv, sent } from the last sample

const push = (h, up, down) => {
  h.up.push(up);
  h.down.push(down);
  if (h.up.length > MAX_COLS) h.up.shift();
  if (h.down.length > MAX_COLS) h.down.shift();
  h.sUp += up * SECS;
  h.sDown += down * SECS;
};

// --- interface metadata / selection -------------------------------------

// Resolve the list of selectable interfaces once at load: the default route
// first, other non-loopback links after, and the "all" aggregate last. Best
// effort — if the query fails we fall back to just the aggregate.
const meta = await (async () => {
  try {
    const { data } = await yeet.graph.query(META_Q);
    return data?.network_interfaces ?? [];
  } catch {
    return [];
  }
})();

const real = meta.filter((i) => !i.is_loopback);
const def = real.find((i) => i.default) ?? real.find((i) => i.is_physical && i.is_up) ?? real[0];
const names = [];
if (def) names.push(def.name);
for (const i of real) if (i.name !== def?.name) names.push(i.name);
names.push(ALL);

export const ifaces = signal(names);
export const iface = signal(def?.name ?? ALL);

// --- the reactive throughput signal -------------------------------------

const snapshot = (name) => {
  const h = history.get(name) ?? blank();
  const up = h.up, down = h.down;
  const upNow = up.length ? up[up.length - 1] : 0;
  const downNow = down.length ? down[down.length - 1] : 0;
  let upPeak = 0, downPeak = 0;
  for (const v of up) if (v > upPeak) upPeak = v;
  for (const v of down) if (v > downPeak) downPeak = v;
  return {
    name,
    up: up.slice(),
    down: down.slice(),
    upNow,
    downNow,
    upPeak,
    downPeak,
    sUp: h.sUp,
    sDown: h.sDown,
  };
};

let emit = null; // set while `net` is watched, so cycleIface can republish

export const net = from((state) => {
  emit = () => state.set(snapshot(iface.get()));
  const tick = async () => {
    const { data } = await yeet.graph.query(RATE_Q);
    const rows = data?.network_interface_stats ?? [];
    let allUp = 0, allDown = 0;
    for (const r of rows) {
      const p = prev.get(r.name);
      const dUp = p ? Math.max(0, r.sent_bytes - p.sent) : 0;
      const dDown = p ? Math.max(0, r.recv_bytes - p.recv) : 0;
      prev.set(r.name, { recv: r.recv_bytes, sent: r.sent_bytes });
      if (!history.has(r.name)) history.set(r.name, blank());
      push(history.get(r.name), dUp / SECS, dDown / SECS);
      // Aggregate excludes loopback so container/host traffic isn't doubled
      // beyond its real links; lo mirrors itself and would dwarf the rest.
      if (r.name !== "lo") { allUp += dUp; allDown += dDown; }
    }
    if (!history.has(ALL)) history.set(ALL, blank());
    push(history.get(ALL), allUp / SECS, allDown / SECS);
    emit();
  };
  const h = setInterval(() => tick().catch(() => {}), POLL_MS);
  tick().catch(() => {});
  return () => { clearInterval(h); emit = null; };
}, snapshot(iface.get()));

export function cycleIface(dir) {
  const list = ifaces.get();
  const i = list.indexOf(iface.get());
  const next = list[(i + dir + list.length) % list.length];
  iface.set(next);
  if (emit) emit(); // reflect the switch without waiting for the next poll
}

// Select a specific interface by name (from the dropdown). No-op if unknown.
export function setIface(name) {
  if (!ifaces.get().includes(name) || name === iface.get()) return;
  iface.set(name);
  if (emit) emit();
}

// Poll interval in ms — one chart column per sample; the hover readout uses it
// to turn a column index into "how long ago".
export const SAMPLE_MS = POLL_MS;

// --- standalone correctness probe ---------------------------------------
// `yeet run src/probes/netstat.js` — dumps a few real rate samples so you can
// eyeball field names, magnitudes, and that deltas look sane.
if (import.meta.main) {
  console.log("interfaces:", JSON.stringify(names), "default:", def?.name);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let n = 0; n < 5; n++) {
    const { data } = await yeet.graph.query(RATE_Q);
    const rows = data?.network_interface_stats ?? [];
    for (const r of rows) {
      const p = prev.get(r.name);
      if (p) {
        const up = (r.sent_bytes - p.sent) / SECS;
        const down = (r.recv_bytes - p.recv) / SECS;
        if (up || down) console.log(`${r.name.padEnd(16)} ↑${Math.round(up)} ↓${Math.round(down)} B/s`);
      }
      prev.set(r.name, { recv: r.recv_bytes, sent: r.sent_bytes });
    }
    console.log("---");
    await sleep(POLL_MS);
  }
  yeet.exit();
}
