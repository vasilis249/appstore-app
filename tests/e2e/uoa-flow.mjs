// A new Athens Medical School student (ΕΚΠΑ, Ιατρικής, 6th year): 3-step sign-up with an @uoa.gr address, the ΕΚΠΑ
// campus is open (not "waiting"), its announcements show, the year group card and the composer work. Needs the local
// stack + seed-speak only and the proxy's OTP code 246810. Usage: node uoa-flow.mjs <port>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const sql = (q) => execSync(`psql -h /tmp -p 54329 -U postgres -d courtsie -qAtc "${q.replace(/"/g, '\\"')}"`).toString().trim();
sql(`INSERT INTO public.topics (section_id, kind, title, source_name, source_url, external_id, university_id)
  VALUES ('announcements', 'news', 'Ορκωμοσία πτυχιούχων Ιατρικής', 'ΕΚΠΑ', 'https://hub.uoa.gr/x', 'uoa-flow-1', 'uoa')`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await page.getByPlaceholder(/@/).fill(`smd${crypto.randomInt(1000000, 9999999)}@uoa.gr`);
await page.waitForTimeout(500);
ok("the address is recognised as ΕΚΠΑ", await page.getByText("Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών").first().isVisible());
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
await page.getByPlaceholder("Αναζήτηση τμήματος").fill("ιατρικ");
await page.getByText("Ιατρικής", { exact: true }).click();
await page.getByRole("button", { name: "Συνέχεια" }).click();
await page.getByPlaceholder("Όνομα και επώνυμο").fill("Φοιτήτρια Ιατρικής");
ok("Medicine offers the 6th year", await page.getByRole("button", { name: "6ο" }).isVisible());
await page.getByRole("button", { name: "6ο" }).click();
await page.getByRole("button", { name: "Τέλος" }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);

ok("Home is the open ΕΚΠΑ campus, not the waiting screen",
  (await page.getByText("Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών").first().isVisible()) && !(await page.getByText(/φοιτητές ακόμα|μέχρι να ανοίξει/).first().isVisible().catch(() => false)));
ok("ΕΚΠΑ announcements show", await page.getByText("Ορκωμοσία πτυχιούχων Ιατρικής").first().isVisible());
ok("year group card: Ιατρική · 6ο έτος", (await page.getByText("Η ομάδα του έτους σου").isVisible()) && (await page.getByText(/Ιατρική · 6ο έτος/).first().isVisible()));
await page.getByRole("link", { name: /Πότε βγαίνουν οι βαθμοί/ }).click();
await page.waitForURL(/\/record/);
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Δημοσίευση", exact: true }).click();
await page.waitForURL(/\/p\//, { timeout: 8000 }).catch(() => {});
ok("posts to the ΕΚΠΑ campus", page.url().includes("/p/") && sql(`SELECT university_id FROM public.posts ORDER BY created_at DESC LIMIT 1`) === "uoa");

// Sign out and back in with the same address: straight to Home, no department step again.
const email = sql(`SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 1`);
await page.evaluate(() => localStorage.clear());
await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await page.getByPlaceholder(/@/).fill(email);
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
ok("signing in again with the code goes straight Home", new URL(page.url()).pathname === "/");

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
