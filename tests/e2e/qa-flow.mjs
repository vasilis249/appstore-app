// Course Q&A: the Courses tab in the bottom bar; B takes Γραμμική Άλγεβρα («Το δίνω»); A asks a question there →
// it shows on the course's «Ερωτήσεις» (and names the course on the card); B is told, answers; A marks the answer
// helpful → badge + B is told; B switches «Αντιδράσεις» push off (kept after a reload).
// Needs the local stack + seed-speak and the proxy's OTP code 246810. Usage: node qa-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];

async function student(name) {
  const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
  await page.getByPlaceholder("…@mail.ntua.gr").fill(`qa${crypto.randomInt(10000, 99999)}@mail.ntua.gr`);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
  await page.getByPlaceholder("000000").fill("246810");
  await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
  await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText("ΗΜΜΥ", { exact: true }).click();
  await page.getByRole("button", { name: "Συνέχεια" }).click();
  await page.getByPlaceholder("Όνομα και επώνυμο").fill(name);
  await page.getByRole("button", { name: "1ο" }).click();
  await page.getByRole("button", { name: "Τέλος" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page;
}
async function openCourse(p) {
  await p.locator("nav").getByRole("link", { name: "Μαθήματα", exact: true }).click(); // the bottom bar tab
  await p.waitForURL(/\/courses/);
  await p.waitForTimeout(1200);
  await p.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).first().click();
  await p.waitForURL(/\/c\//);
  await p.waitForTimeout(1000);
}

const b = await student("Βασίλης Απαντητής");
await openCourse(b);
ok("Courses tab: active on a course page", (await b.locator("nav").getByRole("link", { name: "Μαθήματα", exact: true }).getAttribute("aria-current")) === "page");
if ((await b.getByRole("button", { name: "Το δίνω" }).getAttribute("aria-pressed")) !== "true") await b.getByRole("button", { name: "Το δίνω" }).click();
await b.waitForTimeout(600);

const a = await student("Άλκηστη Ρωτάει");
await openCourse(a);
await a.getByRole("tab", { name: /Ερωτήσεις/ }).click();
await a.waitForTimeout(1200);
ok("course page: Questions tab, empty, «Κάνε ερώτηση»", (await a.getByText(/Καμία ερώτηση ακόμα/).isVisible()) && (await a.getByRole("link", { name: "Κάνε ερώτηση" }).isVisible()));
await a.getByRole("link", { name: "Κάνε ερώτηση" }).click();
await a.waitForURL(/\/record/);
await a.waitForTimeout(800);
ok("composer: «Ερώτηση στο μάθημα» + the course", (await a.getByText("Ερώτηση στο μάθημα").isVisible()) && (await a.getByText(/Γραμμική Άλγεβρα/).first().isVisible()));
await a.getByPlaceholder("Τι θέλεις να ρωτήσεις;").fill("Πώς βρίσκω τις ιδιοτιμές ενός 3x3;");
await a.getByRole("button", { name: "Δημοσίευση", exact: true }).click();
await a.waitForURL(/\/p\//, { timeout: 8000 }).catch(() => {});
await a.waitForTimeout(1200);
const qUrl = a.url();
ok("published → the question, card names the course", qUrl.includes("/p/") && (await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).first().isVisible()));

await b.goto(base + "/notifications", { waitUntil: "networkidle" });
await b.waitForTimeout(1200);
ok("taker is told: «ρώτησε στο «Γραμμική Άλγεβρα»»", await b.getByText(/ρώτησε στο «Γραμμική Άλγεβρα/).isVisible());
await b.getByText(/ρώτησε στο «Γραμμική Άλγεβρα/).click();
await b.waitForURL(/\/p\//);
await b.waitForTimeout(800);
await b.getByRole("link", { name: /Απάντησε/ }).first().click();
await b.waitForURL(/\/record/);
await b.waitForTimeout(800);
await b.getByPlaceholder(/Γράψε την απάντησή σου|Απάντησε/).first().fill("Λύνεις det(A − λI) = 0.");
await b.getByRole("button", { name: "Δημοσίευση", exact: true }).click();
await b.waitForURL(/\/p\//, { timeout: 8000 }).catch(() => {});
await b.waitForTimeout(800);

await a.goto(qUrl, { waitUntil: "networkidle" });
await a.waitForTimeout(1200);
ok("asker sees the hint and «Βοήθησε» on the answer", (await a.getByText(/Σημείωσε την απάντηση που σε βοήθησε/).isVisible()) && (await a.getByRole("button", { name: /Βοήθησε/ }).isVisible()));
await a.getByRole("button", { name: /Βοήθησε/ }).click();
await a.waitForTimeout(1200);
ok("marked: badge «Βοηθητική απάντηση», button pressed", (await a.getByText("Βοηθητική απάντηση", { exact: true }).isVisible())
  && (await a.getByRole("button", { name: /Βοήθησε/ }).getAttribute("aria-pressed")) === "true");

await b.goto(base + "/notifications", { waitUntil: "networkidle" });
await b.waitForTimeout(1200);
ok("answerer is told", await b.getByText(/σημείωσε την απάντησή σου ως βοηθητική/).isVisible());
await b.getByRole("button", { name: "Ειδοποιήσεις στο κινητό" }).click();
await b.waitForTimeout(800);
const reactions = b.getByRole("switch").nth(3);
ok("push settings: six categories, all on", (await b.getByRole("switch").count()) === 6 && (await reactions.getAttribute("aria-checked")) === "true");
await reactions.click();
await b.waitForTimeout(800);
await b.reload({ waitUntil: "networkidle" });
await b.waitForTimeout(1000);
await b.getByRole("button", { name: "Ειδοποιήσεις στο κινητό" }).click();
await b.waitForTimeout(800);
ok("«Αντιδράσεις» stays off after a reload", (await b.getByRole("switch").nth(3).getAttribute("aria-checked")) === "false");

await b.goto(base + "/courses", { waitUntil: "networkidle" }).catch(() => {});
await b.waitForTimeout(800);
console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
