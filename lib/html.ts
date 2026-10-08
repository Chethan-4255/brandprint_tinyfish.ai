// Lightweight HTML extraction over the raw document returned by TinyFish Fetch
// (format "html" + include_selectors ["html"] keeps <head>, <style> and <svg>).

import type { LogoAsset } from "./types";
import { dedupeRepeat } from "./voice";

export type HtmlFacts = {
  title: string;
  description: string;
  siteName: string;
  ogTitle: string;
  ogImage: string;
  themeColor: string;
  lang: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  navLabels: string[];
  ctas: string[];
  footerText: string;
  stylesheets: string[];
  inlineCss: string;
  styleAttrs: string[];
  googleFonts: string[];
  logos: LogoAsset[];
  links: string[];
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“");
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : "";
}

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const m = html.match(re);
  if (!m) return "";
  return attr(m[0], "content");
}

function allText(html: string, tag: string, max = 20): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    const t = stripTags(m[1]);
    if (t && t.length <= 220 && !out.includes(t)) out.push(t);
  }
  return out;
}

function section(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1] : "";
}

const TRACKING = /pixel|track|beacon|1x1|spacer|blank\.gif|analytics|doubleclick|facebook\.com\/tr|googleads|hotjar|segment|\.gif\?|counter|badge|sprite|arrow|chevron|icon-(?!logo)|flag|avatar|photo|screenshot|hero|banner|thumbnail|background|bg-|close|menu|hamburger|search|play|star|check|social|twitter|linkedin|github|facebook|instagram|youtube|app-store|google-play|appstore|play-store|partner|customer|client|testimonial|award|trust|g2|capterra|soc2|iso/i;
// Logos of other companies shown on the page (customer walls, press, integrations) are never the brand's own logo.
const THIRD_PARTY = /customer|partner|client|testimonial|press|award|trust|integration|sponsor|investor|backed|featured|as-seen|marquee|carousel|wall/i;

function allSections(html: string, tag: string, max = 12): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) out.push(m[1]);
  return out;
}

// Pages often have several <header> elements (hero headers, card headers…);
// the site chrome is the one that links home and carries a logo.
function pickChrome(html: string): string {
  const candidates = [...allSections(html, "header"), ...allSections(html, "nav")];
  const scored = candidates.map((c) => {
    let s = 0;
    if (/logo|wordmark|brand/i.test(c)) s += 4;
    if (/href\s*=\s*["']\/?["']/.test(c) || /aria-label\s*=\s*["'][^"']*(home|homepage)/i.test(c)) s += 3;
    if (/<svg\b/i.test(c) || /<img\b/i.test(c)) s += 2;
    if (/aria-label\s*=\s*["'](main|primary|global)/i.test(c)) s += 2;
    if (c.length > 80000) s -= 3;
    return { c, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0]?.c || "";
}

export function parseHtml(html: string, baseUrl: string): HtmlFacts {
  const head = section(html, "head") || html.slice(0, 20000);
  const header = pickChrome(html);
  const nav = section(html, "nav");
  const footer = section(html, "footer");
  const body = section(html, "body") || html;

  const title = stripTags(section(head, "title")).slice(0, 200);
  const stylesheets: string[] = [];
  const googleFonts: string[] = [];
  const linkRe = /<link\b[^>]*>/gi;
  let lm: RegExpExecArray | null;
  const icons: LogoAsset[] = [];
  while ((lm = linkRe.exec(html))) {
    const tag = lm[0];
    const rel = attr(tag, "rel").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    const abs = absolute(href, baseUrl);
    if (!abs) continue;
    if (/stylesheet/.test(rel) || (/preload/.test(rel) && attr(tag, "as") === "style")) {
      if (/fonts\.googleapis\.com/.test(abs)) {
        try {
          const u = new URL(abs);
          for (const fam of u.searchParams.getAll("family")) googleFonts.push(fam.split(":")[0].replace(/\+/g, " "));
        } catch {}
      } else if (!stylesheets.includes(abs)) stylesheets.push(abs);
    }
    if (/apple-touch-icon/.test(rel)) icons.push({ kind: "apple-touch-icon", url: abs, where: "<link rel=apple-touch-icon>", score: 55 });
    else if (/\bicon\b/.test(rel) && !/mask/.test(rel)) {
      const sizes = attr(tag, "sizes");
      const big = /(\d+)x/.exec(sizes) ? Number(/(\d+)x/.exec(sizes)![1]) : abs.endsWith(".svg") ? 512 : 32;
      icons.push({ kind: "icon", url: abs, where: `<link rel=icon${sizes ? ` sizes=${sizes}` : ""}>`, score: big >= 180 ? 50 : big >= 64 ? 40 : 30 });
    }
  }
  // Google Fonts also appear as @import inside inline styles.
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s]+)/gi)) {
    try {
      const params = new URLSearchParams(m[1].replace(/&amp;/g, "&"));
      for (const fam of params.getAll("family")) {
        const f = fam.split(":")[0].replace(/\+/g, " ");
        if (!googleFonts.includes(f)) googleFonts.push(f);
      }
    } catch {}
  }

  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const styleAttrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]{3,400})"/gi)].map((m) => decodeEntities(m[1]));

  // Logo candidates --------------------------------------------------------
  const logos: LogoAsset[] = [];
  const imgRe = /<img\b[^>]*>/gi;
  const headerScope = header || body.slice(0, 60000);
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(body))) {
    const tag = im[0];
    const src = attr(tag, "src") || attr(tag, "data-src") || (attr(tag, "srcset").split(/[\s,]+/)[0] ?? "");
    if (!src || src.startsWith("data:image/gif")) continue;
    const abs = absolute(src, baseUrl);
    if (!abs && !src.startsWith("data:")) continue;
    const alt = attr(tag, "alt");
    const cls = attr(tag, "class") + " " + attr(tag, "id");
    const w = Number(attr(tag, "width")) || 0, h = Number(attr(tag, "height")) || 0;
    const hint = `${alt} ${cls} ${src}`;
    const inHeader = headerScope.includes(tag);
    const logoish = /logo|wordmark|brand(?!ing-)|logotype/i.test(hint);
    if (!inHeader && !logoish) continue;
    if (TRACKING.test(hint) && !/logo/i.test(hint)) continue;
    if (THIRD_PARTY.test(hint)) continue;
    if ((w && w < 20) || (h && h < 20)) continue;
    let score = 0;
    if (logoish) score += 60;
    if (inHeader) score += 30;
    if (!inHeader && !alt) score -= 25; // an unlabeled "logo" image outside the chrome is usually someone else's logo
    if (/\.svg(\?|$)/i.test(src)) score += 10;
    if (/logo/i.test(alt)) score += 5;
    if (/dark|white|inverse|light|mono/i.test(hint)) score -= 8;
    logos.push({ kind: "img", url: abs || src, alt: alt || undefined, where: inHeader ? "header <img>" : "<img> tagged logo", score });
  }
  // Inline SVG in header (wordmarks are often drawn inline).
  if (header) {
    const svgRe = /<svg\b[\s\S]*?<\/svg>/gi;
    let sm: RegExpExecArray | null;
    let count = 0;
    while ((sm = svgRe.exec(header)) && count < 12) {
      count++;
      const svg = sm[0];
      if (svg.length > 20000 || svg.length < 150) continue;
      const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
      const label = attr(open, "aria-label") + " " + attr(open, "class") + " " + (svg.match(/<title>([^<]*)<\/title>/i)?.[1] || "");
      const logoish = /logo|wordmark|brand/i.test(label) || /logo|wordmark|brand/i.test(header.slice(Math.max(0, sm.index - 300), sm.index));
      if (/chevron|arrow|menu|hamburger|search|close|icon-(?!logo)|caret|external/i.test(label) && !logoish) continue;
      const paths = (svg.match(/<path\b/gi) || []).length;
      if (paths < 1) continue;
      let score = 40 + (logoish ? 35 : 0) + Math.min(paths, 12) * 1.5;
      if (/role="img"|aria-label/.test(open)) score += 5;
      const safe = svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/\s(href|xlink:href)="javascript:[^"]*"/gi, "");
      logos.push({ kind: "svg", svg: safe, alt: stripTags(label).trim() || undefined, where: "inline <svg> in header", score });
    }
  }
  // Anchors that link home and are labelled as the logo, anywhere in the page.
  const anchorRe = /<a\b[^>]*(?:class|id|aria-label|title|data-testid)\s*=\s*["'][^"']*(?:logo|wordmark|home)[^"']*["'][^>]*>([\s\S]{0,20000}?)<\/a>/gi;
  let am: RegExpExecArray | null;
  let anchors = 0;
  while ((am = anchorRe.exec(body)) && anchors < 6) {
    anchors++;
    const open = am[0].match(/<a\b[^>]*>/i)?.[0] || "";
    const label = attr(open, "aria-label") || attr(open, "title");
    if (THIRD_PARTY.test(open) || /footer/i.test(attr(open, "class"))) continue;
    const inner = am[1];
    const svg = inner.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
    if (svg && svg.length >= 150 && svg.length <= 20000 && (svg.match(/<path\b/gi) || []).length >= 1) {
      const safe = svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/\s(href|xlink:href)="javascript:[^"]*"/gi, "");
      logos.push({ kind: "svg", svg: safe, alt: label || undefined, where: "inline <svg> inside the home link", score: 88 });
      continue;
    }
    const img = inner.match(/<img\b[^>]*>/i)?.[0];
    if (img) {
      const src = attr(img, "src") || attr(img, "data-src") || (attr(img, "srcset").split(/[\s,]+/)[0] ?? "");
      const abs = src ? absolute(src, baseUrl) : null;
      if (abs && !THIRD_PARTY.test(`${attr(img, "alt")} ${attr(img, "class")} ${src}`)) logos.push({ kind: "img", url: abs, alt: attr(img, "alt") || label || undefined, where: "<img> inside the home link", score: 84 + (/\.svg(\?|$)/i.test(src) ? 4 : 0) });
    }
  }
  const ogImage = absolute(meta(html, "og:image") || meta(html, "og:image:url"), baseUrl) || "";
  const twImage = absolute(meta(html, "twitter:image"), baseUrl) || "";
  if (ogImage) logos.push({ kind: "og:image", url: ogImage, where: "<meta property=og:image>", score: 25 });
  if (twImage && twImage !== ogImage) logos.push({ kind: "twitter:image", url: twImage, where: "<meta name=twitter:image>", score: 20 });
  logos.push(...icons);
  const seen = new Set<string>();
  const uniqueLogos = logos
    .sort((a, b) => b.score - a.score)
    .filter((l) => {
      const k = l.url || l.svg!.slice(0, 200);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // Metadata and copy --------------------------------------------------------
  const navSource = nav || header;
  const navLabels = [...new Set(allText(navSource, "a", 60).map(dedupeRepeat).filter((t) => t.length <= 32 && t.split(/\s+/).length <= 4))].slice(0, 20);
  const ctaSet = new Set<string>();
  for (const m of body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2];
    const text = stripTags(m[3]);
    if (!text || text.length > 40 || text.split(/\s+/).length > 6) continue;
    if (m[1].toLowerCase() === "button" || /class\s*=\s*"[^"]*(btn|button|cta)/i.test(attrs) || /role="button"/i.test(attrs)) {
      if (!/^(menu|close|open|toggle|search|×|x|\u2715|next|previous|prev|\d+)$/i.test(text) && !/cookie|accept|reject|preferences|language|region|skip to/i.test(text)) ctaSet.add(text);
    }
  }
  const links: string[] = [];
  for (const m of body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    const abs = absolute(m[1], baseUrl);
    if (abs && !links.includes(abs)) links.push(abs);
    if (links.length > 600) break;
  }

  return {
    title,
    description: meta(html, "description") || meta(html, "og:description") || "",
    siteName: meta(html, "og:site_name") || meta(html, "application-name") || "",
    ogTitle: meta(html, "og:title") || "",
    ogImage,
    themeColor: meta(html, "theme-color") || "",
    lang: (html.match(/<html\b[^>]*\slang\s*=\s*["']([^"']+)["']/i)?.[1] || "").slice(0, 10),
    h1s: allText(body, "h1", 8),
    h2s: allText(body, "h2", 24),
    h3s: allText(body, "h3", 24),
    navLabels,
    ctas: [...ctaSet].slice(0, 20),
    footerText: stripTags(footer).slice(0, 1200),
    stylesheets: stylesheets.slice(0, 40),
    inlineCss,
    styleAttrs,
    googleFonts: [...new Set(googleFonts)],
    logos: uniqueLogos.slice(0, 10),
    links,
  };
}

export function pickCompanyPages(links: string[], host: string): string[] {
  const wanted = [/\/about(-us)?\/?$/i, /\/(brand|brand-assets|brand-guidelines|press|press-kit|media-kit|newsroom|media)\/?$/i, /\/company\/?$/i, /\/mission\/?$/i, /\/our-story\/?$/i, /\/(careers|jobs)\/?$/i, /\/(why|customers)\/?$/i];
  const out: string[] = [];
  for (const re of wanted) {
    const hit = links.find((l) => {
      try {
        const u = new URL(l);
        return u.hostname.replace(/^www\./, "") === host && re.test(u.pathname);
      } catch {
        return false;
      }
    });
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}
