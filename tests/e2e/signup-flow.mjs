// 3-step student sign-up: academic email → code (Supabase Auth OTP; the local proxy's code is 246810) → department /
// year + name → Home. Needs the local stack + seed. Usage: node signup-flow.mjs <port>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const sql = (q) => execSync(`psql -h /tmp -p 54329 -U postgres -d courtsie -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR", timezoneId: "Europe/Athens" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const email = `el${Date.now() % 100000}@mail.ntua.gr`;

await page.goto(base + "/auth", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Ξεκίνα με το φοιτητικό σου email" }).click();
const input = page.getByPlaceholder("…@mail.ntua.gr");
await input.fill("someone@gmail.com");
await page.waitForTimeout(1300);
ok("step 1: a non-academic address is flagged, Send disabled",
  (await page.getByText("Αυτό δεν είναι email πανεπιστημίου").isVisible()) && (await page.getByRole("button", { name: "Στείλε κωδικό" }).isDisabled()));
await input.fill(email);
await page.waitForTimeout(400);
ok("step 1: the university is named from the address", await page.getByText("✓ Εθνικό Μετσόβιο Πολυτεχνείο").isVisible());
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.waitForTimeout(800);
ok("step 2: code screen, no password anywhere", (await page.getByText("Γράψε τον κωδικό").isVisible()) && (await page.locator('input[type="password"]').count()) === 0);

const code = page.getByPlaceholder("000000");
await code.fill("111111");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForTimeout(800);
ok("step 2: a wrong code says so and stays", (await page.getByText("Λάθος ή ληγμένος κωδικός").isVisible()) && page.url().includes("/auth"));
await code.fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
ok("step 3: verified at once → department list", page.url().includes("/student") && (await page.getByText("Ηλεκτρολόγων Μηχανικών").first().isVisible()));
const verified = sql(`SELECT university_id || '/' || (student_verified_at IS NOT NULL) FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email = '${email}'`);
ok(`account = the academic address, verified ΕΜΠ student (${verified})`, verified === "ntua/true");

await page.getByText("ΗΜΜΥ", { exact: true }).click();
await page.getByRole("button", { name: "Συνέχεια" }).click();
await page.waitForTimeout(500);
ok("last step asks the name (none yet) with the year", (await page.getByText("Πώς σε λένε;").isVisible()) && (await page.getByRole("button", { name: "Τέλος" }).isDisabled()));
await page.getByPlaceholder("Όνομα και επώνυμο").fill("Ελένη Φοιτήτρια");
await page.getByRole("button", { name: "1ο" }).click();
await page.getByRole("button", { name: "Τέλος" }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1000);
const prof = sql(`SELECT full_name || '/' || department_id || '/' || study_year FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email = '${email}'`);
ok(`→ Home, profile saved (${prof})`, new URL(page.url()).pathname === "/" && prof === "Ελένη Φοιτήτρια/ntua-ece/1");

// A returning student: same 2 steps, no department question, straight Home.
const ctx2 = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" });
const p2 = await ctx2.newPage();
await p2.goto(base + "/auth", { waitUntil: "networkidle" });
await p2.getByRole("button", { name: "Ξεκίνα με το φοιτητικό σου email" }).click();
await p2.getByPlaceholder("…@mail.ntua.gr").fill(email);
await p2.waitForTimeout(400);
await p2.getByRole("button", { name: "Στείλε κωδικό" }).click();
await p2.getByPlaceholder("000000").fill("246810");
await p2.getByRole("button", { name: "Επιβεβαίωση" }).click();
await p2.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await p2.waitForTimeout(1500);
ok("returning student: email + code → Home", new URL(p2.url()).pathname === "/" && (await p2.getByRole("tab", { name: "Campus" }).isVisible()));
await ctx2.close();

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
