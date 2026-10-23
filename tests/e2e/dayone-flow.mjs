// Day one on an empty campus: a brand-new ΕΜΠ student (3-step sign-up) finds the year group with "Say hi" and starter
// questions instead of an empty feed; both open the composer ready to edit; "which courses do you have this semester"
// (core ticked) saves them as «Το δίνω»; a closed campus (ΑΠΘ) still offers courses + the year group. Needs the local stack + seed-speak only (no
// campus posts) and the proxy's OTP code 246810. Usage: node dayone-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await page.getByPlaceholder("…@mail.ntua.gr").fill(`el${crypto.randomInt(10000, 99999)}@mail.ntua.gr`);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
await page.getByText("ΗΜΜΥ", { exact: true }).click();
await page.getByRole("button", { name: "Συνέχεια" }).click();
await page.getByPlaceholder("Όνομα και επώνυμο").fill("Πρωτοετής Δοκιμή");
await page.getByRole("button", { name: "1ο" }).click();
await page.getByRole("button", { name: "Τέλος" }).click();
await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);

const pick = page.getByRole("heading", { name: /Τι μαθήματα έχεις στο \dο εξάμηνο;/ });
const ticked = await page.locator('section[aria-labelledby="pick-courses"] button[aria-pressed="true"]').count();
ok("Campus asks this semester's courses, core ones ticked", (await pick.isVisible()) && ticked > 0);
await page.getByRole("button", { name: `Αποθήκευση (${ticked})` }).click();
await page.waitForTimeout(1500);
ok("saving adds them to my courses and the card goes", !(await pick.isVisible()) && (await page.getByText(/Πρόσθεσες \d+ μαθήματ/).isVisible()));
ok("Campus shows your year group with Say hi", (await page.getByText("Η ομάδα του έτους σου").isVisible())
  && (await page.getByText("ΗΜΜΥ · 1ο έτος").first().isVisible()) && (await page.getByRole("link", { name: "Πες γεια" }).isVisible()));
ok("an empty campus feed offers starter questions", (await page.getByText("Κάνε την πρώτη ερώτηση").isVisible())
  && (await page.getByRole("link", { name: /Πότε βγαίνουν οι βαθμοί/ }).isVisible()));
await page.getByRole("link", { name: /Πότε βγαίνουν οι βαθμοί/ }).click();
await page.waitForURL(/\/record/);
await page.waitForTimeout(800);
ok("a starter opens the campus composer in «Ερωτήσεις» with the question written",
  (await page.getByPlaceholder("Τι γίνεται;").inputValue()) === "Πότε βγαίνουν οι βαθμοί της εξεταστικής;"
  && (await page.getByRole("button", { name: "Ερωτήσεις" }).getAttribute("aria-pressed")) === "true");
await page.getByRole("button", { name: "Δημοσίευση", exact: true }).click();
await page.waitForURL(/\/p\//, { timeout: 8000 }).catch(() => {});
ok("…and publishes", page.url().includes("/p/"));

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("link", { name: "Πες γεια" }).click();
await page.waitForURL(/\/record/);
await page.waitForTimeout(800);
ok("Say hi opens the group composer with a greeting", (await page.getByPlaceholder("Τι γίνεται;").inputValue()).startsWith("Γεια σε όλους!") && page.url().includes("group="));

// A closed campus (ΑΠΘ waits for 100 students): courses and the year group work already.
const c = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
c.on("pageerror", (e) => errors.push(e.message));
await c.goto(base + "/auth?mode=signup", { waitUntil: "networkidle" });
await c.getByPlaceholder("…@mail.ntua.gr").fill(`th${crypto.randomInt(10000, 99999)}@csd.auth.gr`);
await c.waitForTimeout(400);
await c.getByRole("button", { name: "Στείλε κωδικό" }).click();
await c.getByPlaceholder("000000").fill("246810");
await c.getByRole("button", { name: "Επιβεβαίωση" }).click();
await c.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
await c.waitForTimeout(800);
await c.getByPlaceholder("Αναζήτηση τμήματος").fill("Πληροφορικ");
await c.getByText("Πληροφορική", { exact: true }).click();
await c.getByRole("button", { name: "Συνέχεια" }).click();
await c.getByPlaceholder("Όνομα και επώνυμο").fill("Φοιτήτρια Θεσσαλονίκης");
await c.getByRole("button", { name: "2ο" }).click();
await c.getByRole("button", { name: "Τέλος" }).click();
await c.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
await c.waitForTimeout(1500);
ok("closed campus: waiting screen still offers courses, this semester's pick and the year group",
  (await c.getByText(/ανοίγει σύντομα/).isVisible()) && (await c.getByRole("link", { name: /Μαθήματα.*Σημειώσεις και παλιά θέματα/ }).isVisible())
  && (await c.getByRole("heading", { name: /Τι μαθήματα έχεις στο [34]ο εξάμηνο;/ }).isVisible()) && (await c.getByText("Πληροφορική · 2ο έτος").first().isVisible()));
await c.getByRole("button", { name: "Όχι τώρα" }).click();
await c.reload({ waitUntil: "networkidle" });
await c.waitForTimeout(1200);
ok("«Όχι τώρα» hides the pick for good", !(await c.getByRole("heading", { name: /Τι μαθήματα έχεις/ }).isVisible()));

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
