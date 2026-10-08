import { z } from "zod";
import { generateBrandGuide } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ input: z.string().trim().min(2).max(300), depth: z.enum(["fast", "full"]).default("fast") }).strict();

function resolveKey(request: Request) {
  return request.headers.get("x-tinyfish-api-key")?.trim() || process.env.TINYFISH_API_KEY || "";
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// Streaming variant used by the UI: NDJSON progress events followed by the result.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 4000) return Response.json({ error: "Request is too large." }, { status: 413 });
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 4000) return Response.json({ error: "Request is too large." }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Enter a website URL or company name (2–300 characters)." }, { status: 400 });
  const key = resolveKey(request);
  if (!key) return Response.json({ error: "TinyFish API key is missing. Add it in API key settings or set TINYFISH_API_KEY on the server." }, { status: 503 });

  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const stream = new ReadableStream({
    async start(c) {
      let open = true;
      const send = (value: unknown) => {
        if (!open) return;
        try {
          c.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
        } catch {
          open = false;
          controller.abort();
        }
      };
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 12000);
      try {
        const data = await generateBrandGuide(parsed.data.input, parsed.data.depth, key, (message) => send({ type: "progress", message }), controller.signal);
        send({ type: "result", data });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Brand extraction failed. Please try again." });
      } finally {
        clearInterval(heartbeat);
        if (open) {
          open = false;
          c.close();
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

// Plain JSON variant for other tools: GET /api/brand?input=stripe.com&depth=fast
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({ input: url.searchParams.get("input") || url.searchParams.get("url") || url.searchParams.get("q") || "", depth: url.searchParams.get("depth") || "fast" });
  if (!parsed.success) return Response.json({ error: "Pass ?input=<website or company name>&depth=fast|full" }, { status: 400 });
  const key = resolveKey(request);
  if (!key) return Response.json({ error: "TinyFish API key is missing. Send x-tinyfish-api-key or set TINYFISH_API_KEY on the server." }, { status: 503 });
  try {
    const data = await generateBrandGuide(parsed.data.input, parsed.data.depth, key, () => undefined, request.signal);
    return Response.json(data, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Brand extraction failed.";
    const status = /authentication/i.test(message) ? 401 : /credits/i.test(message) ? 402 : /rate limit/i.test(message) ? 429 : /could not find|could not read/i.test(message) ? 422 : 500;
    return Response.json({ error: message }, { status, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
