// Local "mini Supabase" for UI tests: proxies /rest/v1 to PostgREST (real RLS on the
// local Postgres), fakes /auth/v1/user from our own HS256 JWTs, and fakes storage
// signing/uploads with bundled sport images.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { attachRealtime } from "./realtime-mock.mjs";

export const SECRET = "local-dev-secret-local-dev-secret-0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function jwt(claims) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 86400, ...claims });
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [h, b, s] = (token || "").split(".");
  if (!s) return null;
  const sig = crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  return sig === s ? JSON.parse(Buffer.from(b, "base64url").toString()) : null;
}

const IMG_DIR = new URL("../../src/assets", import.meta.url).pathname;
const FILES = new URL("./storage-files", import.meta.url).pathname;
const images = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR).filter((f) => f.endsWith(".jpg")) : [];

if (process.argv[1].endsWith("local-supabase.mjs")) {
  attachRealtime(http
    .createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      res.setHeader("access-control-allow-methods", "*");
      res.setHeader("access-control-expose-headers", "*");
      if (req.method === "OPTIONS") return res.end();
      const bearer = (req.headers.authorization || "").replace("Bearer ", "");

      if (url.pathname === "/auth/v1/user") {
        const c = verify(bearer);
        if (!c || c.role !== "authenticated") {
          res.statusCode = 401;
          return res.end('{"message":"invalid token"}');
        }
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ id: c.sub, aud: "authenticated", role: "authenticated", email: c.email, user_metadata: {}, app_metadata: {} }));
      }
      if (url.pathname.startsWith("/auth/")) {
        res.statusCode = 200;
        return res.end("{}");
      }
      // Storage emulation. Object rows live in storage.objects (RLS enforced through PostgREST
      // with the caller's JWT); file bytes in FILES. Legacy image routes kept for old screenshots.
      const rest = (method, path, body, profile = "storage", prefer = "return=representation") =>
        new Promise((resolve) => {
          const r = http.request({ host: "127.0.0.1", port: 3001, path, method, headers: {
            authorization: "Bearer " + bearer, "content-type": "application/json",
            "accept-profile": profile, "content-profile": profile, prefer } }, (up) => {
            let d = ""; up.on("data", (c) => (d += c)); up.on("end", () => resolve({ status: up.statusCode, body: d }));
          });
          if (body) r.write(JSON.stringify(body));
          r.end();
        });
      const json = (code, obj) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
      const m = url.pathname.match(/^\/storage\/v1\/object\/(sign\/|file\/|public\/)?([^/]+)\/?(.*)$/);
      if (m && m[1] === "sign/" && m[2] !== "img") {
        const bucket = m[2], name = decodeURIComponent(m[3]);
        req.resume();
        rest("GET", `/objects?select=name&bucket_id=eq.${bucket}&name=eq.${encodeURIComponent(name)}`).then((r) => {
          const rows = r.status === 200 ? JSON.parse(r.body) : [];
          if (!rows.length) return json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
          json(200, { signedURL: `/object/file/${bucket}/${name}?token=local` });
        });
        return;
      }
      if (m && (m[1] === "file/" || m[1] === "public/")) {
        const f = `${FILES}/${m[2]}/${decodeURIComponent(m[3])}`;
        if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
        res.setHeader("content-type", fs.readFileSync(f + ".type", "utf8"));
        return fs.createReadStream(f).pipe(res);
      }
      if (m && !m[1] && req.method === "POST" && m[3]) {
        const bucket = m[2], name = decodeURIComponent(m[3]);
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          rest("POST", "/objects", { bucket_id: bucket, name, metadata: { size: Buffer.concat(chunks).length } }, "storage", "return=minimal").then((r) => {
            if (r.status >= 300) return json(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
            const f = `${FILES}/${bucket}/${name}`;
            fs.mkdirSync(f.slice(0, f.lastIndexOf("/")), { recursive: true });
            fs.writeFileSync(f, Buffer.concat(chunks));
            fs.writeFileSync(f + ".type", req.headers["content-type"] || "application/octet-stream");
            json(200, { Key: `${bucket}/${name}` });
          });
        });
        return;
      }
      if (m && !m[1] && req.method === "DELETE" && !m[3]) {
        const bucket = m[2];
        let body = "";
        req.on("data", (d) => (body += d));
        req.on("end", async () => {
          const out = [];
          for (const name of JSON.parse(body || "{}").prefixes ?? []) {
            const r = await rest("DELETE", `/objects?bucket_id=eq.${bucket}&name=eq.${encodeURIComponent(name)}`);
            if (r.status < 300 && JSON.parse(r.body).length) {
              fs.rmSync(`${FILES}/${bucket}/${name}`, { force: true });
              out.push({ name });
            }
          }
          json(200, out);
        });
        return;
      }
      if (url.pathname.startsWith("/storage/v1/object/sign/")) {
        let body = "";
        req.on("data", (d) => (body += d));
        req.on("end", () => {
          const paths = body ? JSON.parse(body).paths ?? [JSON.parse(body).path] : [];
          res.setHeader("content-type", "application/json");
          const out = paths.map((p, i) => ({ path: p, signedURL: `/object/img/${i}/${encodeURIComponent(p)}`, error: null }));
          res.end(JSON.stringify(body && JSON.parse(body).paths ? out : { signedURL: out[0]?.signedURL }));
        });
        return;
      }
      if (url.pathname.startsWith("/storage/v1/object/img/")) {
        const p = decodeURIComponent(url.pathname.split("/").pop());
        const n = [...p].reduce((a, ch) => a + ch.charCodeAt(0), 0) % images.length;
        res.setHeader("content-type", "image/jpeg");
        return fs.createReadStream(`${IMG_DIR}/${images[n]}`).pipe(res);
      }
      if (url.pathname.startsWith("/storage/v1/")) {
        req.resume();
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ Key: url.pathname }));
      }
      // PostgREST
      const target = url.pathname.replace(/^\/rest\/v1/, "") + url.search;
      const headers = { ...req.headers, host: "127.0.0.1:3001" };
      const up = http.request({ host: "127.0.0.1", port: 3001, path: target, method: req.method, headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      up.on("error", (e) => {
        res.statusCode = 502;
        res.end(String(e));
      });
      req.pipe(up);
    })
    .listen(54321, "127.0.0.1", () => console.log("local supabase on :54321")));
}
