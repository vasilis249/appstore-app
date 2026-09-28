/** Maps DM server/database errors to i18n keys. */
export function dmErrorKey(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("blocked")) return "dm.errors.blocked";
  if (msg.includes("rate_limited") || msg.includes("too_many")) return "dm.errors.rate";
  if (msg.includes("not_found")) return "dm.errors.notFound";
  return "dm.errors.generic";
}
