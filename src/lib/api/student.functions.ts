import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Sends a 6-digit code to the student's academic address (e.g. @mail.ntua.gr). The database checks the address
 * belongs to an open university, isn't someone else's and isn't over the limits, and keeps only hashes; the
 * address itself is used here to send the mail and then forgotten.
 * Mail goes through Brevo (BREVO_API_KEY + MAIL_FROM_EMAIL, a sender verified in Brevo). For local tests only,
 * EMAIL_DEV_LOG=1 prints the code to the server log instead.
 */
export const sendStudentCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const raw = d as { email?: unknown; lang?: unknown };
    const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || email.length > 200) throw new Error("not_academic");
    return { email, lang: raw?.lang === "en" ? ("en" as const) : ("el" as const) };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.MAIL_FROM_EMAIL;
    const devLog = process.env.EMAIL_DEV_LOG === "1";
    if (!devLog && (!apiKey || !from)) throw new Error("mail_not_configured");

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("student_code_issue", { p_user: context.userId, p_email: data.email, p_code: code });
    if (error) throw new Error(error.message);

    if (devLog) {
      console.log(`[student-code] ${data.email} ${code}`);
      return { ok: true };
    }
    const el = data.lang === "el";
    const subject = el ? `Ο κωδικός σου για το Speak: ${code}` : `Your Speak code: ${code}`;
    const text = el
      ? `Ο κωδικός επιβεβαίωσης φοιτητή είναι ${code}. Ισχύει για 15 λεπτά.\n\nΑν δεν τον ζήτησες εσύ, αγνόησε αυτό το email.`
      : `Your student verification code is ${code}. It is valid for 15 minutes.\n\nIf you didn't ask for it, ignore this email.`;
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Speak", email: from },
        to: [{ email: data.email }],
        subject,
        textContent: text,
        htmlContent: `<p style="font:16px -apple-system,Segoe UI,sans-serif">${text.split("\n\n")[0].replace(code, `<b style="font-size:28px;letter-spacing:4px">${code}</b>`)}</p><p style="font:13px -apple-system,Segoe UI,sans-serif;color:#888">${text.split("\n\n")[1]}</p>`,
      }),
    });
    if (!res.ok) throw new Error("mail_failed");
    return { ok: true };
  });
