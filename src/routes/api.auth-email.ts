import { createFileRoute } from "@tanstack/react-router";

/**
 * Supabase Auth "Send Email Hook": Auth posts every email it would send (sign-in code, password reset …) here and we
 * send it through Brevo's API — Supabase's own SMTP relay to Brevo never delivered a single message. Requests are
 * signed (Standard Webhooks) with SEND_EMAIL_HOOK_SECRET ("v1,whsec_<base64>", the same value set in Supabase).
 */
export const Route = createFileRoute("/api/auth-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        if (!(await verified(request.headers, body))) return Response.json({ error: { http_code: 401, message: "bad signature" } }, { status: 401 });

        const { user, email_data: d } = JSON.parse(body) as {
          user: { email?: string; new_email?: string };
          email_data: { token?: string; token_hash?: string; token_new?: string; redirect_to?: string; email_action_type: string };
        };
        // Sign-up is by academic address only; the app checks it, but Auth itself would mail a code to anyone.
        if (d.email_action_type !== "recovery" && d.email_action_type !== "email_change" && !(await academic(user.email ?? ""))) {
          return Response.json({ error: { http_code: 422, message: "not_academic" } }, { status: 422 });
        }
        const sends: { to: string; code?: string }[] =
          d.email_action_type === "email_change"
            ? [
                ...(user.new_email && d.token_new ? [{ to: user.new_email, code: d.token_new }] : []),
                ...(user.email && d.token ? [{ to: user.email, code: d.token }] : []),
              ]
            : user.email
              ? [{ to: user.email, code: d.token }]
              : [];
        for (const s of sends) {
          if (!(await sendMail(s.to, d.email_action_type, s.code))) {
            return Response.json({ error: { http_code: 500, message: "mail_failed" } }, { status: 500 });
          }
        }
        return Response.json({});
      },
    },
  },
});

async function academic(email: string): Promise<boolean> {
  const parts = (email.split("@")[1] ?? "").toLowerCase().split(".");
  const suffixes = parts.map((_, i) => parts.slice(i).join(".")).filter((x) => x.includes(".")); // mail.ntua.gr, ntua.gr
  if (!suffixes.length) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("universities").select("id").overlaps("email_domains", suffixes).limit(1);
  return !!data?.length;
}

async function verified(h: Headers, body: string): Promise<boolean> {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET?.replace(/^v1,whsec_/, "");
  const id = h.get("webhook-id");
  const ts = h.get("webhook-timestamp");
  const sigs = h.get("webhook-signature");
  if (!secret || !id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(" ").some((s) => s.split(",")[1] === expected);
}

// A password reset gets a code too (typed in the app): a link had to survive Brevo's click tracking, open in the app
// rather than Safari and reach the browser that asked for it (PKCE) — it often didn't load.
async function sendMail(to: string, action: string, code: string | undefined): Promise<boolean> {
  const reset = action === "recovery";
  const subject = reset ? `Κωδικός για νέο κωδικό πρόσβασης στο Speak: ${code}` : `Ο κωδικός σου για το Speak: ${code}`;
  const lines = [
    reset ? `Για να ορίσεις νέο κωδικό πρόσβασης, γράψε στην εφαρμογή τον κωδικό ${code}. Ισχύει για 10 λεπτά.` : `Ο κωδικός σου είναι ${code}. Ισχύει για 10 λεπτά.`,
    reset ? `To set a new password, enter the code ${code} in the app. It is valid for 10 minutes.` : `Your Speak code is ${code}. It is valid for 10 minutes.`,
    "Αν δεν το ζήτησες εσύ, αγνόησε αυτό το email. / If you didn't ask for it, ignore this email.",
  ];
  const big = (s: string) => s.replace(code ?? "\0", `<b style="font-size:28px;letter-spacing:4px">${code}</b>`);
  const html = `<p>${big(lines[0])}</p><p style="color:#888">${lines[1]}</p>`;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Speak", email: process.env.MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: lines.join("\n\n"),
      htmlContent: `<div style="font:16px -apple-system,Segoe UI,sans-serif">${html}<p style="font-size:13px;color:#888">${lines[2]}</p></div>`,
    }),
  });
  return res.ok;
}
