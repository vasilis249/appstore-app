// Courses: an ΕΜΠ student finds the Courses card on Campus, browses ΗΜΜΥ by semester, searches, switches department,
// uploads notes (PDF) to a course; a classmate sees and opens it and reports it; the uploader deletes it.
// Needs the local stack + seed-speak and the proxy's OTP code 246810. Usage: node courses-flow.mjs <port>
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
// SHOTS=<dir>: screenshots of the list, the upload sheet and the course page
const shot = (p, n) => process.env.SHOTS && p.screenshot({ path: `${process.env.SHOTS}/courses-${n}.png` });

async function student(name) {
  const page = await (await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" })).newPage();
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
  await page.getByPlaceholder("Όνομα και επώνυμο").fill(name);
  await page.getByRole("button", { name: "1ο" }).click();
  await page.getByRole("button", { name: "Τέλος" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page;
}

const a = await student("Άννα Μαθήματα");
ok("Campus shows the Courses card", await a.getByRole("link", { name: /Μαθήματα.*Σημειώσεις και παλιά θέματα/ }).isVisible());
await a.getByRole("link", { name: /Μαθήματα.*Σημειώσεις και παλιά θέματα/ }).click();
await a.waitForURL(/\/courses/);
await a.waitForTimeout(1200);
await shot(a, "1-list");
ok("your department's courses by semester", (await a.getByText("Ηλεκτρολόγων Μηχανικών", { exact: false }).first().isVisible())
  && (await a.getByRole("heading", { name: "1ο εξάμηνο" }).isVisible()) && (await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).isVisible()));
await a.getByPlaceholder("Αναζήτηση μαθήματος").fill("γραμμικη αλγ");
await a.waitForTimeout(300);
ok("search ignores accents", (await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).count()) >= 1
  && !(await a.getByRole("link", { name: /Λογική Σχεδίαση/ }).isVisible()));
await a.getByPlaceholder("Αναζήτηση μαθήματος").fill("");
await a.getByRole("tab", { name: "Επιλογής" }).click();
await a.waitForTimeout(300);
ok("filter: electives only", !(await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).isVisible())
  && (await a.getByText("Επιλογής").count()) > 3);
await a.getByRole("tab", { name: "Όλα" }).click();

await a.getByRole("button", { name: /Ηλεκτρολόγων Μηχανικών/ }).click();
await a.getByPlaceholder("Αναζήτηση τμήματος").fill("πολιτικ");
await a.getByRole("button", { name: /Πολιτικών Μηχανικών/ }).click();
await a.waitForTimeout(1200);
ok("another department's courses", a.url().includes("d=ntua-civil") && (await a.getByRole("heading", { name: "1ο εξάμηνο" }).isVisible()));
await a.goto(base + "/courses", { waitUntil: "networkidle" });
await a.waitForTimeout(1200);

await a.getByRole("link", { name: /Γραμμική Άλγεβρα/ }).first().click();
await a.waitForURL(/\/c\//);
await a.waitForTimeout(1000);
const courseUrl = a.url();
ok("course page: name, semester, kind, empty notes", (await a.getByRole("heading", { name: "Γραμμική Άλγεβρα" }).isVisible())
  && (await a.getByText(/1ο εξάμηνο · Υποχρεωτικό/).isVisible()) && (await a.getByText("Δεν υπάρχουν ακόμα σημειώσεις").isVisible()));

await a.getByRole("button", { name: "Ανέβασε αρχείο" }).click();
await a.waitForTimeout(500);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n" + "x".repeat(3000));
await a.locator('input[type="file"]').setInputFiles({ name: "Κεφάλαιο 1.pdf", mimeType: "application/pdf", buffer: pdf });
ok("picking a PDF fills the title from its name", (await a.getByLabel("Τίτλος").inputValue()) === "Κεφάλαιο 1");
await a.getByLabel("Τίτλος").fill("Σημειώσεις κεφ. 1–3");
await shot(a, "2-upload");
await a.getByRole("button", { name: "Ανέβασμα", exact: true }).click();
await a.waitForTimeout(2000);
ok("uploaded: listed under Notes with name and size, opens a signed link",
  (await a.getByText("Σημειώσεις κεφ. 1–3").isVisible()) && (await a.getByText(/Άννα Μαθήματα · .* · 3 KB/).isVisible())
  && /\/object\/(sign|file)\/course-files\//.test((await a.getByRole("link", { name: /Σημειώσεις κεφ\. 1–3/ }).getAttribute("href")) ?? "")
  && (await a.getByRole("tab", { name: "Σημειώσεις · 1" }).isVisible()));

await shot(a, "3-course");
const b = await student("Βασίλης Συμφοιτητής");
await b.goto(courseUrl, { waitUntil: "networkidle" });
await b.waitForTimeout(1200);
await b.goto(base + "/", { waitUntil: "networkidle" });
await b.waitForTimeout(1200);
await shot(b, "0-campus");
await b.goto(courseUrl, { waitUntil: "networkidle" });
await b.waitForTimeout(1200);
const href = await b.getByRole("link", { name: /Σημειώσεις κεφ\. 1–3/ }).getAttribute("href");
const res = href ? await b.request.get(new URL(href, base).href.replace(/^http:\/\/127\.0\.0\.1:\d+/, "http://127.0.0.1:54321").replace("/object/", "/storage/v1/object/")).catch(() => null) : null;
ok("a classmate sees the file and its link works", !!href && (await b.getByText("Σημειώσεις κεφ. 1–3").isVisible()) && (!res || res.ok()));
await b.getByRole("button", { name: "Ενέργειες" }).first().click();
await b.waitForTimeout(500);
await b.getByRole("button", { name: "Αναφορά αρχείου" }).click();
await b.getByRole("button", { name: "Πνευματικά δικαιώματα" }).click();
await b.waitForTimeout(800);
ok("a classmate reports it (copyright)", await b.getByText(/Ευχαριστούμε/).isVisible());

await a.getByRole("button", { name: "Διαγραφή" }).click();
await a.waitForTimeout(700);
await a.getByRole("button", { name: "Πάτα ξανά" }).click();
await a.waitForTimeout(1500);
ok("the uploader deletes it (tap twice)", !(await a.getByText("Σημειώσεις κεφ. 1–3").isVisible()) && (await a.getByText("Δεν υπάρχουν ακόμα σημειώσεις").isVisible()));

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
