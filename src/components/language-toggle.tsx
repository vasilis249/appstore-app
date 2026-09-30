import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "el").startsWith("en") ? "en" : "el";
  const next = current === "el" ? "en" : "el";

  async function toggle() {
    await i18n.changeLanguage(next);
    try {
      localStorage.setItem("courtsie:lang", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("nav.language")}
      title={t("nav.language")}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-background/40 px-3 text-fine font-semibold uppercase tracking-wide text-foreground transition hover:bg-muted"
    >
      <Languages className="h-4 w-4" />
      <span>{current === "el" ? "EL" : "EN"}</span>
    </button>
  );
}
