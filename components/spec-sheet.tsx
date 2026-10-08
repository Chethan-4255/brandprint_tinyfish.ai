"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, Globe2, Palette, Type, MessageSquareQuote, Megaphone, Receipt, ShieldCheck, Sparkles, FileJson, Braces, FileText, Code2 } from "lucide-react";
import type { BrandColor, BrandGuide, LogoAsset } from "@/lib/types";
import { cssVariables, designTokens, markdownGuide, tailwindSnippet } from "@/lib/exports";

type Props = { guide: BrandGuide; onCopy: (text: string, label: string) => void };

function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#17171c" : "#ffffff";
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Logo({ logo, name, color }: { logo: LogoAsset | null; name: string; color: string }) {
  const [broken, setBroken] = useState(false);
  if (!logo || broken || (!logo.url && !logo.svg)) {
    const initials = name.replace(/[^a-z0-9 ]/gi, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "BP";
    return <div className="initials" style={{ background: color }}>{initials}</div>;
  }
  if (logo.svg) return <div dangerouslySetInnerHTML={{ __html: logo.svg }} aria-label={logo.alt || `${name} logo`} role="img" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo.url} alt={logo.alt || `${name} logo`} onError={() => setBroken(true)} referrerPolicy="no-referrer" />;
}

function Swatch({ c, onCopy }: { c: BrandColor; onCopy: Props["onCopy"] }) {
  const fg = textOn(c.hex);
  return (
    <button className="swatch" onClick={() => onCopy(c.hex, c.hex)} title={`Copy ${c.hex}`}>
      <div className="chip-color" style={{ background: c.hex }}>
        <span className="hex" style={{ color: fg, background: fg === "#ffffff" ? "rgba(0,0,0,.25)" : "rgba(255,255,255,.55)" }}>{c.hex}</span>
        {c.verified && <span className="tick" title="Verified in a real browser by TinyFish Agent" style={{ background: fg === "#ffffff" ? "rgba(255,255,255,.9)" : "rgba(23,23,28,.85)", color: fg === "#ffffff" ? "#17171c" : "#fff" }}><Check size={13} /></span>}
      </div>
      <div className="meta">
        <div className="name"><span>{c.official || c.name}</span>{c.official && <span className="tag o">official</span>}</div>
        <span className="role">{c.role}{c.usage ? ` · ${c.usage} uses` : ""}</span>
        <span className="vals">{c.rgb}<br />{c.hsl}</span>
        <div className="contrast">
          <span className={c.contrast.aaOnWhite ? "aa" : ""} title="Contrast ratio on white"><i style={{ background: "#fff" }} />{c.contrast.onWhite}{c.contrast.aaOnWhite ? " AA" : ""}</span>
          <span className={c.contrast.aaOnBlack ? "aa" : ""} title="Contrast ratio on black"><i style={{ background: "#000" }} />{c.contrast.onBlack}{c.contrast.aaOnBlack ? " AA" : ""}</span>
        </div>
      </div>
    </button>
  );
}

const EXPORTS = [
  { id: "json", label: "JSON", icon: FileJson, file: (s: string) => `${s}-brand-guide.json`, type: "application/json" },
  { id: "css", label: "CSS variables", icon: Code2, file: (s: string) => `${s}-tokens.css`, type: "text/css" },
  { id: "tailwind", label: "Tailwind", icon: Braces, file: (s: string) => `${s}-tailwind.config.js`, type: "text/javascript" },
  { id: "w3c", label: "W3C tokens", icon: Braces, file: (s: string) => `${s}-design-tokens.json`, type: "application/json" },
  { id: "md", label: "Markdown guide", icon: FileText, file: (s: string) => `${s}-brand-guide.md`, type: "text/markdown" },
] as const;

export function SpecSheet({ guide: g, onCopy }: Props) {
  const [tab, setTab] = useState<(typeof EXPORTS)[number]["id"]>("json");
  const slug = g.brand.domain.replace(/[^a-z0-9]+/gi, "-");
  const primary = g.colors.palette[0]?.hex || "#17171c";
  const exportsText = useMemo(
    () => ({ json: JSON.stringify(g, null, 2), css: cssVariables(g), tailwind: tailwindSnippet(g), w3c: JSON.stringify(designTokens(g), null, 2), md: markdownGuide(g) }),
    [g],
  );
  const headingFont = g.typography.heading ? `"${g.typography.heading}", Inter, system-ui, sans-serif` : undefined;
  const bodyFont = g.typography.body ? `"${g.typography.body}", Inter, system-ui, sans-serif` : undefined;

  // Try to load the detected families from Google Fonts for the specimen; if a
  // family is not hosted there the browser silently falls back.
  useEffect(() => {
    const fams = [...new Set([g.typography.heading, g.typography.body].filter(Boolean))];
    if (!fams.length) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [g.typography.heading, g.typography.body]);

  const current = EXPORTS.find((e) => e.id === tab)!;
  const logoIsLight = g.logo.primary?.alt?.match(/white|light|inverse/i) || /white|inverse|light/i.test(g.logo.primary?.url || "");
  const m = g.voice.metrics;

  return (
    <div className="sheet" id="sheet">
      <section className="card">
        <div className="identity">
          <div>
            <div className={"logo-panel" + (logoIsLight ? " dark" : "")}>
              <Logo key={g.logo.primary?.url || g.logo.primary?.svg?.slice(0, 80) || "none"} logo={g.logo.primary} name={g.brand.name} color={primary} />
              <span className="tag">{g.logo.primary ? g.logo.primary.where : "initials fallback"}</span>
            </div>
            <div className="logo-tools">
              {g.logo.primary?.url && <a className="btn small" href={g.logo.primary.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Open logo</a>}
              {g.logo.primary?.svg && <button className="btn small" onClick={() => onCopy(g.logo.primary!.svg!, "SVG markup")}><Copy size={13} /> Copy SVG</button>}
              {g.logo.primary?.url && <button className="btn small" onClick={() => onCopy(g.logo.primary!.url!, "logo URL")}><Copy size={13} /> Copy URL</button>}
            </div>
            {g.logo.alternates.filter((a) => a.url).length > 0 && (
              <div className="alt-logos" title="Alternate logo assets: icons, og:image, other header images">
                {g.logo.alternates.filter((a) => a.url).slice(0, 6).map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" title={`${a.kind} — ${a.where}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.kind} referrerPolicy="no-referrer" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <span className="eyebrow">Brand guide · generated {new Date(g.generatedAt).toLocaleString()}</span>
            <h1 style={{ fontFamily: headingFont }}>{g.brand.name}</h1>
            <a className="domain" href={g.brand.url} target="_blank" rel="noopener noreferrer"><Globe2 size={13} /> {g.brand.domain}</a>
            {g.brand.tagline && <p className="tagline" style={{ fontFamily: headingFont }}>“{g.brand.tagline}”</p>}
            {g.brand.description && <p className="desc">{g.brand.description}</p>}
            <div className="badges">
              <span className={"badge " + (g.tinyfish.agentVerified ? "ok" : "")}>{g.tinyfish.agentVerified ? <ShieldCheck size={13} /> : <Sparkles size={13} />} {g.tinyfish.agentVerified ? "CSS + browser verified" : "CSS verified"}</span>
              {g.brand.industryGuess && <span className="badge ind">{g.brand.industryGuess}</span>}
              {g.brand.themeColor && <span className="badge"><i style={{ width: 10, height: 10, borderRadius: 3, background: g.brand.themeColor, display: "inline-block" }} /> theme-color {g.brand.themeColor}</span>}
              {g.brand.lang && <span className="badge">lang {g.brand.lang}</span>}
              <span className="badge">{(g.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="exportbar">
              {EXPORTS.map((e) => (
                <button key={e.id} className={"btn" + (e.id === "json" ? " solid" : "")} onClick={() => download(e.file(slug), exportsText[e.id], e.type)}><e.icon size={14} /> {e.label}</button>
              ))}
              <button className="btn" onClick={() => onCopy(exportsText.md, "Markdown guide")}><Copy size={14} /> Copy guide</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2><Palette size={18} /> Colour palette</h2>
          <span className="sub">Click a swatch to copy its hex · from {g.colors.cssFilesRead} CSS source{g.colors.cssFilesRead === 1 ? "" : "s"}{g.tinyfish.agentVerified ? " · ✓ = seen rendered in a browser" : ""}</span>
        </div>
        {g.colors.palette.length ? <div className="swatches">{g.colors.palette.map((c) => <Swatch key={c.hex} c={c} onCopy={onCopy} />)}</div> : <p className="empty">No saturated brand colours were found in this site’s CSS.</p>}
        {g.colors.neutrals.length > 0 && (
          <>
            <span className="sec-label">Neutrals</span>
            <div className="neutrals" style={{ marginTop: 0 }}>
              {g.colors.neutrals.map((c) => (
                <button key={c.hex} className="neutral" onClick={() => onCopy(c.hex, c.hex)} title={c.evidence[0]}>
                  <i style={{ background: c.hex }} /><span>{c.name}<br /><span className="mono">{c.hex} · {c.role}</span></span>
                </button>
              ))}
            </div>
          </>
        )}
        <details className="evidence">
          <summary>Where these colours came from</summary>
          <ul>{[...g.colors.palette, ...g.colors.neutrals].map((c) => <li key={c.hex}><b>{c.hex}</b> — {c.evidence.join(" · ")}</li>)}</ul>
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h2><Type size={18} /> Typography</h2>
          <span className="sub">Specimen renders in the detected families when available (falls back to Inter)</span>
        </div>
        <div className="typo">
          <div className="specimen">
            <div className="label"><span>Heading · {g.typography.heading || "system default"}</span><span>{g.typography.weights.length ? `weights ${g.typography.weights.join(" / ")}` : ""}</span></div>
            <p className="h" style={{ fontFamily: headingFont, color: primary }}>{g.brand.tagline || `${g.brand.name} sets the standard.`}</p>
            <div className="label"><span>Body · {g.typography.body || "system default"}</span><span>{g.typography.baseFontSize ? `base ${g.typography.baseFontSize}` : ""}{g.typography.lineHeight ? ` · lh ${g.typography.lineHeight}` : ""}</span></div>
            <p className="b" style={{ fontFamily: bodyFont }}>{g.voice.examples[0]?.text || g.brand.description || "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."}</p>
            <div className="glyphs" style={{ fontFamily: headingFont }}>Aa Bb Cc Dd Ee Ff Gg 0123456789 &amp;?!</div>
            {g.typography.weights.length > 0 && <div className="weights">{g.typography.weights.map((w) => <div key={w}><span style={{ fontFamily: headingFont, fontWeight: w }}>Ag</span><small>{w}</small></div>)}</div>}
          </div>
          <div>
            <div className="families">
              {g.typography.families.length ? g.typography.families.map((f) => (
                <div className="family" key={f.family} title={f.evidence.join("\n")}>
                  <div><div className="fname" style={{ fontFamily: `"${f.family}", Inter, sans-serif` }}>{f.family}</div><span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{f.source}{f.usage ? ` · ${f.usage} refs` : ""}</span></div>
                  <div className="fmeta">{f.roles.map((r) => <span className="tag" key={r}>{r}</span>)}{f.verified && <span className="tag v">verified</span>}</div>
                </div>
              )) : <p className="empty">No custom font families detected — this site likely uses system fonts.</p>}
            </div>
            <span className="sec-label">Corner radius · {g.typography.radiusStyle}</span>
            <div className="radii" style={{ marginTop: 4, marginBottom: 22 }}>
              {(g.typography.radiusScale.length ? g.typography.radiusScale : ["0px"]).map((r) => <div key={r} style={{ borderRadius: r === "50%" ? "50%" : r }}><small>{r}</small></div>)}
            </div>
            <div className="kv">
              <div><b>{g.typography.heading || "—"}</b><span>Heading</span></div>
              <div><b>{g.typography.body || "—"}</b><span>Body</span></div>
              <div><b>{g.typography.radiusStyle}</b><span>Shape</span></div>
              <div><b>{g.typography.weights[g.typography.weights.length - 1] || "—"}</b><span>Heaviest weight</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <div className="card-head"><h2><MessageSquareQuote size={18} /> Tone of voice</h2><span className="sub">{m.sentences} sentences · {m.words} words analysed</span></div>
          <div className="descriptors">{g.voice.descriptors.map((d) => <span key={d}>{d}</span>)}</div>
          <p className="summary">{g.voice.summary}</p>
          <div className="kv">
            <div><b>{m.avgSentenceLength}</b><span>words / sentence</span></div>
            <div><b>{m.fleschReadingEase}</b><span>Flesch ease</span></div>
            <div><b>{m.secondPersonRate}%</b><span>“you” sentences</span></div>
            <div><b>{m.firstPersonPluralRate}%</b><span>“we” sentences</span></div>
            <div><b>{m.contractionRate}%</b><span>contractions</span></div>
            <div><b>{m.exclamationRate}% / {m.questionRate}%</b><span>! / ? rate</span></div>
            <div><b>{m.headingCase}</b><span>heading case</span></div>
            <div><b>{m.emojiCount}</b><span>emoji</span></div>
          </div>
          {g.voice.examples.length > 0 && (
            <>
              <span className="sec-label">In their words</span>
              {g.voice.examples.slice(0, 3).map((e, i) => <blockquote className="quote" key={i}>{e.text}<small>{e.source}</small></blockquote>)}
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2><Megaphone size={18} /> Key messaging</h2><span className="sub">exact quotes with source URLs</span></div>
          {g.messaging.taglines.length > 0 && (
            <div className="taglines">
              <span className="sec-label" style={{ marginTop: 0 }}>Taglines</span>
              {g.messaging.taglines.slice(0, 3).map((t, i) => <blockquote className="quote" key={i}>{t.text}<small>{t.source}</small></blockquote>)}
            </div>
          )}
          {g.messaging.valueProps.length > 0 && (
            <>
              <span className="sec-label">Value propositions</span>
              <ul className="props">{g.messaging.valueProps.map((v, i) => <li key={i}>{v.text}</li>)}</ul>
            </>
          )}
          {g.messaging.mission.length > 0 && (
            <>
              <span className="sec-label">Mission &amp; beliefs</span>
              {g.messaging.mission.slice(0, 3).map((t, i) => <blockquote className="quote" key={i}>{t.text}<small>{t.source}</small></blockquote>)}
            </>
          )}
          {g.messaging.keywords.length > 0 && (
            <>
              <span className="sec-label">Recurring phrases</span>
              <div className="tags">{g.messaging.keywords.map((k) => <span key={k.phrase}>{k.phrase}<b>×{k.count}</b></span>)}</div>
            </>
          )}
          {g.messaging.ctas.length > 0 && (
            <>
              <span className="sec-label">Calls to action</span>
              <div className="ctas">{g.messaging.ctas.map((c) => <span key={c}>{c}</span>)}</div>
            </>
          )}
          {g.messaging.navLabels.length > 0 && (
            <>
              <span className="sec-label">Navigation</span>
              <div className="tags">{g.messaging.navLabels.map((n) => <span key={n}>{n}</span>)}</div>
            </>
          )}
        </section>
      </div>

      {g.browser && (
        <section className="card">
          <div className="card-head"><h2><ShieldCheck size={18} /> Seen in the browser</h2><span className="sub">TinyFish Agent observations on the rendered page</span></div>
          <div className="kv" style={{ marginTop: 0 }}>
            {g.browser.primaryButton?.background && <div><b style={{ display: "flex", alignItems: "center", gap: 8 }}><i style={{ width: 16, height: 16, borderRadius: 4, background: g.browser.primaryButton.background, display: "inline-block" }} />{g.browser.primaryButton.background}</b><span>primary button</span></div>}
            {g.browser.primaryButton?.text && <div><b>{g.browser.primaryButton.text}</b><span>button text</span></div>}
            {g.browser.headerBackground && <div><b style={{ display: "flex", alignItems: "center", gap: 8 }}><i style={{ width: 16, height: 16, borderRadius: 4, background: g.browser.headerBackground, display: "inline-block", border: "1px solid var(--border)" }} />{g.browser.headerBackground}</b><span>header background</span></div>}
            {g.browser.headingFont && <div><b>{g.browser.headingFont}</b><span>heading font</span></div>}
            {g.browser.bodyFont && <div><b>{g.browser.bodyFont}</b><span>body font</span></div>}
            {g.browser.logo?.type && <div><b>{g.browser.logo.type}</b><span>logo type</span></div>}
          </div>
          {g.browser.logo?.description && <p className="summary" style={{ marginTop: 14 }}>{g.browser.logo.description}</p>}
          {g.browser.brandPage?.url && <p className="summary">Official brand page: <a href={g.browser.brandPage.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>{g.browser.brandPage.url}</a>{g.browser.brandPage.officialFonts?.length ? ` · fonts: ${g.browser.brandPage.officialFonts.join(", ")}` : ""}</p>}
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2><Receipt size={18} /> Sources &amp; TinyFish receipts</h2><span className="sub">everything above was read live · {g.tinyfish.urlsFetched} URLs fetched</span></div>
        <div className="receipts">
          <div className="receipt"><b>{g.tinyfish.calls.search}</b><div><strong>TinyFish Search</strong><span>resolved the official site &amp; found brand/about pages</span></div></div>
          <div className="receipt"><b>{g.tinyfish.calls.fetch}</b><div><strong>TinyFish Fetch</strong><span>raw HTML, {g.colors.cssFilesRead} stylesheets, content pages</span></div></div>
          <div className="receipt"><b>{g.tinyfish.calls.agent}</b><div><strong>TinyFish Agent</strong><span>{g.tinyfish.agentVerified ? "verified rendered colours & fonts" : g.tinyfish.depth === "full" ? "attempted, see notes" : "not run in Fast mode"}</span></div></div>
        </div>
        <ul className="sources">
          {g.sources.map((s, i) => (
            <li key={i} className={s.status === "error" ? "err" : ""}><span className="r">{s.role}</span><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>{s.note && <span className="n">{s.note}</span>}</li>
          ))}
        </ul>
        {g.warnings.length > 0 && (
          <details className="warnings"><summary>{g.warnings.length} note{g.warnings.length > 1 ? "s" : ""}</summary>{g.warnings.map((w, i) => <p key={i}>{w}</p>)}</details>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2><Download size={18} /> Export</h2><span className="sub">drop into a deck, Figma tokens plugin, Tailwind config or a CMS</span></div>
        <div className="export-tabs" role="tablist">
          {EXPORTS.map((e) => <button key={e.id} role="tab" aria-selected={tab === e.id} onClick={() => setTab(e.id)}><e.icon size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />{e.label}</button>)}
        </div>
        <pre className="code" tabIndex={0}>{exportsText[tab]}</pre>
        <div className="export-actions">
          <button className="btn" onClick={() => onCopy(exportsText[tab], current.label)}><Copy size={14} /> Copy {current.label}</button>
          <button className="btn solid" onClick={() => download(current.file(slug), exportsText[tab], current.type)}><Download size={14} /> Download {current.file(slug)}</button>
        </div>
      </section>
    </div>
  );
}
