// Engagement: «Το δίνω» → my courses; a classmate uploads → I'm told; I open it (download) and say «Ευχαριστώ» →
// the uploader is told, sees downloads / thanks, tops the department's helpers and gets the badges on their profile.
// Needs the local stack + seed-speak and the proxy's OTP code 246810. Usage: node engage-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
const wait = (p, ms = 1200) => p.waitForTimeout(ms);

async function student(name) {
  const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
  await page.getByPlaceholder("…@mail.ntua.gr").fill(`en${crypto.randomInt(10000, 99999)}@mail.ntua.gr`);
  await wait(page, 400);
  await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
  await page.getByPlaceholder("000000").fill("246810");
  await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
  await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
  await wait(page, 800);
  await page.getByText("ΗΜΜΥ", { exact: true }).click();
  await page.getByRole("button", { name: "Συνέχεια" }).click();
  await page.getByPlaceholder("Όνομα και επώνυμο").fill(name);
  await page.getByRole("button", { name: "1ο" }).click();
  await page.getByRole("button", { name: "Τέλος" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
  await wait(page, 1500);
  return page;
}

const a = await student("Άννα Δίνει");
const b = await student("Βύρων Ανεβάζει");

// A: «Το δίνω» on the first ΗΜΜΥ course
await a.goto(base + "/courses", { waitUntil: "networkidle" });
await wait(a);
ok("my courses: hint before marking any", await a.getByText(/Πάτα «Το δίνω»/).isVisible());
ok("top helpers: empty board with the rule", (await a.getByText("Κανείς ακόμα.", { exact: false }).isVisible()) && (await a.getByText(/10 πόντοι για κάθε αρχείο/).isVisible()));
await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).first().click();
await a.waitForURL(/\/c\//);
await wait(a);
const courseUrl = a.url();
await a.getByRole("button", { name: "Το δίνω" }).click();
await wait(a, 1000);
ok("«Το δίνω»: pressed, toast, «1 συμφοιτητής το δίνει»",
  (await a.getByRole("button", { name: "Το δίνω" }).getAttribute("aria-pressed")) === "true"
  && (await a.getByText("Θα μαθαίνεις για κάθε νέο αρχείο").isVisible()) && (await a.getByText("1 συμφοιτητής το δίνει").isVisible()));
await a.goto(base + "/courses", { waitUntil: "networkidle" });
await wait(a);
ok("my courses lists it", (await a.getByRole("heading", { name: "Τα μαθήματά μου" }).isVisible())
  && (await a.locator("section", { has: a.getByRole("heading", { name: "Τα μαθήματά μου" }) }).getByText("Γραμμική Άλγεβρα").isVisible()));

// B uploads to that course
await b.goto(courseUrl, { waitUntil: "networkidle" });
await wait(b);
await b.getByRole("button", { name: "Ανέβασε αρχείο" }).click();
await wait(b, 500);
await b.locator('input[type="file"]').setInputFiles({ name: "Λυμένες.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n" + "x".repeat(2000)) });
await b.getByLabel("Τίτλος").fill("Λυμένες ασκήσεις");
await b.getByRole("button", { name: "Ανέβασμα", exact: true }).click();
await wait(b, 2000);
ok("B uploaded", await b.getByText("Λυμένες ασκήσεις").isVisible());

// A is told, opens the course from the notice, opens the file and thanks
await a.goto(base + "/notifications", { waitUntil: "networkidle" });
await wait(a);
const notice = a.getByText(/ανέβασε «Λυμένες ασκήσεις» στο «Γραμμική Άλγεβρα»/);
ok("A told about the new file", await notice.isVisible());
await notice.click();
await a.waitForURL(/\/c\//);
await wait(a);
ok("the notice opens the course", a.url() === courseUrl);
const [popup] = await Promise.all([a.waitForEvent("popup", { timeout: 4000 }).catch(() => null), a.getByRole("link", { name: /Λυμένες ασκήσεις/ }).click()]);
await popup?.close();
await wait(a, 800);
await a.getByRole("button", { name: "Ευχαριστώ" }).click();
await wait(a, 1000);
ok("A thanked: pressed, count 1", (await a.getByRole("button", { name: "Ευχαρίστησες" }).getAttribute("aria-pressed")) === "true"
  && (await a.getByRole("button", { name: "Ευχαρίστησες" }).textContent())?.includes("1"));

// B: downloads + thanks on the own file, the notice, the board, the profile
await b.reload({ waitUntil: "networkidle" });
await wait(b);
ok("B sees «1 λήψη» and «1 ευχαριστώ» on the own file", (await b.getByText("1 λήψη").isVisible()) && (await b.getByText("1 ευχαριστώ").isVisible()));
await b.goto(base + "/notifications", { waitUntil: "networkidle" });
await wait(b);
ok("B told about the thanks", await b.getByText("σε ευχαρίστησε για «Λυμένες ασκήσεις»").isVisible());
await b.goto(base + "/courses", { waitUntil: "networkidle" });
await wait(b);
const board = b.locator("section", { has: b.getByRole("heading", { name: /Top βοηθοί/ }) });
ok("board: B first with 14 points (10 file + 1 download + 3 thanks), marked «εσύ»",
  (await board.getByText("Βύρων Ανεβάζει").isVisible()) && (await board.getByText("14 πόντοι").isVisible()) && (await board.getByText("· εσύ").isVisible()));
await b.goto(base + "/profile", { waitUntil: "networkidle" });
await wait(b, 1500);
ok("profile: Top βοηθός + Ιδρυτικό μέλος, points line",
  (await b.getByText("Top βοηθός").isVisible()) && (await b.getByText("Ιδρυτικό μέλος").isVisible())
  && (await b.getByText(/14 πόντοι · #1 στο τμήμα · βοήθησε 1 συμφοιτητή/).isVisible()));
await a.goto(base + "/profile", { waitUntil: "networkidle" });
await wait(a, 1500);
ok("A (no files): founding badge only, no points line", (await a.getByText("Ιδρυτικό μέλος").isVisible()) && !(await a.getByText("Top βοηθός").isVisible()) && !(await a.getByText(/πόντ/).isVisible()));

// untake
await a.goto(courseUrl, { waitUntil: "networkidle" });
await wait(a);
await a.getByRole("button", { name: "Το δίνω" }).click();
await wait(a, 1000);
ok("untake: not pressed, takers line gone", (await a.getByRole("button", { name: "Το δίνω" }).getAttribute("aria-pressed")) === "false"
  && !(await a.getByText(/το δίνει/).isVisible()));

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
