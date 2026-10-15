// Fails if a .glass element sits inside a "backdrop root" (an ancestor with filter, opacity < 1, mask, clip-path,
// backdrop-filter, blend mode or view-transition-name): its frost would see nothing and the page shows through crisp.
// Needs the local stack + seed. Usage: node glass-check.mjs <port> [paths…]
import { createRequire } from "node:module";
import crypto from "node:crypto";
const { chromium, devices } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const SECRET = "local-dev-secret-local-dev-secret-0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c) => { const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(c); return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`; };
const ME = "11111111-0000-0000-0000-000000000001", now = Math.floor(Date.now() / 1000);
const tok = jwt({ iat: now, exp: now + 86400, role: "authenticated", sub: ME, email: "me@test", aud: "authenticated" });
const session = { access_token: tok, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local", user: { id: ME, email: "me@test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
const [port, ...args] = process.argv.slice(2);
const paths = args.length ? args : ["/", "/?tab=following", "/profile", "/messages", "/notifications", "/groups", "/map", "/search", "/record", "/talk"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "el-GR" });
await ctx.addInitScript((s) => localStorage.setItem("sb-127-auth-token", JSON.stringify(s)), session);
const p = await ctx.newPage();
let bad = 0, total = 0;
for (const path of paths) {
  await p.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const out = []; const all = [...document.querySelectorAll(".glass, .glass-thick, .liquid-tint")];
    for (const g of all) for (let e = g.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      const why = [c.filter !== "none" && "filter", +c.opacity < 1 && "opacity", c.mixBlendMode !== "normal" && "blend", c.clipPath !== "none" && "clip-path", c.maskImage !== "none" && "mask", c.backdropFilter !== "none" && "backdrop-filter", c.viewTransitionName !== "none" && "vt-name", /filter|opacity|mask|clip/.test(c.willChange) && "will-change"].filter(Boolean);
      if (why.length) { out.push(`${g.className.toString().slice(0, 50)} ← ${e.tagName}.${e.className.toString().slice(0, 40)} [${why}]`); break; }
    }
    return { n: all.length, out };
  });
  total += r.n; bad += r.out.length;
  console.log(path, `glass=${r.n}`, r.out.length ? "\n  " + r.out.join("\n  ") : "ok");
}
console.log(bad || !total ? "FAIL" : "PASS", `glass ${total}, inside a backdrop root ${bad}`); // 0 glass = the page never rendered
await b.close();
