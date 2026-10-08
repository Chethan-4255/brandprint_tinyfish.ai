export type Depth = "fast" | "full";

export type LogoAsset = {
  kind: "img" | "svg" | "apple-touch-icon" | "icon" | "og:image" | "twitter:image";
  url?: string;
  svg?: string;
  alt?: string;
  where: string;
  score: number;
};

export type BrandColor = {
  hex: string;
  rgb: string;
  hsl: string;
  name: string;
  role: "primary" | "secondary" | "accent" | "background" | "text" | "neutral";
  usage: number;
  evidence: string[];
  contrast: {
    onWhite: number;
    onBlack: number;
    aaOnWhite: boolean;
    aaOnBlack: boolean;
  };
  verified: boolean;
  official?: string;
};

export type FontFamily = {
  family: string;
  stack: string;
  usage: number;
  source: "css" | "google-fonts" | "font-face" | "custom-property" | "browser" | "official";
  roles: ("heading" | "body" | "mono")[];
  evidence: string[];
  verified: boolean;
};

export type VoiceMetrics = {
  sentences: number;
  words: number;
  avgSentenceLength: number;
  avgWordLength: number;
  fleschReadingEase: number;
  secondPersonRate: number;
  firstPersonPluralRate: number;
  exclamationRate: number;
  questionRate: number;
  contractionRate: number;
  emojiCount: number;
  headingCase: "Title Case" | "Sentence case" | "ALL CAPS" | "Mixed";
  formalityMarkers: number;
};

export type Quote = { text: string; source: string };

export type BrandGuide = {
  brand: {
    name: string;
    domain: string;
    url: string;
    tagline: string;
    description: string;
    industryGuess?: string;
    themeColor?: string;
    lang?: string;
  };
  logo: {
    primary: LogoAsset | null;
    alternates: LogoAsset[];
  };
  colors: {
    palette: BrandColor[];
    neutrals: BrandColor[];
    verifiedBy: "css" | "css+browser";
    cssFilesRead: number;
  };
  typography: {
    heading: string;
    body: string;
    families: FontFamily[];
    weights: number[];
    baseFontSize?: string;
    lineHeight?: string;
    radiusScale: string[];
    radiusStyle: "sharp" | "soft" | "rounded" | "pill";
    evidence: string[];
  };
  voice: {
    descriptors: string[];
    metrics: VoiceMetrics;
    examples: Quote[];
    summary: string;
  };
  messaging: {
    taglines: Quote[];
    valueProps: Quote[];
    keywords: { phrase: string; count: number }[];
    ctas: string[];
    mission: Quote[];
    navLabels: string[];
  };
  browser?: AgentObservation | null;
  sources: { url: string; role: string; fetchedAt: string; status: "ok" | "error"; note?: string }[];
  tinyfish: {
    calls: { search: number; fetch: number; agent: number };
    urlsFetched: number;
    agentVerified: boolean;
    depth: Depth;
  };
  warnings: string[];
  generatedAt: string;
  durationMs: number;
};

export type AgentObservation = {
  primaryButton?: { background?: string; text?: string } | null;
  headerBackground?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  logo?: { description?: string; type?: string } | null;
  heroTagline?: string | null;
  brandPage?: {
    url?: string;
    officialColours?: { name?: string; hex?: string }[];
    officialFonts?: string[];
    quotes?: string[];
  } | null;
};
