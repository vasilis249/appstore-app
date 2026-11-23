// Forgot password → 6-digit code (no link) → new password. Needs the local stack + seed-speak and the proxy's code
// 246810 (any /auth/v1/verify type). Usage: node reset-flow.mjs <port>
import { createRequire } from "node:module";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(base + "/forgot-password?email=el30001@mail.ntua.gr", { waitUntil: "networkidle" });
ok("the page offers a code, not a link", await page.getByRole("button", { name: "Στείλε κωδικό" }).isVisible());
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.waitForTimeout(800);
ok("after sending: the code field", await page.getByPlaceholder("000000").isVisible());
await page.getByPlaceholder("000000").fill("111111");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForTimeout(800);
ok("a wrong code says so and stays", (await page.getByText(/Λάθος ή ληγμένος κωδικός/).isVisible()) && new URL(page.url()).pathname === "/forgot-password");
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL(/\/reset-password/, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
ok("the right code opens «Νέος κωδικός» with the two fields", (await page.getByPlaceholder("Νέος κωδικός").isVisible())
  && (await page.getByPlaceholder("Επιβεβαίωση κωδικού").isVisible()) && (await page.getByRole("button", { name: "Αποθήκευση" }).isEnabled()));
ok("no page errors", errors.length === 0);
console.log(errors.join("\n"));
await browser.close();
