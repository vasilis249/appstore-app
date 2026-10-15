// UX audit fixes (AUDIT.md): draft guard in the composer, slip-proof "tap again" delete, early unknown-email note,
// 44 pt hit areas, offline message. Needs the local stack + seed (me = a verified ΕΜΠ student). Usage: node ux-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const SECRET = "local-dev-secret-local-dev-secret-0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c) => { const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(c); return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`; };
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const ME = "11111111-0000-0000-0000-000000000001";
const now = Math.floor(Date.now() / 1000);
const tok = jwt({ iat: now, exp: now + 86400, role: "authenticated", sub: ME, email: "me@test", aud: "authenticated" });
const session = { access_token: tok, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local",
  user: { id: ME, email: "me@test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR", timezoneId: "Europe/Athens" });
await ctx.addInitScript((s) => { try { localStorage.setItem("sb-127-auth-token", JSON.stringify(s)); } catch {} }, session);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (p) => { await page.goto(base + p, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };
const text = "Ποιος έχει τις σημειώσεις της Ανάλυσης; " + Date.now();

// 0. U2: nothing to play → no "Παίξε όλα"; a newcomer sees that the voice drop wants a hold.
await go("/?tab=following");
ok("empty feed: no 'Play all'", (await page.getByText("Τίποτα ακόμα εδώ").isVisible()) && !(await page.getByRole("button", { name: "Παίξε όλα" }).isVisible().catch(() => false)));
await go("/record");
ok("composer: 'hold for voice' hint for a newcomer", await page.getByText("Κράτα πατημένο για φωνή").isVisible());
await page.evaluate(() => localStorage.setItem("courtsie:holdLearned", "1"));
await go("/record");
ok("hint gone once learned", !(await page.getByText("Κράτα πατημένο για φωνή").isVisible().catch(() => false)));

// 1. Draft guard: back with text asks; "keep editing" keeps it; "discard" leaves.
await go("/?tab=following");
await page.getByText("Πες κάτι δικό σου…").click();
await page.waitForURL(/\/record/);
await page.getByPlaceholder("Τι γίνεται;").fill(text);
await page.getByRole("button", { name: "Πίσω" }).click();
await page.waitForTimeout(600);
ok("back with a draft asks first", await page.getByText("Απόρριψη του πρόχειρου;").isVisible());
await page.getByRole("button", { name: "Συνέχεια επεξεργασίας" }).click();
await page.waitForTimeout(500);
ok("keep editing: still on the composer, text kept", page.url().includes("/record") && (await page.getByPlaceholder("Τι γίνεται;").inputValue()) === text);
await page.getByRole("button", { name: "Πίσω" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Απόρριψη", exact: true }).click();
await page.waitForTimeout(800);
ok("discard leaves the composer", !page.url().includes("/record"));

// 2. Empty composer: back leaves at once (nothing to lose).
await go("/record");
await page.getByRole("button", { name: "Πίσω" }).click();
await page.waitForTimeout(800);
ok("empty composer: back without a question", !page.url().includes("/record") && !(await page.getByText("Απόρριψη του πρόχειρου;").isVisible().catch(() => false)));

// 3. Publishing is not blocked by the guard.
await go("/record");
await page.getByPlaceholder("Τι γίνεται;").fill(text);
await page.getByRole("button", { name: "Δημοσίευση", exact: true }).click();
await page.waitForURL(/\/p\//, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
ok("publish goes straight to the post", page.url().includes("/p/") && !(await page.getByText("Απόρριψη του πρόχειρου;").isVisible().catch(() => false)));

await page.waitForTimeout(4500); // the "published" toast covers the top of the post

// 4a. Offline (metro): the banner says what happens, and a like made offline is sent once the signal is back.
await ctx.setOffline(true);
await page.waitForTimeout(500);
ok("offline banner tells it will be sent later", await page.getByText("Χωρίς σύνδεση. Ό,τι κάνεις θα σταλεί").isVisible());
const like = page.getByRole("button", { name: "Μου αρέσει" }).first();
await like.click();
await page.waitForTimeout(800);
await ctx.setOffline(false);
await page.waitForTimeout(2500);
ok("the like went through after reconnecting", (await page.getByRole("button", { name: "Δεν μου αρέσει πια" }).count()) > 0);
await page.waitForTimeout(3000);

// 4. 44 pt hit areas: a tap 20 px under the post's ⋯ (36 px tall) still hits it.
const more = page.getByRole("button", { name: "Ενέργειες" }).first();
const bb = await more.boundingBox();
const hitEl = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null, [bb.x + bb.width / 2, bb.y + bb.height / 2 + 20]);
ok(`hit area reaches 44 pt (${Math.round(bb.height)} px button, tap at +20 px → ${hitEl})`, hitEl === "Ενέργειες");

// 5. Delete: a fast double tap only arms it; a deliberate second tap deletes.
await more.click();
await page.getByRole("button", { name: "Διαγραφή ανάρτησης" }).dblclick();
await page.waitForTimeout(400);
ok("double tap does not delete (still asking)", await page.getByRole("button", { name: "Πάτα ξανά για διαγραφή" }).isVisible());
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Πάτα ξανά για διαγραφή" }).click();
await page.waitForTimeout(1200);
ok("deliberate second tap deletes", await page.getByText("Διαγράφηκε").first().isVisible().catch(() => false));

// 6. Student email: an address of no supported university is flagged before sending.
const MARIA = "22222222-0000-0000-0000-000000000002"; // not verified yet
const mtok = jwt({ iat: now, exp: now + 86400, role: "authenticated", sub: MARIA, email: "maria@test", aud: "authenticated" });
const mctx = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" });
await mctx.addInitScript((s) => { try { localStorage.setItem("sb-127-auth-token", JSON.stringify(s)); } catch {} },
  { ...session, access_token: mtok, user: { ...session.user, id: MARIA, email: "maria@test" } });
const mp = await mctx.newPage();
await mp.goto(base + "/student", { waitUntil: "networkidle" });
await mp.waitForTimeout(1500);
const email = mp.getByPlaceholder("…@uoa.gr");
await email.fill("someone@gmail.com");
await mp.waitForTimeout(1300);
ok("unknown email domain: note + Send disabled", (await mp.getByText("Αυτό δεν είναι email πανεπιστημίου").isVisible())
  && (await mp.getByRole("button", { name: "Στείλε κωδικό" }).isDisabled()));
await email.fill("someone@mail.ntua.gr");
await mp.waitForTimeout(1300);
ok("known domain: no note, Send enabled", !(await mp.getByText("Αυτό δεν είναι email πανεπιστημίου").isVisible()) && (await mp.getByRole("button", { name: "Στείλε κωδικό" }).isEnabled()));
await mctx.close();

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
