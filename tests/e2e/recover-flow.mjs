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
ok("no page errors", errors.length === 0);
console.log(errors.join("\n"));
await browser.close();
