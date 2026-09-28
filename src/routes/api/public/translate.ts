import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

const BodySchema = z.object({
  texts: z.array(z.string().min(1).max(5000)).min(1).max(50),
  source: z.enum(["EL", "EN"]).default("EL"),
  target: z.enum(["EL", "EN"]),
});

// Same-origin only: do not advertise cross-origin access. Browsers will block
// third-party sites from calling this endpoint and consuming our DeepL quota.
const CORS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function hashText(t: string, source: string, target: string) {
  return createHash("sha256").update(`${source}::${target}::${t}`).digest("hex");
}

// Best-effort per-IP token bucket. This endpoint is public (logged-out visitors
// translate venue names) and forwards to DeepL, which is a paid quota — so we
// throttle bursts from a single client. In-memory state is per-worker-isolate on
// Cloudflare, so this is a speed bump, not a hard guarantee; a production setup
// should additionally add a Cloudflare rate-limiting rule or a Durable Object /
// KV counter. The translations_cache table already absorbs repeated texts.
const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 30; // requests per IP per minute
const rlBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rlBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rlBuckets.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    // Opportunistic cleanup so the map can't grow unbounded.
    if (rlBuckets.size > 5000) {
      for (const [k, v] of rlBuckets) if (now >= v.resetAt) rlBuckets.delete(k);
    }
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= RL_MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export const Route = createFileRoute("/api/public/translate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
        const rl = rateLimit(clientIp(request));
        if (!rl.ok) {
          return new Response(
            JSON.stringify({ error: "rate_limited", translations: [], fallback: true }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(rl.retryAfter),
                ...CORS,
              },
            },
          );
        }

        const apiKey = process.env.DEEPL_API_KEY;
        if (!apiKey) {
          return Response.json(
            { translations: [], fallback: true, error: "deepl_not_configured" },
            { headers: CORS },
          );
        }

        let parsed;
        try {
          const raw = await request.json();
          parsed = BodySchema.parse(raw);
        } catch (e: unknown) {
          return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const { texts, source, target } = parsed;

        if (source === target) {
          return Response.json(
            { translations: texts },
            { headers: CORS },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const hashes = texts.map((t) => hashText(t, source, target));
        const { data: cached } = await supabaseAdmin
          .from("translations_cache")
          .select("source_hash, translated_text")
          .in("source_hash", hashes)
          .eq("source_lang", source)
          .eq("target_lang", target);

        const cacheMap = new Map<string, string>(
          (cached ?? []).map((r) => [r.source_hash, r.translated_text]),
        );

        const missing: { idx: number; text: string; hash: string }[] = [];
        texts.forEach((t, i) => {
          if (!cacheMap.has(hashes[i])) missing.push({ idx: i, text: t, hash: hashes[i] });
        });

        if (missing.length > 0) {
          // DeepL API call — Free uses api-free.deepl.com
          const endpoint = apiKey.endsWith(":fx")
            ? "https://api-free.deepl.com/v2/translate"
            : "https://api.deepl.com/v2/translate";

          const form = new URLSearchParams();
          missing.forEach((m) => form.append("text", m.text));
          form.append("source_lang", source);
          form.append("target_lang", target);
          form.append("preserve_formatting", "1");

          const dlRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `DeepL-Auth-Key ${apiKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });

          if (!dlRes.ok) {
            const errText = await dlRes.text();
            console.error("DeepL request failed", dlRes.status, errText.slice(0, 200));
            // Graceful fallback: return original strings so the UI never blanks.
            return Response.json(
              { translations: texts, fallback: true, error: "translation_unavailable" },
              { headers: CORS },
            );
          }

          const dlJson = (await dlRes.json()) as { translations: { text: string }[] };
          const translated = dlJson.translations ?? [];

          const rows = missing.map((m, i) => ({
            source_hash: m.hash,
            source_lang: source,
            target_lang: target,
            source_text: m.text,
            translated_text: translated[i]?.text ?? m.text,
          }));

          if (rows.length > 0) {
            await supabaseAdmin
              .from("translations_cache")
              .upsert(rows, { onConflict: "source_hash,source_lang,target_lang" });
            rows.forEach((r) => cacheMap.set(r.source_hash, r.translated_text));
          }
        }

        const translations = texts.map((t, i) => cacheMap.get(hashes[i]) ?? t);
        return Response.json({ translations }, { headers: CORS });
        } catch (err) {
          console.error("translate route crashed", err);
          try {
            const raw = await request.clone().json().catch(() => ({}));
            const texts = Array.isArray((raw as { texts?: unknown }).texts)
              ? ((raw as { texts: string[] }).texts)
              : [];
            return Response.json(
              { translations: texts, fallback: true, error: "translation_unavailable" },
              { headers: CORS },
            );
          } catch {
            return Response.json(
              { translations: [], fallback: true, error: "translation_unavailable" },
              { headers: CORS },
            );
          }
        }
      },
    },
  },
});
