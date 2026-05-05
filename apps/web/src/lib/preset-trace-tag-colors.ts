/** Convert HSL (h 0–360, s/l 0–100) to lowercase #rrggbb. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let rp: number;
  let gp: number;
  let bp: number;
  if (hue < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (hue < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (hue < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (hue < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }
  const to255 = (v: number) => Math.round((v + m) * 255);
  return `#${[to255(rp), to255(gp), to255(bp)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

const HUE_COLUMNS = 8;
const ROW_SLICES: { s: number; l: number }[] = [
  { s: 62, l: 92 },
  { s: 68, l: 80 },
  { s: 74, l: 64 },
  { s: 72, l: 48 },
  { s: 58, l: 32 },
];

/** Five rows × eight hue columns (40 fixed tag colors). */
export const PRESET_TRACE_TAG_COLOR_GRID: string[][] = ROW_SLICES.map(
  ({ s, l }) =>
    Array.from({ length: HUE_COLUMNS }, (_, col) => {
      const h = (col / HUE_COLUMNS) * 360;
      return hslToHex(h, s, l);
    }),
);

// Keep previous app default in the palette so existing UX stays familiar.
PRESET_TRACE_TAG_COLOR_GRID[4][3] = "#2d6a5d";

export const DEFAULT_TRACE_TAG_COLOR = "#2d6a5d";
