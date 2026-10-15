// Day one on an empty campus: a brand-new ΕΜΠ student (3-step sign-up) finds the year group with "Say hi" and starter
// questions instead of an empty feed; both open the composer ready to edit. Needs the local stack + seed-speak only (no
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

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
