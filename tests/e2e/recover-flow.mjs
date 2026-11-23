// An older account (made with a personal email) verified with an academic address; its owner later signs in with a
// code to that academic address → «we found your account», a new code → the older account, not a second empty one.
// Needs the local stack + seed-speak and the proxy's code 246810. Usage: node recover-flow.mjs <port>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const sql = (q) => execSync(`psql -h /tmp -p 54329 -U postgres -d courtsie -qAtc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const MARIA = "22222222-0000-0000-0000-000000000002", ADDR = "smd2200078@mail.ntua.gr";
sql(`UPDATE public.profiles SET university_id = 'ntua', department_id = 'ntua-ece', study_year = 2, student_verified_at = now() WHERE id = '${MARIA}'`);
sql(`INSERT INTO private.student_emails (email_hash, user_id, university_id) VALUES (private.sha(private.email_key('${ADDR}')), '${MARIA}', 'ntua') ON CONFLICT DO NOTHING`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await page.getByPlaceholder("…@mail.ntua.gr").fill(ADDR);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForTimeout(1500);
ok("«we found your account» instead of «already used»", await page.getByText("Βρήκαμε τον λογαριασμό σου").isVisible());
ok("the empty account is gone and Maria's account signs in with the academic address",
  sql(`SELECT count(*) FROM auth.users WHERE lower(email) = '${ADDR}'`) === "1" && sql(`SELECT email FROM auth.users WHERE id = '${MARIA}'`) === ADDR);
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.goto(base + "/profile", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
ok("the next code opens Maria's own (verified) account, no «which university» step",
  (await page.getByText("Μαρία Παπαδοπούλου").first().isVisible()) && !page.url().includes("/student"));

// Part 2 — the same student on the student screen (/student): an account that never got verified (a sign-in whose
// claim failed) enters the address another account holds → a correct code moves him there too.
const NIKOS = "33333333-0000-0000-0000-000000000003", HELD = "smd2200079@mail.ntua.gr", NEW = "el21999@mail.ntua.gr";
sql(`UPDATE public.profiles SET university_id = 'ntua', student_verified_at = now() WHERE id = '${NIKOS}'`);
sql(`INSERT INTO private.student_emails (email_hash, user_id, university_id) VALUES (private.sha(private.email_key('${HELD}')), '${NIKOS}', 'ntua') ON CONFLICT DO NOTHING`);
const p2 = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
p2.on("pageerror", (e) => errors.push(e.message));
await p2.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await p2.getByPlaceholder("…@mail.ntua.gr").fill(NEW);
await p2.waitForTimeout(400);
await p2.getByRole("button", { name: "Στείλε κωδικό" }).click();
await p2.getByPlaceholder("000000").fill("246810");
await p2.getByRole("button", { name: "Επιβεβαίωση" }).click();
await p2.waitForURL((u) => new URL(u).pathname === "/student", { timeout: 8000 }).catch(() => {});
const uid = sql(`SELECT id FROM auth.users WHERE email = '${NEW}'`);
sql(`DELETE FROM private.student_emails WHERE user_id = '${uid}'`);
sql(`UPDATE public.profiles SET university_id = NULL, student_verified_at = NULL WHERE id = '${uid}'`);
await p2.goto(base + "/student", { waitUntil: "networkidle" });
await p2.waitForTimeout(800);
await p2.getByPlaceholder("…@uoa.gr").fill(HELD);
await p2.waitForTimeout(1200);
await p2.getByRole("button", { name: "Στείλε κωδικό" }).click();
await p2.getByPlaceholder("000000").waitFor({ timeout: 8000 });
ok("the student screen sends a code to an address another account holds (no «already used»)",
  sql(`SELECT count(*) FROM private.student_codes WHERE user_id = '${uid}'`) === "1");
sql(`UPDATE private.student_codes SET code_hash = private.sha('111222') WHERE user_id = '${uid}'`);
await p2.getByPlaceholder("000000").fill("111222");
await p2.getByRole("button", { name: "Επιβεβαίωση" }).click();
await p2.waitForURL((u) => new URL(u).pathname === "/auth", { timeout: 8000 }).catch(() => {});
await p2.waitForTimeout(1200);
ok("a correct code there: «we found your account» on the sign-in code step, the empty account gone",
  (await p2.getByText("Βρήκαμε τον λογαριασμό σου").isVisible())
  && sql(`SELECT count(*) FROM auth.users WHERE id = '${uid}'`) === "0" && sql(`SELECT email FROM auth.users WHERE id = '${NIKOS}'`) === HELD);
await p2.getByPlaceholder("000000").fill("246810");
await p2.getByRole("button", { name: "Επιβεβαίωση" }).click();
await p2.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await p2.goto(base + "/profile", { waitUntil: "networkidle" });
await p2.waitForTimeout(1200);
ok("the sign-in code opens Nikos's verified account", (await p2.getByText("Νίκος Γεωργίου").first().isVisible()) && !p2.url().includes("/student"));
ok("no page errors (part 2)", errors.length === 0);
console.log(errors.join("\n"));
await browser.close();
