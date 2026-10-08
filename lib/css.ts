// Palette and typography extraction from stylesheet text, inline <style>
// blocks and style="" attributes. Scores are weighted by where a value
// appears so brand colours float above incidental ones.

import { BLACK, COLOR_RE, WHITE, contrast, deltaE, formatHsl, formatRgb, isNeutral, nearestName, parseColor, rgbToHsl, toHex, type RGB } from "./color";
import type { BrandColor, FontFamily } from "./types";

export type CssSource = { label: string; text: string };

type ColorTally = { rgb: RGB; weight: number; count: number; evidence: string[]; roleHints: Record<string, number> };

const GENERIC_FONTS = new Set(["inherit", "initial", "unset", "sans-serif", "serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "cursive", "fantasy", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica neue", "helvetica", "arial", "noto sans", "liberation sans", "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "sfmono-regular", "menlo", "monaco", "consolas", "liberation mono", "courier new", "times new roman", "times", "georgia", "ui-rounded", "emoji", "math", "fangsong", "var(--font-sans)", "sans", "mono", "-webkit-standard"]);

function snippet(s: string, max = 120) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Split CSS into rule blocks: [selector, declarations].
function* rules(css: string): Generator<[string, string]> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const sel = m[1].trim().split(/\s*\}\s*/).pop() || "";
    yield [sel, m[2]];
  }
}

export type CssAnalysis = {
  palette: BrandColor[];
  neutrals: BrandColor[];
  families: FontFamily[];
  heading: string;
  body: string;
  weights: number[];
  baseFontSize?: string;
  lineHeight?: string;
  radiusScale: string[];
  radiusStyle: "sharp" | "soft" | "rounded" | "pill";
  evidence: string[];
};

export function analyseCss(sources: CssSource[], styleAttrs: string[], googleFonts: string[], themeColor: string): CssAnalysis {
  const tally = new Map<string, ColorTally>();
  const fontTally = new Map<string, { usage: number; roles: Set<"heading" | "body" | "mono">; evidence: Set<string>; source: FontFamily["source"]; stack: string }>();
  const weights = new Map<number, number>();
  const radii = new Map<string, number>();
  let baseFontSize: string | undefined, lineHeight: string | undefined;
  const varValues = new Map<string, string>();
  const evidence: string[] = [];

  function addColor(raw: string, weight: number, ev: string, roleHint?: string) {
    const rgb = parseColor(raw);
    if (!rgb) return;
    const hex = toHex(rgb);
    const t = tally.get(hex) || { rgb, weight: 0, count: 0, evidence: [], roleHints: {} };
    t.weight += weight;
    t.count++;
    if (t.evidence.length < 3 && !t.evidence.includes(ev)) t.evidence.push(ev);
    if (roleHint) t.roleHints[roleHint] = (t.roleHints[roleHint] || 0) + weight;
    tally.set(hex, t);
  }

  function addFont(declaration: string, selector: string, ev: string, source: FontFamily["source"] = "css", bonus = 1) {
    const families = declaration.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").replace(/\s*!important/, "")).filter(Boolean);
    const stack = families.join(", ");
    for (const fam of families) {
      const key = fam.toLowerCase();
      // A real family name is letters/digits/spaces/hyphens; anything else is a stray font-feature value such as "cv01" or "opsz" auto.
      if (GENERIC_FONTS.has(key) || key.startsWith("var(") || key.length < 2 || key.length > 40 || !/^[a-z][a-z0-9 _.+-]*$/i.test(fam) || /^(cv|ss)\d{2}$/i.test(fam) || /^(opsz|wght|wdth|ital|slnt|liga|kern|tnum|onum|lnum|pnum|calt|dlig|smcp|zero|frac|case)\b/i.test(fam)) continue;
      const e = fontTally.get(fam) || { usage: 0, roles: new Set(), evidence: new Set(), source, stack };
      e.usage += bonus;
      if (/^(h[1-3]|\.?(heading|headline|title|display|hero))/i.test(selector) || /--(font|ff|typeface)-?(heading|display|title|serif)/i.test(selector)) e.roles.add("heading");
      if (/^(html|body|p|\.?(body|text|paragraph))\b/i.test(selector) || /--(font|ff|typeface)-?(body|sans|base|primary|text)/i.test(selector) || selector === ":root") e.roles.add("body");
      if (/code|pre|mono/i.test(selector) || /mono/i.test(fam)) e.roles.add("mono");
      if (e.evidence.size < 3) e.evidence.add(ev);
      fontTally.set(fam, e);
      break; // only the first real family in a stack is the intended one
    }
  }

  for (const src of sources) {
    for (const [selector, decls] of rules(src.text)) {
      const isRoot = /:root|^html\b|^body\b/.test(selector);
      const isButton = /\.(btn|button|cta)|^button\b|\[type=["']?submit|\ba\.(btn|button)|__(send|submit|signup|cta|primaryButton|button)/i.test(selector);
      const isHeading = /^(h[1-3]\b|\.(heading|headline|title|hero))/i.test(selector);
      for (const d of decls.split(";")) {
        const i = d.indexOf(":");
        if (i < 0) continue;
        const prop = d.slice(0, i).trim().toLowerCase();
        const value = d.slice(i + 1).trim();
        if (!value) continue;
        const ev = `${src.label} · ${snippet(selector, 40)} { ${snippet(prop + ": " + value, 70)} }`;

        if (prop.startsWith("--")) {
          varValues.set(prop, value);
          const colours = value.match(COLOR_RE);
          if (colours) {
            const brandy = /primary|brand|accent|main|cta|highlight|theme|link/i.test(prop);
            const secondary = /secondary|tertiary/i.test(prop);
            // Scale steps (--blue-500), campaign/page-specific tokens and
            // semantic neutrals (border/text/bg/overlay) are design-system
            // plumbing rather than the brand colour, so they count for less.
            const scaleStep = /-\d{2,4}$|-(alpha|campaign|promo|page|dark|light|hover|active|focus|muted|subtle)\b/i.test(prop);
            const semanticNeutral = /border|line|overlay|shadow|divider|text-|-text\b|-bg\b|bg-|surface|background/i.test(prop) && !/brand/i.test(prop);
            const weight = /brand/i.test(prop) && !semanticNeutral ? 18 : brandy && !scaleStep && !semanticNeutral ? 14 : semanticNeutral ? 1.5 : brandy ? 6 : secondary ? 8 : scaleStep ? 1.5 : isRoot ? 4 : 2;
            const hint = /primary|brand|main|theme/i.test(prop) ? "primary" : /secondary/i.test(prop) ? "secondary" : /accent|highlight|cta/i.test(prop) ? "accent" : /background|bg|surface/i.test(prop) ? "background" : /text|foreground|fg|ink/i.test(prop) ? "text" : undefined;
            for (const c of colours) addColor(c, weight, ev, hint);
          }
          if (/^--(font|ff|typeface|type)/.test(prop) && !/size|weight|line|mono|emoji|setting|feature|variation|style|stretch|kerning|smooth|display\b|optical|letter|spacing|tracking|leading|scale|ratio/i.test(prop) && !value.startsWith("var(")) addFont(value, prop, ev, "custom-property", 4);
          continue;
        }
        if (prop === "font-family" || prop === "font") {
          const fam = prop === "font" ? value.split("/").pop()?.replace(/^[\d.]+(px|rem|em)?\s*/, "") || "" : value;
          const resolved = fam.replace(/var\((--[\w-]+)[^)]*\)/g, (_, v) => varValues.get(v) || "");
          addFont(resolved, selector, ev, "css", isRoot || isHeading ? 3 : 1);
        }
        if (prop === "font-weight") {
          const n = value === "bold" ? 700 : value === "normal" ? 400 : Number(value);
          if (n >= 100 && n <= 900) weights.set(n, (weights.get(n) || 0) + 1);
        }
        if (prop === "border-radius" && /^[\d.]+(px|rem|em)$|^9999px$|^50%$|^999px$/.test(value)) radii.set(value, (radii.get(value) || 0) + 1);
        if (isRoot && prop === "font-size" && /^[\d.]+(px|rem|%)$/.test(value) && !baseFontSize) baseFontSize = value;
        if (isRoot && prop === "line-height" && !lineHeight) lineHeight = value;

        const colours = value.match(COLOR_RE);
        if (!colours) continue;
        const isBg = /^(background|background-color|border-color|border|fill|stroke|outline-color|box-shadow)$/.test(prop);
        const isText = prop === "color";
        let weight = 1;
        if (isButton && isBg) weight = 10;
        else if (isButton && isText) weight = 3;
        else if (isRoot && isBg) weight = 3;
        else if (/^(fill|stroke)$/.test(prop)) weight = 0.6;
        else if (prop === "box-shadow") weight = 0.3;
        else if (/^a\b|:hover|link/i.test(selector) && isText) weight = 3;
        const hint = isButton && isBg ? "primary" : isBg && isRoot ? "background" : isText && isRoot ? "text" : isText ? "text" : undefined;
        for (const c of colours) addColor(c, weight, ev, hint);
      }
    }
  }
  for (const s of styleAttrs) {
    const colours = s.match(COLOR_RE);
    if (colours) for (const c of colours) addColor(c, 1.5, `inline style="${snippet(s, 80)}"`);
    const ff = s.match(/font-family\s*:\s*([^;]+)/i);
    if (ff) addFont(ff[1], "inline", `inline style="${snippet(s, 80)}"`);
  }
  if (themeColor) addColor(themeColor, 12, `<meta name="theme-color" content="${themeColor}">`, "primary");
  for (const g of googleFonts) {
    const e = fontTally.get(g) || { usage: 0, roles: new Set(), evidence: new Set(), source: "google-fonts" as const, stack: g };
    e.usage += 3;
    e.source = "google-fonts";
    e.evidence.add(`Google Fonts <link> family=${g}`);
    fontTally.set(g, e);
  }
  // @font-face declarations prove a font is actually shipped by the site.
  for (const src of sources) {
    for (const m of src.text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const fam = m[1].match(/font-family\s*:\s*["']?([^;"']+)/i)?.[1]?.trim();
      if (!fam || GENERIC_FONTS.has(fam.toLowerCase())) continue;
      const host = m[1].match(/url\(["']?(?:https?:)?\/\/([^/"')]+)/i)?.[1];
      const e = fontTally.get(fam) || { usage: 0, roles: new Set(), evidence: new Set(), source: "font-face" as const, stack: fam };
      e.usage += 2;
      if (e.source === "css") e.source = "font-face";
      e.evidence.add(`@font-face { font-family: ${fam}${host ? `; src: ${host}` : ""} } (${src.label})`);
      fontTally.set(fam, e);
    }
  }

  // Cluster colours -----------------------------------------------------------
  const sorted = [...tally.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const clusters: ColorTally[] = [];
  for (const [, t] of sorted) {
    const near = clusters.find((c) => deltaE(c.rgb, t.rgb) < 9);
    if (near) {
      near.weight += t.weight * 0.6;
      near.count += t.count;
      for (const e of t.evidence) if (near.evidence.length < 3 && !near.evidence.includes(e)) near.evidence.push(e);
      for (const [k, v] of Object.entries(t.roleHints)) near.roleHints[k] = (near.roleHints[k] || 0) + v;
    } else clusters.push({ ...t, evidence: [...t.evidence], roleHints: { ...t.roleHints } });
  }
  const brand = clusters.filter((c) => !isNeutral(c.rgb));
  const neutral = clusters.filter((c) => isNeutral(c.rgb));
  const toBrandColor = (c: ColorTally, role: BrandColor["role"]): BrandColor => ({
    hex: toHex(c.rgb),
    rgb: formatRgb(c.rgb),
    hsl: formatHsl(c.rgb),
    name: nearestName(c.rgb),
    role,
    usage: c.count,
    evidence: c.evidence,
    contrast: { onWhite: contrast(c.rgb, WHITE), onBlack: contrast(c.rgb, BLACK), aaOnWhite: contrast(c.rgb, WHITE) >= 4.5, aaOnBlack: contrast(c.rgb, BLACK) >= 4.5 },
    verified: false,
  });
  const palette = brand.slice(0, 6).map((c, i) => {
    const hinted = Object.entries(c.roleHints).sort((a, b) => b[1] - a[1])[0]?.[0] as BrandColor["role"] | undefined;
    const role: BrandColor["role"] = i === 0 ? "primary" : hinted && hinted !== "primary" && hinted !== "background" && hinted !== "text" ? hinted : i === 1 ? "secondary" : "accent";
    return toBrandColor(c, role);
  });
  const neutrals = neutral.slice(0, 4).map((c) => {
    const { l } = rgbToHsl(c.rgb);
    return toBrandColor(c, l > 60 ? "background" : "text");
  });

  // Typography ---------------------------------------------------------------
  const families: FontFamily[] = [...fontTally.entries()]
    .map(([family, e]) => ({ family, stack: e.stack, usage: e.usage, source: e.source, roles: [...e.roles], evidence: [...e.evidence], verified: false }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 8);
  const isMono = (f: FontFamily) => /mono|code|courier/i.test(f.family) || (f.roles.length > 0 && f.roles.every((r) => r === "mono"));
  const textFamilies = families.filter((f) => !isMono(f));
  const heading = textFamilies.find((f) => f.roles.includes("heading"))?.family || textFamilies[0]?.family || "";
  const body = textFamilies.find((f) => f.roles.includes("body"))?.family || textFamilies.find((f) => f.family !== heading)?.family || heading;

  const radiusScale = [...radii.entries()]
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([v]) => v)
    .sort((a, b) => toPx(a) - toPx(b));
  const common = [...radii.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const px = common ? toPx(common) : 0;
  const radiusStyle: CssAnalysis["radiusStyle"] = !common || px <= 2 ? "sharp" : px <= 6 ? "soft" : px <= 16 ? "rounded" : "pill";
  if (common) evidence.push(`Most common border-radius: ${common} (${radii.get(common)} rules)`);
  if (baseFontSize) evidence.push(`Base font-size on :root/html/body: ${baseFontSize}`);

  return {
    palette,
    neutrals,
    families,
    heading,
    body,
    weights: [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).sort((a, b) => a - b),
    baseFontSize,
    lineHeight,
    radiusScale,
    radiusStyle,
    evidence,
  };
}

function toPx(v: string): number {
  if (v === "50%" || /^9{3,}px$/.test(v)) return 999;
  const n = parseFloat(v);
  if (v.endsWith("rem") || v.endsWith("em")) return n * 16;
  return n;
}
