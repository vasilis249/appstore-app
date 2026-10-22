// Edge Function `push`: the database (private.push_dispatch) calls it for every new notification / DM; it asks
// push_job for the recipient's devices and texts and sends each through APNs (token auth, .p8 key).
// Secrets: PUSH_SECRET (same as private.push_config.secret), APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (the .p8
// contents), optional APNS_TOPIC (bundle id). Deployed with verify_jwt off: the shared secret is the check.
import { apnsJwt } from "./jwt.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const TOPIC = env("APNS_TOPIC") || "gr.innera.courtsie";
const HOSTS = ["https://api.push.apple.com", "https://api.sandbox.push.apple.com"]; // App Store / TestFlight, then Xcode builds

let cached: { jwt: string; at: number } | null = null;
async function bearer() {
  // Apple wants a token newer than 1 h and refreshed at most every 20 min
  if (!cached || Date.now() - cached.at > 40 * 60_000) {
    cached = { jwt: await apnsJwt(env("APNS_PRIVATE_KEY"), env("APNS_KEY_ID"), env("APNS_TEAM_ID")), at: Date.now() };
  }
  return cached.jwt;
}

async function rpc(name: string, args: Record<string, string>) {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
  return r.json();
}

type Job = { token: string; title: string; body: string; route: string };

async function send(job: Job): Promise<string> {
  const payload = JSON.stringify({ aps: { alert: { title: job.title, body: job.body }, sound: "default" }, route: job.route });
  let reason = "";
  for (const host of HOSTS) {
    const r = await fetch(`${host}/3/device/${job.token}`, {
      method: "POST",
      headers: { authorization: `bearer ${await bearer()}`, "apns-topic": TOPIC, "apns-push-type": "alert", "apns-priority": "10" },
      body: payload,
    });
    if (r.ok) return "sent";
    reason = ((await r.json().catch(() => ({}))) as { reason?: string }).reason ?? String(r.status);
    if (reason !== "BadDeviceToken") break; // a sandbox token is "bad" on production: try the other host
  }
  // the app was removed / the token belongs to the other environment and failed there too
  if (reason === "Unregistered" || reason === "BadDeviceToken") await rpc("drop_push_token", { p_token: job.token });
  return reason;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" || !env("PUSH_SECRET") || req.headers.get("x-push-secret") !== env("PUSH_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const { kind, id } = (await req.json().catch(() => ({}))) as { kind?: string; id?: string };
  if ((kind !== "n" && kind !== "dm") || !id) return new Response("bad request", { status: 400 });
  if (!env("APNS_PRIVATE_KEY") || !env("APNS_KEY_ID") || !env("APNS_TEAM_ID")) {
    return Response.json({ sent: 0, reason: "apns_not_configured" });
  }
  const jobs = (await rpc("push_job", { p_kind: kind, p_id: id })) as Job[];
  const results = await Promise.all(jobs.map((j) => send(j).catch((e) => String(e))));
  return Response.json({ sent: results.filter((r) => r === "sent").length, results });
});
