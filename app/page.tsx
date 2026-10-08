"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, KeyRound, LoaderCircle, Search, FileSearch, MousePointerClick, Zap, Microscope, Code2, History, X } from "lucide-react";
import { SpecSheet } from "@/components/spec-sheet";
import type { BrandGuide, Depth } from "@/lib/types";

const EXAMPLES = ["stripe.com", "notion.so", "Linear"];
type Recent = { name: string; domain: string; color: string; guide: BrandGuide };

export default function Home() {
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>("fast");
  const [guide, setGuide] = useState<BrandGuide | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [counts, setCounts] = useState({ search: 0, fetch: 0, agent: 0 });
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const abort = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    // Hydrate saved settings and recent guides from this browser only.
    const hydrate = () => {
      try {
        const k = localStorage.getItem("brandprint-api-key");
        const r = localStorage.getItem("brandprint-recent");
        if (k) setApiKey(k);
        if (r) setRecent(JSON.parse(r));
      } catch {}
      setReady(true);
    };
    const t = setTimeout(hydrate, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("brandprint-api-key", apiKey);
  }, [apiKey, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  function remember(g: BrandGuide) {
    setRecent((old) => {
      const next = [{ name: g.brand.name, domain: g.brand.domain, color: g.colors.palette[0]?.hex || "#17171c", guide: g }, ...old.filter((r) => r.domain !== g.brand.domain)].slice(0, 5);
      try {
        localStorage.setItem("brandprint-recent", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function generate(value = input, mode = depth) {
    const v = value.trim();
    if (!v || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setGuide(null);
    setCounts({ search: 0, fetch: 0, agent: 0 });
    setPhase("Starting…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json", ...(apiKey ? { "x-tinyfish-api-key": apiKey } : {}) }, body: JSON.stringify({ input: v, depth: mode }), signal: controller.signal });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "The request could not start.");
      if (!response.body) throw new Error("The connection did not open.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "", finished = false;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; message?: string; data?: BrandGuide };
          if (event.type === "progress" && event.message) {
            setPhase(event.message);
            const msg = event.message;
            setCounts((c) => ({ search: c.search + (/^Searching/.test(msg) ? 1 : 0), fetch: c.fetch + (/^Reading/.test(msg) ? 1 : 0), agent: c.agent + (/^Opening the site/.test(msg) ? 1 : 0) }));
          }
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "result" && event.data) {
            setGuide(event.data);
            setCounts(event.data.tinyfish.calls);
            remember(event.data);
            finished = true;
          }
        }
      }
      if (!finished) throw new Error("The connection ended before the brand guide was finished.");
      setTimeout(() => document.getElementById("sheet")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? (e.name === "AbortError" ? "Stopped." : e.message) : "Brand extraction failed. Please try again.");
    } finally {
      setBusy(false);
      busyRef.current = false;
      setPhase("");
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => setToast(`Copied ${label}`)).catch(() => setToast("Copy failed"));
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Brandprint<small>LIVE BRAND GUIDES</small></span></Link>
        <div className="topbar-right">
          <a href="https://www.tinyfish.ai/" target="_blank" rel="noopener noreferrer">Powered by <strong>TinyFish</strong></a>
          <a href="https://github.com/Chethan-4255/brandprint_tinyfish.ai" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository"><Code2 size={16} /><span className="gh-text">GitHub</span></a>
          <details className="key-settings">
            <summary><span className={"key-state" + (apiKey ? " on" : "")} /><KeyRound size={14} /> API key</summary>
            <div className="key-panel">
              <label htmlFor="apiKey">TinyFish API key</label>
              <input type="password" id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Optional — uses the server key if empty" autoComplete="off" />
              <p>Stored only in this browser’s localStorage and sent as a header with your requests. Leave empty to use the key configured on the server.</p>
            </div>
          </details>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="eyebrow">Search · Fetch · Agent — all live, nothing canned</span>
          <h1>Any website in. <em>A brand guide</em> out.</h1>
          <p className="lede">Paste a URL or just a company name. Brandprint reads the live site with TinyFish and returns the logo, colour palette, typography, tone of voice and key messaging as a structured spec sheet you can export.</p>
          <form className="searchbar" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
            <label className="sr-only" htmlFor="input">Website or company name</label>
            <input id="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste a website or company name — e.g. stripe.com or “Linear”" maxLength={300} autoComplete="off" spellCheck={false} />
            <div className="depth" role="group" aria-label="Depth">
              <button type="button" aria-pressed={depth === "fast"} onClick={() => setDepth("fast")}><Zap size={13} /> Fast</button>
              <button type="button" aria-pressed={depth === "full"} onClick={() => setDepth("full")}><Microscope size={13} /> Full</button>
            </div>
            <button className="generate" type="submit" disabled={busy || input.trim().length < 2}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} {busy ? "Extracting…" : "Generate"}</button>
          </form>
          <p className="depth-note">{depth === "fast" ? "Fast: TinyFish Search + Fetch read the HTML, stylesheets and copy (~10–30 s)." : "Full: Fast + a TinyFish Agent opens the site in a real browser to verify rendered colours, fonts and any official brand page (~2–4 min)."}</p>
          <div className="chips">
            <span>TRY</span>
            {EXAMPLES.map((e) => <button key={e} className="chip" type="button" onClick={() => { setInput(e); void generate(e); }}>{e}<ArrowRight size={13} /></button>)}
          </div>
          {recent.length > 0 && (
            <div className="chips">
              <span><History size={11} style={{ display: "inline", verticalAlign: -1 }} /> RECENT</span>
              {recent.map((r) => (
                <button key={r.domain} className="chip recent" type="button" onClick={() => { setGuide(r.guide); setError(""); setTimeout(() => document.getElementById("sheet")?.scrollIntoView({ behavior: "smooth" }), 50); }}>
                  <i className="dot" style={{ background: r.color }} />{r.name}
                </button>
              ))}
              <button className="chip" type="button" aria-label="Clear recent" onClick={() => { setRecent([]); localStorage.removeItem("brandprint-recent"); }}><X size={13} /></button>
            </div>
          )}
          {busy && (
            <div className="progress" role="status">
              <span className="progress-line" />
              <p><LoaderCircle className="spin" size={16} /><span>{phase}</span></p>
              <div className="counters"><span>Search {counts.search}</span><span>Fetch {counts.fetch}</span><span>Agent {counts.agent}</span><button className="text-button" type="button" onClick={() => abort.current?.abort()}>Stop</button></div>
            </div>
          )}
          {error && <div className="error" role="alert">{error}</div>}
        </section>

        {guide ? (
          <SpecSheet guide={guide} onCopy={copy} />
        ) : (
          <section className="how" aria-label="How it works">
            <article><b><i>01</i><Search size={16} /> Search</b><p>If you give a company name, TinyFish Search finds the official homepage (skipping social profiles, wikis and news). It also runs a <code>site:</code> query to discover brand, press and about pages worth reading.</p><span className="pts">api.search.tinyfish.ai</span></article>
            <article><b><i>02</i><FileSearch size={16} /> Fetch</b><p>TinyFish Fetch reads the raw homepage HTML (including <code>&lt;head&gt;</code>, inline SVG logos and <code>&lt;link rel=stylesheet&gt;</code>), then fetches the actual CSS files to extract colours, fonts and radii, and reads the pages as Markdown to measure tone of voice and pull exact messaging.</p><span className="pts">api.fetch.tinyfish.ai</span></article>
            <article><b><i>03</i><MousePointerClick size={16} /> Agent</b><p>In Full mode, a TinyFish Agent opens the site in a real browser and reports the rendered button, header and font values. Matching colours get a ✓ “verified” mark, and anything stated on an official brand page is promoted to “official”.</p><span className="pts">agent.tinyfish.ai</span></article>
          </section>
        )}

        <footer>
          <span>Brandprint reads the live web every time — no cached brand data, no hardcoded brands. <a href="/api/brand?input=stripe.com&depth=fast" target="_blank" rel="noopener noreferrer">GET /api/brand?input=…</a> returns the same JSON for other tools.</span>
          <span>Built with <a href="https://www.tinyfish.ai/" target="_blank" rel="noopener noreferrer">TinyFish</a> by <a href="https://www.linkedin.com/in/chethan-vasthaw/" target="_blank" rel="noopener noreferrer">Chethan Vasthaw Tippani</a></span>
        </footer>
      </main>
      {toast && <div className="toast" role="status"><Check size={14} /> {toast}</div>}
    </>
  );
}
