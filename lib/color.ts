// Colour parsing, normalisation, naming, contrast and clustering helpers.
// Everything here is deterministic so the palette is reproducible per site.

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

const NAMED: [string, string][] = [
  ["Black", "#000000"], ["White", "#ffffff"], ["Charcoal", "#36454f"], ["Slate", "#475569"], ["Graphite", "#2f3237"],
  ["Silver", "#c0c0c0"], ["Gray", "#808080"], ["Light Gray", "#d3d3d3"], ["Off White", "#f5f5f5"], ["Ivory", "#fffff0"],
  ["Navy", "#1e2a5a"], ["Midnight", "#121a33"], ["Royal Blue", "#4169e1"], ["Indigo", "#4b0082"], ["Violet", "#635bff"],
  ["Blue", "#2563eb"], ["Sky Blue", "#38bdf8"], ["Azure", "#007fff"], ["Cobalt", "#0047ab"], ["Teal", "#0d9488"],
  ["Cyan", "#06b6d4"], ["Turquoise", "#40e0d0"], ["Mint", "#98ff98"], ["Emerald", "#10b981"], ["Green", "#16a34a"],
  ["Forest", "#14532d"], ["Lime", "#84cc16"], ["Olive", "#808000"], ["Yellow", "#facc15"], ["Gold", "#d4af37"],
  ["Amber", "#f59e0b"], ["Orange", "#f97316"], ["Tangerine", "#f28500"], ["Coral", "#ff7f50"], ["Salmon", "#fa8072"],
  ["Red", "#dc2626"], ["Crimson", "#dc143c"], ["Scarlet", "#ff2400"], ["Maroon", "#800000"], ["Burgundy", "#800020"],
  ["Rose", "#f43f5e"], ["Pink", "#ec4899"], ["Hot Pink", "#ff69b4"], ["Magenta", "#d946ef"], ["Fuchsia", "#c026d3"],
  ["Purple", "#7c3aed"], ["Plum", "#8e4585"], ["Lavender", "#b4a7d6"], ["Lilac", "#c8a2c8"], ["Brown", "#8b5a2b"],
  ["Chocolate", "#5c3a21"], ["Tan", "#d2b48c"], ["Beige", "#f5f5dc"], ["Sand", "#e8dcc4"], ["Cream", "#fffdd0"],
  ["Peach", "#ffcba4"], ["Khaki", "#c3b091"], ["Steel Blue", "#4682b4"], ["Periwinkle", "#ccccff"], ["Sea Green", "#2e8b57"],
];

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 8) {
      const a = parseInt(hex.slice(6, 8), 16);
      if (a < 128) return null; // mostly transparent colours are not brand colours
      hex = hex.slice(0, 6);
    }
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  m = s.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const ch = (v: string) => (v.endsWith("%") ? Math.round((parseFloat(v) / 100) * 255) : Math.round(parseFloat(v)));
    if (m[4]) {
      const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a < 0.5) return null;
    }
    const rgb = { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]) };
    if ([rgb.r, rgb.g, rgb.b].some((v) => Number.isNaN(v) || v < 0 || v > 255)) return null;
    return rgb;
  }
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4]) {
      const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a < 0.5) return null;
    }
    return hslToRgb({ h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) });
  }
  return null;
}

export function toHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  const hh = ((h % 360) + 360) % 360;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function luminance({ r, g, b }: RGB) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

// CIE76 ΔE in Lab space. Good enough to merge near-identical shades.
function rgbToLab({ r, g, b }: RGB) {
  const f = (v: number) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const rl = f(r), gl = f(g), bl = f(b);
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = g2(x); y = g2(y); z = g2(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function deltaE(a: RGB, b: RGB): number {
  const la = rgbToLab(a), lb = rgbToLab(b);
  return Math.sqrt((la.L - lb.L) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

export function nearestName(rgb: RGB): string {
  let best = "Custom", bestD = Infinity;
  for (const [name, hex] of NAMED) {
    const d = deltaE(rgb, parseColor(hex)!);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  const { l, s } = rgbToHsl(rgb);
  if (bestD > 18 && s > 10) {
    const h = rgbToHsl(rgb).h;
    const hue = h < 15 || h >= 345 ? "Red" : h < 45 ? "Orange" : h < 70 ? "Yellow" : h < 160 ? "Green" : h < 200 ? "Teal" : h < 250 ? "Blue" : h < 290 ? "Purple" : "Pink";
    return (l < 30 ? "Deep " : l > 75 ? "Light " : "") + hue;
  }
  return best;
}

export function isNeutral(rgb: RGB): boolean {
  const { s, l } = rgbToHsl(rgb);
  return s < 12 || l > 94 || l < 7 || (s < 22 && (l > 85 || l < 18));
}

export function formatRgb({ r, g, b }: RGB) {
  return `rgb(${r}, ${g}, ${b})`;
}
export function formatHsl(rgb: RGB) {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export const WHITE: RGB = { r: 255, g: 255, b: 255 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };

// Matches any colour literal inside a chunk of CSS/HTML.
export const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
