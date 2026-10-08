// Thin client for the three TinyFish endpoints used by Brandprint.
// Search finds the official site and brand/press pages, Fetch reads the raw
// HTML, stylesheets and content, Agent looks at the rendered page in a browser.

export type SearchHit = { position: number; site_name?: string; title: string; snippet: string; url: string };
export type SearchResponse = { query: string; results: SearchHit[]; total_results?: number; page?: number };

export type FetchPage = {
  url: string;
  final_url?: string;
  title?: string;
  description?: string;
  language?: string;
  author?: string;
  published_date?: string;
  text: string;
  links?: string[];
  image_links?: string[];
  latency_ms?: number;
  format?: string;
};
export type FetchError = { url: string; error: string; status?: number };
export type FetchResponse = { results: FetchPage[]; errors: FetchError[] };

export type FetchOptions = {
  format: "markdown" | "html" | "json";
  links?: boolean;
  image_links?: boolean;
  ttl?: number;
  per_url_timeout_ms?: number;
  include_selectors?: string[];
  exclude_selectors?: string[];
  purpose?: string;
};

export type Emit = (message: string) => void;

export class TinyFishError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function friendly(status: number, endpoint: string) {
  if (status === 401 || status === 403) return "TinyFish authentication failed. Check the API key.";
  if (status === 402) return `TinyFish ${endpoint} credits are unavailable for this key.`;
  if (status === 429) return "TinyFish rate limit reached. Try again shortly.";
  return `TinyFish ${endpoint} returned HTTP ${status}.`;
}

async function request(url: string, key: string, body: unknown, endpoint: string, signal?: AbortSignal, timeout = 60000) {
  const timeoutSignal = AbortSignal.timeout(timeout);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });
  if (!response.ok) throw new TinyFishError(friendly(response.status, endpoint), response.status);
  return response;
}

export async function search(query: string, purpose: string, key: string, signal?: AbortSignal): Promise<SearchResponse> {
  const u = new URL("https://api.search.tinyfish.ai");
  u.searchParams.set("query", query);
  u.searchParams.set("purpose", purpose);
  const r = await request(u.href, key, null, "Search", signal, 45000);
  return (await r.json()) as SearchResponse;
}

export async function fetchPages(urls: string[], options: FetchOptions, key: string, signal?: AbortSignal): Promise<FetchResponse> {
  const r = await request(
    "https://api.fetch.tinyfish.ai",
    key,
    { urls: urls.slice(0, 10), ttl: 0, ...options },
    "Fetch",
    signal,
    160000,
  );
  const data = (await r.json()) as Partial<FetchResponse>;
  return { results: data.results || [], errors: data.errors || [] };
}

export type AgentRun<T> = { result: T | null; runId?: string; steps: number };

// Runs a TinyFish Agent automation and parses the SSE stream. The result may
// arrive as an object or a (possibly fenced) JSON string, so both are handled.
export async function runAgent<T>(
  url: string,
  goal: string,
  outputSchema: Record<string, unknown>,
  key: string,
  emit: Emit,
  signal?: AbortSignal,
  maxDurationSeconds = 150,
): Promise<AgentRun<T>> {
  const response = await request(
    "https://agent.tinyfish.ai/v1/automation/run-sse",
    key,
    {
      url,
      goal,
      output_schema: outputSchema,
      browser_profile: "lite",
      use_vault: false,
      use_profile: false,
      // Custom agent_config (max_steps / max_duration) is a beta feature; the
      // time budget is enforced client-side by aborting the stream instead.
    },
    "Agent",
    signal,
    maxDurationSeconds * 1000 + 20000,
  );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("TinyFish Agent did not start.");
  const decoder = new TextDecoder();
  let pending = "";
  let result: unknown = null;
  let runId: string | undefined;
  let steps = 0;
  let failure: string | null = null;

  function handle(raw: string) {
    if (!raw.startsWith("data:")) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw.slice(5).trim());
    } catch {
      return;
    }
    if (typeof event.run_id === "string") runId = event.run_id;
    if (typeof event.runId === "string") runId = event.runId;
    if (event.type === "PROGRESS") {
      steps++;
      if (event.purpose) emit("Browser agent: " + String(event.purpose).slice(0, 160));
    }
    if (event.type === "COMPLETE") {
      if (event.status !== "COMPLETED") {
        failure = typeof event.error === "string" ? event.error : "Browser verification did not complete.";
      } else {
        result = event.resultJson ?? event.result ?? event.data ?? null;
      }
    }
    if (event.type === "ERROR") failure = typeof event.error === "string" ? event.error : "Browser verification failed.";
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const l of lines) handle(l);
    }
    if (pending) handle(pending);
  } catch (e) {
    if (runId && signal?.aborted) {
      void fetch(`https://agent.tinyfish.ai/v1/runs/${runId}/cancel`, { method: "POST", headers: { "X-API-Key": key } }).catch(() => undefined);
    }
    throw e;
  }
  if (failure) throw new Error(String(failure).slice(0, 200));
  if (typeof result === "string") {
    const cleaned = result.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          result = JSON.parse(match[0]);
        } catch {
          result = null;
        }
      } else result = null;
    }
  }
  return { result: (result as T) ?? null, runId, steps };
}
