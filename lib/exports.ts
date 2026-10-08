// Export formats a marketer or designer can drop straight into their tools:
// W3C design tokens, CSS custom properties, a Tailwind theme snippet and a
// Markdown brand guide. Shared by the client UI and documented in the README.

import type { BrandGuide } from "./types";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
}

function tokenName(c: { role: string; name: string }, i: number, used: Set<string>) {
  let base = i === 0 && c.role === "primary" ? "primary" : c.role === "neutral" ? slug(c.name) : c.role === "background" || c.role === "text" ? `${c.role}-${slug(c.name)}` : `${c.role}-${slug(c.name)}`;
  let n = base, k = 2;
  while (used.has(n)) n = `${base}-${k++}`;
  used.add(n);
  base = n;
  return base;
}

export function designTokens(g: BrandGuide) {
  const used = new Set<string>();
  const color: Record<string, unknown> = {};
  g.colors.palette.forEach((c, i) => {
    color[tokenName(c, i, used)] = { $type: "color", $value: c.hex, $description: `${c.name}${c.official ? ` (official: ${c.official})` : ""} · ${c.role} · ${c.verified ? "browser-verified" : "from CSS"}` };
  });
  g.colors.neutrals.forEach((c, i) => {
    color[tokenName({ ...c, role: "neutral" }, i, used)] = { $type: "color", $value: c.hex, $description: `${c.name} · neutral ${c.role}` };
  });
  const fontFamily: Record<string, unknown> = {};
  if (g.typography.heading) fontFamily.heading = { $type: "fontFamily", $value: [g.typography.heading, "sans-serif"] };
  if (g.typography.body) fontFamily.body = { $type: "fontFamily", $value: [g.typography.body, "sans-serif"] };
  const fontWeight: Record<string, unknown> = {};
  for (const w of g.typography.weights) fontWeight[`w${w}`] = { $type: "fontWeight", $value: w };
  const borderRadius: Record<string, unknown> = {};
  g.typography.radiusScale.forEach((r, i) => (borderRadius[["xs", "sm", "md", "lg", "xl", "2xl"][i] || `r${i}`] = { $type: "dimension", $value: r }));
  return {
    $schema: "https://tr.designtokens.org/format/",
    $description: `Design tokens for ${g.brand.name} extracted from ${g.brand.url} by Brandprint on ${g.generatedAt}`,
    color,
    fontFamily,
    fontWeight,
    borderRadius,
  };
}

export function cssVariables(g: BrandGuide): string {
  const used = new Set<string>();
  const lines: string[] = [`/* ${g.brand.name} — extracted from ${g.brand.url} by Brandprint (${g.generatedAt.slice(0, 10)}) */`, ":root {"];
  g.colors.palette.forEach((c, i) => lines.push(`  --color-${tokenName(c, i, used)}: ${c.hex}; /* ${c.name}${c.verified ? ", browser-verified" : ""} */`));
  g.colors.neutrals.forEach((c, i) => lines.push(`  --color-${tokenName({ ...c, role: "neutral" }, i, used)}: ${c.hex}; /* ${c.name} */`));
  if (g.typography.heading) lines.push(`  --font-heading: "${g.typography.heading}", sans-serif;`);
  if (g.typography.body) lines.push(`  --font-body: "${g.typography.body}", sans-serif;`);
  g.typography.radiusScale.forEach((r, i) => lines.push(`  --radius-${["xs", "sm", "md", "lg", "xl", "2xl"][i] || i}: ${r};`));
  lines.push("}");
  return lines.join("\n");
}

export function tailwindSnippet(g: BrandGuide): string {
  const used = new Set<string>();
  const colors = [...g.colors.palette.map((c, i) => `        "${tokenName(c, i, used)}": "${c.hex}",`), ...g.colors.neutrals.map((c, i) => `        "${tokenName({ ...c, role: "neutral" }, i, used)}": "${c.hex}",`)];
  const fonts = [g.typography.heading && `        heading: ["${g.typography.heading}", "sans-serif"],`, g.typography.body && `        body: ["${g.typography.body}", "sans-serif"],`].filter(Boolean);
  const radii = g.typography.radiusScale.map((r, i) => `        ${["xs", "sm", "md", "lg", "xl", "2xl"][i] || `r${i}`}: "${r}",`);
  return `// tailwind.config.js — ${g.brand.name} (Brandprint export)\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colors.join("\n")}\n      },\n      fontFamily: {\n${fonts.join("\n")}\n      },\n      borderRadius: {\n${radii.join("\n")}\n      },\n    },\n  },\n};`;
}

export function markdownGuide(g: BrandGuide): string {
  const L: string[] = [];
  L.push(`# ${g.brand.name} — Brand Guide`);
  L.push(``);
  L.push(`> Extracted from the live site ${g.brand.url} on ${g.generatedAt.slice(0, 10)} by Brandprint (TinyFish Search + Fetch${g.tinyfish.agentVerified ? " + Agent browser verification" : ""}).`);
  L.push(``);
  if (g.brand.tagline) L.push(`**Tagline:** ${g.brand.tagline}  `);
  if (g.brand.description) L.push(`**Description:** ${g.brand.description}  `);
  if (g.brand.industryGuess) L.push(`**Industry (guess):** ${g.brand.industryGuess}  `);
  L.push(``);
  L.push(`## Logo`);
  if (g.logo.primary) L.push(g.logo.primary.url ? `Primary: ${g.logo.primary.url} (${g.logo.primary.where})` : `Primary: inline SVG wordmark (${g.logo.primary.where})`);
  if (g.browser?.logo?.description) L.push(`Browser description: ${g.browser.logo.description}`);
  for (const a of g.logo.alternates.filter((a) => a.url).slice(0, 5)) L.push(`- ${a.kind}: ${a.url}`);
  L.push(``);
  L.push(`## Colour palette`);
  L.push(`| Role | Name | Hex | RGB | HSL | Contrast on white | Contrast on black | Verified |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const c of g.colors.palette) L.push(`| ${c.role} | ${c.official ? `${c.official} (official)` : c.name} | \`${c.hex}\` | ${c.rgb} | ${c.hsl} | ${c.contrast.onWhite}:1 ${c.contrast.aaOnWhite ? "AA" : ""} | ${c.contrast.onBlack}:1 ${c.contrast.aaOnBlack ? "AA" : ""} | ${c.verified ? "browser" : "css"} |`);
  if (g.colors.neutrals.length) {
    L.push(``);
    L.push(`### Neutrals`);
    for (const c of g.colors.neutrals) L.push(`- \`${c.hex}\` ${c.name} (${c.role})`);
  }
  L.push(``);
  L.push(`## Typography`);
  L.push(`- Headings: **${g.typography.heading || "system / not detected"}**`);
  L.push(`- Body: **${g.typography.body || "system / not detected"}**`);
  if (g.typography.weights.length) L.push(`- Weights in use: ${g.typography.weights.join(", ")}`);
  if (g.typography.baseFontSize) L.push(`- Base font size: ${g.typography.baseFontSize}${g.typography.lineHeight ? `, line-height ${g.typography.lineHeight}` : ""}`);
  L.push(`- Corner radius: ${g.typography.radiusStyle}${g.typography.radiusScale.length ? ` (${g.typography.radiusScale.join(" · ")})` : ""}`);
  if (g.typography.families.length) {
    L.push(``);
    L.push(`| Family | Source | Roles | Verified |`);
    L.push(`|---|---|---|---|`);
    for (const f of g.typography.families) L.push(`| ${f.family} | ${f.source} | ${f.roles.join(", ") || "—"} | ${f.verified ? "yes" : "css"} |`);
  }
  L.push(``);
  L.push(`## Tone of voice`);
  L.push(`**${g.voice.descriptors.join(" · ")}**`);
  L.push(``);
  L.push(g.voice.summary);
  L.push(``);
  const m = g.voice.metrics;
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Sentences analysed | ${m.sentences} |`);
  L.push(`| Avg. sentence length | ${m.avgSentenceLength} words |`);
  L.push(`| Flesch reading ease | ${m.fleschReadingEase} |`);
  L.push(`| “You/your” sentences | ${m.secondPersonRate}% |`);
  L.push(`| “We/our” sentences | ${m.firstPersonPluralRate}% |`);
  L.push(`| Contractions | ${m.contractionRate}% |`);
  L.push(`| Exclamations / questions | ${m.exclamationRate}% / ${m.questionRate}% |`);
  L.push(`| Heading case | ${m.headingCase} |`);
  if (g.voice.examples.length) {
    L.push(``);
    L.push(`Examples:`);
    for (const e of g.voice.examples) L.push(`- “${e.text}” — ${e.source}`);
  }
  L.push(``);
  L.push(`## Key messaging`);
  if (g.messaging.taglines.length) {
    L.push(`### Taglines`);
    for (const t of g.messaging.taglines) L.push(`- “${t.text}” — ${t.source}`);
  }
  if (g.messaging.valueProps.length) {
    L.push(`### Value propositions`);
    for (const t of g.messaging.valueProps) L.push(`- ${t.text}`);
  }
  if (g.messaging.mission.length) {
    L.push(`### Mission & beliefs`);
    for (const t of g.messaging.mission) L.push(`- “${t.text}” — ${t.source}`);
  }
  if (g.messaging.keywords.length) L.push(`### Recurring phrases\n${g.messaging.keywords.map((k) => `\`${k.phrase}\` (${k.count})`).join(", ")}`);
  if (g.messaging.ctas.length) L.push(`### Calls to action\n${g.messaging.ctas.map((c) => `“${c}”`).join(", ")}`);
  L.push(``);
  L.push(`## Sources`);
  for (const s of g.sources) L.push(`- ${s.role}: ${s.url}${s.status === "error" ? ` (failed: ${s.note})` : ""}`);
  L.push(``);
  L.push(`TinyFish calls — Search: ${g.tinyfish.calls.search}, Fetch: ${g.tinyfish.calls.fetch} (${g.tinyfish.urlsFetched} URLs), Agent: ${g.tinyfish.calls.agent}.`);
  if (g.warnings.length) {
    L.push(``);
    L.push(`## Notes`);
    for (const w of g.warnings) L.push(`- ${w}`);
  }
  return L.join("\n");
}
