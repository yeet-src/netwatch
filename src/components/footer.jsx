// Key-hint rail. A one-row Box tinted as the rail (the container's own bg —
// reliable full width, unlike a fill of plain spaces, which the text engine
// strips as trailing break-whitespace). Each shortcut is a raised key-cap:
// the key glyph in bold on a tile a shade lighter than the rail, then a
// dimmed label. Right-aligned tag names the data source.
import { Box, Text } from "yeet:tui";

const RAIL = "#12071c"; // matches the title rail
const CAP = "#2a1440"; // key-cap tile, a shade lighter
const GLYPH = "#ffd166"; // bright gold key text
const LABEL = "#b58fd6"; // dimmed violet description

const hint = (keys, label) => [
  <Text bg={CAP} bold fg={GLYPH}>{` ${keys} `}</Text>,
  <Text fg={LABEL}>{` ${label}   `}</Text>,
];

export default function Footer() {
  return (
    <Box height="1" direction="row" bg={RAIL}>
      <Text break="none">
        {["  ", ...hint("←/→", "cycle interface"), ...hint("q", "quit")]}
      </Text>
      <Box width="1fr" />
      <Text fg="#6a4a8a" break="none">{"synthwave net monitor · /proc/net/dev  "}</Text>
    </Box>
  );
}
