// Admin metrics: the admin (me) opens Settings → Μετρήσεις → the universities list → ΕΜΠ (tiles + departments table
// with the readiness column); a student who is not admin is sent away. Needs the local stack + seed-speak (me = admin,
// a verified ΕΜΠ student). Usage: node metrics-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const SECRET = "local-dev-secret-local-dev-secret-0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c) => { const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(c); return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`; };
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const now = Math.floor(Date.now() / 1000);
const session = (id, email) => ({ access_token: jwt({ iat: now, exp: now + 86400, role: "authenticated", sub: id, email, aud: "authenticated" }),
  token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local",
  user: { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
async function as(id, email) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" });
  await ctx.addInitScript((s) => { try { localStorage.setItem("sb-127-auth-token", JSON.stringify(s)); } catch {} }, session(id, email));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}

// two verified ΕΜΠ students (the seed has none)
execSync(`psql -h /tmp -p 54329 -U postgres -d courtsie -qc "UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', study_year = 3, student_verified_at = now() - interval '10 days' WHERE id IN ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002')"`);
const me = await as("11111111-0000-0000-0000-000000000001", "me@test");
await me.goto(base + "/profile", { waitUntil: "networkidle" });
await me.waitForTimeout(1200);
await me.getByRole("button", { name: /Ρυθμίσεις|Μενού/ }).first().click();
await me.waitForTimeout(800);
ok("Settings has «Μετρήσεις» for the admin", await me.getByRole("link", { name: "Μετρήσεις" }).isVisible());
await me.getByRole("link", { name: "Μετρήσεις" }).click();
await me.waitForURL(/\/admin\/metrics/);
await me.waitForTimeout(1500);
ok("universities list with students and the open / waiting state",
  (await me.getByText(/Συγκεντρωτικά στοιχεία/).isVisible()) && (await me.getByText(/\d+ φοιτητές · \+\d+ σε 7 ημ\./).first().isVisible())
  && (await me.getByText("Ανοιχτό campus").first().isVisible()));
await me.getByRole("link", { name: /Εθνικό Μετσόβιο Πολυτεχνείο/ }).click();
await me.waitForURL(/u=ntua/);
await me.waitForTimeout(1500);
ok("ΕΜΠ: tiles (students, activation, week-2 return, questions) and the departments table",
  (await me.getByText("Φοιτητές", { exact: true }).isVisible()) && (await me.getByText("Ενεργοποίηση", { exact: true }).isVisible())
  && (await me.getByText("Επιστροφή 2ης εβδομάδας").isVisible()) && (await me.getByText("Ερωτήσεις (30 ημ.)").isVisible())
  && (await me.getByText(/^\d+ φοιτ\. · \d+ ενεργοί 7 ημ\./).first().isVisible()) && (await me.getByText("Όχι ακόμα").first().isVisible()));
ok("no person on the screen (no usernames)", !(await me.locator("main").innerText()).includes("@"));

const other = await as("22222222-0000-0000-0000-000000000002", "maria@test");
await other.goto(base + "/admin/metrics", { waitUntil: "networkidle" });
await other.waitForTimeout(1500);
ok("a student who is not admin is sent away", new URL(other.url()).pathname === "/");

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
