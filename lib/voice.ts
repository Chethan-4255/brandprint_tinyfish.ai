// Tone-of-voice metrics and key-messaging extraction from page markdown.
// Every descriptor is derived from a number that is also returned, so the
// result is explainable rather than vibes.

import type { Quote, VoiceMetrics } from "./types";

const STOP = new Set("a an the and or but if then so of to in on at by for with from as is are was were be been being it its this that these those you your yours we our ours us they their them he she his her i me my mine not no yes do does did done can could will would should may might must have has had having into over under about after before between through during without within up down out off more most less least very just also only even than too all any each every some such other own same new get got make makes made use used using like one two first last here there when where why how what which who whom whose while because until again further once per via etc let’s let's don't dont can't cant won't it's its’ i'm we're you're they're learn read see view start try sign free now today".split(/\s+/));

const FORMAL = /\b(therefore|thus|hence|moreover|furthermore|whereas|pursuant|accordingly|notwithstanding|comprehensive|leverage|utilize|facilitate|enterprise-grade|robust|scalable|stakeholders|optimi[sz]e)\b/gi;
const CONTRACTION = /\b\w+(?:'|’)(?:s|re|ve|ll|d|t|m)\b/gi;
const EMOJI = /\p{Extended_Pictographic}/gu;

export function cleanMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ")
    .replace(/^\s*[>|]+/gm, " ")
    .replace(/[*_`~]+/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function headings(md: string, levels = [1, 2, 3]): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  for (const m of md.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)) {
    const level = m[1].length;
    if (!levels.includes(level)) continue;
    const text = cleanMarkdown(m[2]).replace(/\s+/g, " ").trim();
    if (text && text.length <= 180 && !out.some((h) => h.text === text)) out.push({ level, text });
  }
  return out;
}

export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|(?<=[a-z][.!?])(?=[A-Z][a-z])/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 400 && /[a-z]/i.test(s) && !/^(©|copyright|all rights|privacy|terms|cookie|\||[-•·]|\d{4})/i.test(s) && (s.match(/\s/g) || []).length >= 3);
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

export function headingCase(hs: string[]): VoiceMetrics["headingCase"] {
  let title = 0, sentence = 0, caps = 0;
  for (const h of hs) {
    const words = h.split(/\s+/).filter((w) => /[a-z]/i.test(w));
    if (words.length < 2) continue;
    if (h === h.toUpperCase()) {
      caps++;
      continue;
    }
    const capWords = words.filter((w, i) => i === 0 || /^[A-Z0-9]/.test(w) || STOP.has(w.toLowerCase())).length;
    const significant = words.slice(1).filter((w) => !STOP.has(w.toLowerCase()));
    const sigCaps = significant.filter((w) => /^[A-Z]/.test(w)).length;
    if (significant.length && sigCaps / significant.length >= 0.7 && capWords >= words.length - 1) title++;
    else if (significant.length && sigCaps / significant.length <= 0.3) sentence++;
  }
  const total = title + sentence + caps;
  if (!total) return "Mixed";
  if (caps / total > 0.6) return "ALL CAPS";
  if (title / total > 0.6) return "Title Case";
  if (sentence / total > 0.6) return "Sentence case";
  return "Mixed";
}

export function analyseVoice(texts: string[], headingTexts: string[]): { metrics: VoiceMetrics; descriptors: string[]; summary: string } {
  const all = texts.map(cleanMarkdown).join("\n");
  const sents = sentences(all);
  const words = sents.join(" ").split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const n = Math.max(sents.length, 1), wn = Math.max(words.length, 1);
  const count = (re: RegExp, s: string) => (s.match(re) || []).length;
  const joined = sents.join(" ");
  const secondPerson = sents.filter((s) => /\b(you|your|yours|you're|you’re)\b/i.test(s)).length;
  const firstPlural = sents.filter((s) => /\b(we|our|ours|us|we're|we’re)\b/i.test(s)).length;
  const exclam = sents.filter((s) => /!/.test(s)).length;
  const quest = sents.filter((s) => /\?/.test(s)).length;
  const contractions = count(CONTRACTION, joined);
  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const flesch = Math.round(206.835 - 1.015 * (wn / n) - 84.6 * (syllables / wn));
  const metrics: VoiceMetrics = {
    sentences: sents.length,
    words: words.length,
    avgSentenceLength: Math.round((wn / n) * 10) / 10,
    avgWordLength: Math.round((words.join("").replace(/[^a-z]/gi, "").length / wn) * 10) / 10,
    fleschReadingEase: Math.max(-50, Math.min(120, flesch)),
    secondPersonRate: Math.round((secondPerson / n) * 100),
    firstPersonPluralRate: Math.round((firstPlural / n) * 100),
    exclamationRate: Math.round((exclam / n) * 100),
    questionRate: Math.round((quest / n) * 100),
    contractionRate: Math.round((contractions / n) * 100),
    emojiCount: count(EMOJI, all),
    headingCase: headingCase(headingTexts),
    formalityMarkers: count(FORMAL, joined),
  };

  const d: string[] = [];
  if (metrics.avgSentenceLength <= 13) d.push("punchy");
  else if (metrics.avgSentenceLength <= 19) d.push("plain-spoken");
  else d.push("expansive");
  if (metrics.secondPersonRate >= 30) d.push("customer-centric");
  if (metrics.firstPersonPluralRate >= 30) d.push("collective (“we”)");
  if (metrics.contractionRate >= 25 && metrics.formalityMarkers < 5) d.push("conversational");
  else if (metrics.contractionRate < 10 && metrics.formalityMarkers >= 4) d.push("formal");
  else if (metrics.formalityMarkers >= 8) d.push("corporate");
  if (metrics.fleschReadingEase >= 65) d.push("accessible");
  else if (metrics.fleschReadingEase < 40) d.push("technical");
  if (metrics.exclamationRate >= 8) d.push("energetic");
  else if (metrics.exclamationRate <= 1 && metrics.questionRate <= 3) d.push("confident");
  if (metrics.questionRate >= 10) d.push("inquisitive");
  if (metrics.emojiCount >= 3) d.push("playful");
  if (metrics.headingCase === "Sentence case") d.push("understated headings");
  else if (metrics.headingCase === "Title Case") d.push("polished headings");
  else if (metrics.headingCase === "ALL CAPS") d.push("loud headings");
  const descriptors = [...new Set(d)].slice(0, 6);
  const summary = `${metrics.avgSentenceLength} words per sentence on average, ${metrics.secondPersonRate}% of sentences address the reader as “you”, ${metrics.firstPersonPluralRate}% speak as “we”, Flesch reading ease ${metrics.fleschReadingEase} (${metrics.fleschReadingEase >= 60 ? "easy" : metrics.fleschReadingEase >= 40 ? "moderate" : "dense"}), contractions in ${metrics.contractionRate}% of sentences, headings in ${metrics.headingCase.toLowerCase()}.`;
  return { metrics, descriptors, summary };
}

const BOILERPLATE = /\b(video|playing|blocker|browser|javascript|enable|loading|uh-oh|looks like|preventing|cookies?|consent|privacy|terms|copyright|rights reserved|all rights|skip to|sign in|log in|learn more|read more|get started|sign up|contact sales|english|español|deutsch|français|日本語|한국어|português)\b/i;

export function keyPhrases(texts: string[], brandName: string, top = 12): { phrase: string; count: number }[] {
  const tally = new Map<string, number>();
  const docs = new Map<string, number>(); // how many pages mention the phrase
  const brand = brandName.toLowerCase();
  for (const t of texts) {
    const tokens = cleanMarkdown(t).toLowerCase().replace(/[^a-z0-9'’\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w) && w !== brand);
    const seen = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = tokens[i] + " " + tokens[i + 1];
      tally.set(bg, (tally.get(bg) || 0) + 1);
      seen.add(bg);
    }
    for (const w of tokens)
      if (w.length > 4) {
        tally.set(w, (tally.get(w) || 0) + 0.45);
        seen.add(w);
      }
    for (const p of seen) docs.set(p, (docs.get(p) || 0) + 1);
  }
  const multiPage = texts.length > 1;
  return [...tally.entries()]
    .filter(([p, c]) => c >= 2 && !BOILERPLATE.test(p) && (!multiPage || (docs.get(p) || 0) >= 2 || c >= 4))
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([phrase, count]) => ({ phrase, count: Math.round(count) }));
}

export function missionSentences(text: string, source: string, max = 3): Quote[] {
  const out: Quote[] = [];
  for (const s of sentences(cleanMarkdown(text))) {
    if (/\b(our mission|mission is|we believe|we exist|our purpose|we're on a mission|we’re on a mission|our vision|we are building|we're building|we’re building|our goal|was founded|we started|we help|we make it|our aim)\b/i.test(s) && s.length <= 320) {
      if (!out.some((q) => q.text === s)) out.push({ text: s, source });
      if (out.length >= max) break;
    }
  }
  return out;
}

export function exampleSentences(text: string, source: string, max = 3): Quote[] {
  return sentences(cleanMarkdown(text))
    .filter((s) => s.length >= 40 && s.length <= 180 && !/cookie|privacy|terms|©|login|password/i.test(s))
    .slice(0, max)
    .map((s) => ({ text: s, source }));
}

const CTA_VERB = /^(start|get|try|sign|contact|book|request|learn|join|download|explore|create|build|buy|shop|talk|see|watch|schedule|subscribe|apply|discover|browse|open|find|read|log|begin|launch|install|claim|order|reserve|compare|choose|upgrade|go|take|meet|chat|speak|become|register|enroll|unlock|grab|view|check|visit|send|share|donate|give|support)\b/i;

export function dedupeRepeat(t: string): string {
  const words = t.split(" ");
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    if (words.slice(0, half).join(" ").toLowerCase() === words.slice(half).join(" ").toLowerCase()) return words.slice(0, half).join(" ");
  }
  return t;
}

const NOT_CTA = /^(back|next|previous|more|less|show|hide|ok|yes|no|cancel|dismiss|got it)$|^(sign|log) ?in$|\((us|uk|eu|ca|au)\)|^(english|español|deutsch|français|italiano|português|日本語|한국어|中文|nederlands|svenska|norsk|dansk|suomi|polski|русский|türkçe)\b|^(light|dark|system)( mode)?$|^(en|de|fr|es|ja|ko|pt|it|nl)(-[a-z]{2})?$/i;

export function ctaVerbs(ctas: string[], navLabels: string[] = []): string[] {
  const seen = new Set<string>();
  const nav = new Set(navLabels.map((n) => n.toLowerCase()));
  const verbs: string[] = [], rest: string[] = [], fromNav: string[] = [];
  for (const c of ctas) {
    const t = dedupeRepeat(c.replace(/\s+/g, " ").trim());
    const k = t.toLowerCase();
    if (!t || seen.has(k) || NOT_CTA.test(t)) continue;
    seen.add(k);
    if (CTA_VERB.test(t)) verbs.push(t);
    else if (!nav.has(k) && t.split(" ").length >= 2) rest.push(t);
  }
  // Header links such as "Get Notion free" or "Contact sales" are calls to
  // action even when they are rendered as plain anchors.
  for (const n of navLabels) {
    const t = n.replace(/\s*(→|›|>)\s*$/, "").trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k) || NOT_CTA.test(t) || !CTA_VERB.test(t) || /^(learn|read|see|view|find|browse|discover|open (menu|navigation|nav|search))\b/i.test(t)) continue;
    seen.add(k);
    fromNav.push(t);
  }
  return [...verbs, ...fromNav, ...rest].slice(0, 10);
}

export function guessIndustry(text: string): string | undefined {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(payments?|checkout|invoic|billing|fintech|banking|card)\b/, "Payments & fintech"],
    [/\b(developer|api|sdk|infrastructure|deploy|cloud)\b/, "Developer tools & infrastructure"],
    [/\b(notes?|docs?|wiki|workspace|knowledge|collaborat)\b/, "Productivity & collaboration"],
    [/\b(issue|sprint|roadmap|project tracking|bug)\b/, "Product & project management"],
    [/\b(design|prototype|figma|creative)\b/, "Design tools"],
    [/\b(crm|sales|marketing|campaign|leads?)\b/, "Sales & marketing software"],
    [/\b(health|clinic|patient|medical|wellness)\b/, "Health"],
    [/\b(shop|store|cart|fashion|apparel|shoes|retail)\b/, "Retail & e-commerce"],
    [/\b(travel|hotel|flight|booking)\b/, "Travel"],
    [/\b(learn|course|students?|education|school)\b/, "Education"],
    [/\b(ai|machine learning|model|agents?|llm)\b/, "AI"],
    [/\b(security|identity|compliance|soc 2)\b/, "Security"],
  ];
  const scores = rules.map(([re, label]) => [label, (t.match(new RegExp(re.source, "g")) || []).length] as [string, number]).sort((a, b) => b[1] - a[1]);
  return scores[0] && scores[0][1] >= 3 ? scores[0][0] : undefined;
}
