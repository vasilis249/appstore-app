// Popular mail domains in Greece, most likely first; an address one or two edits away from one of these
// is probably a typo (e.g. "ail.com" → "gmail.com"). Only a hint: the user can still sign up with what they typed.
const SUGGEST = [
  "gmail.com", "yahoo.gr", "yahoo.com", "hotmail.com", "hotmail.gr", "outlook.com", "outlook.com.gr",
  "icloud.com", "live.com", "otenet.gr",
];
// Real domains close to the ones above that must not be "corrected".
const KNOWN = new Set([
  ...SUGGEST, "googlemail.com", "me.com", "mac.com", "mail.com", "gmx.com", "gmx.de", "aol.com", "msn.com",
  "proton.me", "protonmail.com", "live.gr", "windowslive.com", "yahoo.co.uk",
]);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** The corrected address when the domain looks like a typo of a common one, else null. */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (domain.length < 3 || KNOWN.has(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const d of SUGGEST) {
    const dist = distance(domain, d);
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best ? `${local}@${best}` : null;
}
