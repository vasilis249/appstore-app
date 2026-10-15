// Public share page /v/<post>: a teaser for anyone (no voice, no photos), link-preview tags in the server HTML, nothing
// for group posts, and a visitor who signs up from it lands on the post. Needs the local stack + seed-speak + seed-photos
// (+ the proxy's OTP code 246810). Usage: node share-flow.mjs <port>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:" + process.argv[2];
const ok = (l, c) => console.log(c ? "PASS" : "FAIL", l);
const sql = (q) => execSync(`psql -h /tmp -p 54329 -U postgres -d courtsie -qAtc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const POST = "eeeeeeee-0000-0000-0000-000000000001"; // seed-photos: text + 2 photos + a voice
const author = sql(`SELECT split_part(coalesce(nullif(full_name, ''), username), ' ', 1) FROM public.profiles p JOIN public.posts x ON x.author_id = p.id WHERE x.id = '${POST}'`);
const text = sql(`SELECT title FROM public.posts WHERE id = '${POST}'`);
const group = sql(`INSERT INTO public.groups (name, section_id, privacy) VALUES ('Κλειστή ομάδα', 'courses', 'private') RETURNING id`);
const gpost = sql(`INSERT INTO public.posts (author_id, group_id, section_id, title) SELECT author_id, '${group}', 'courses', 'Μυστικό της ομάδας' FROM public.posts WHERE id = '${POST}' RETURNING id`);

const html = execSync(`curl -s ${base}/v/${POST}`).toString();
ok("server HTML carries link-preview tags (og:title with the first name, og:description = the text)",
  html.includes('property="og:title"') && html.includes(author) && html.includes(text.slice(0, 20)));
ok("…and no voice or photo paths in it", !/\.(m4a|webm|mp4|jpe?g|png|webp)/i.test(html.split("<body")[1] ?? html));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "el-GR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/v/${POST}`, { waitUntil: "networkidle" });
ok("visitor sees the teaser: first name, text, 'Φωνή m:ss', '2 φωτογραφίες', students-only note",
  (await page.getByText(author, { exact: true }).isVisible()) && (await page.getByText(text.slice(0, 20)).isVisible())
  && (await page.getByText(/Φωνή \d+:\d\d/).isVisible()) && (await page.getByText("2 φωτογραφίες").isVisible())
  && (await page.getByText("μόνο για φοιτητές", { exact: false }).first().isVisible()));
ok("no audio or photo is loaded for the visitor", (await page.locator("audio, img").count()) === 0);

await page.goto(`${base}/v/${gpost}`, { waitUntil: "networkidle" });
ok("a group post shows nothing of it", (await page.getByText("Αυτή η ανάρτηση δεν είναι διαθέσιμη").isVisible()) && !(await page.content()).includes("Μυστικό"));

// Sign up from the share page → land on that post.
await page.goto(`${base}/v/${POST}`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Ξεκίνα με το φοιτητικό σου email" }).click();
const email = `el${crypto.randomInt(10000, 99999)}@mail.ntua.gr`;
await page.getByPlaceholder("…@mail.ntua.gr").fill(email);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Στείλε κωδικό" }).click();
await page.getByPlaceholder("000000").fill("246810");
await page.getByRole("button", { name: "Επιβεβαίωση" }).click();
await page.waitForURL(/\/student/, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
await page.getByText("ΗΜΜΥ", { exact: true }).click();
await page.getByRole("button", { name: "Συνέχεια" }).click();
await page.getByPlaceholder("Όνομα και επώνυμο").fill("Νέα Φοιτήτρια");
await page.getByRole("button", { name: "Τέλος" }).click();
await page.waitForURL(new RegExp(`/p/${POST}`), { timeout: 8000 }).catch(() => {});
ok("after signing up from the share page the post itself opens", page.url().includes(`/p/${POST}`));

await page.goto(`${base}/v/${POST}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
ok("a signed-in student opening a share link goes straight to the post", page.url().includes(`/p/${POST}`));

console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
