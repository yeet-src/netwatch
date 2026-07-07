// Shared UI-only state + geometry. These are pure view concerns (which overlay
// is open, where the pointer is) kept out of the data probes. Module-level
// signals so they persist across re-renders and are read by several components.
import { signal } from "yeet:tui";

// Interface dropdown visibility.
export const menuOpen = signal(false);

// Chart column under the pointer, as a data-column index (0 = oldest shown,
// rising to the right); -1 means "not hovering". The chart sets it from
// onMouseMove and reads it to draw the crosshair + readout.
export const hoverCol = signal(-1);

// Title-bar geometry, in cells. The brand sits in a fixed-width box so the
// interface chip that follows starts at a known column — which is where the
// dropdown anchors. Keep these in sync with titlebar.jsx's layout.
export const BRAND_W = 18; // " ◢◤ NETWATCH ◥◣ " box
export const CHIP_W = 20; // the clickable "iface ▾" chip
