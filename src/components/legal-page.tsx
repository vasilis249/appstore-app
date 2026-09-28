import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

export type LegalSection = { heading: string; body: string[] };

/**
 * Renders a legal document (Terms / Privacy) from structured i18n content.
 * Each section is a heading plus paragraphs; `{email}` in any paragraph is
 * replaced with the contact address.
 */
export function LegalPage({
  titleKey,
  updatedKey,
  introKey,
  sectionsKey,
  headingClassName = "text-petrol",
}: {
  titleKey: string;
  updatedKey: string;
  introKey: string;
  sectionsKey: string;
  headingClassName?: string;
}) {
  const { t } = useTranslation();
  const sections = t(sectionsKey, { returnObjects: true }) as LegalSection[];
  const withEmail = (s: string) => s.replaceAll("{email}", CONTACT_EMAIL);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.backHome", "Αρχική")}
      </Link>

      <header className="mt-6 mb-8">
        <h1 className={`font-display text-3xl font-bold ${headingClassName} sm:text-4xl`}>
          {t(titleKey)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t(updatedKey)}</p>
      </header>

      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-foreground/90">
          {withEmail(t(introKey))}
        </p>

        <div className="mt-6 space-y-7">
          {Array.isArray(sections) &&
            sections.map((sec, i) => (
              <section key={i}>
                <h2 className={`font-display text-lg font-semibold ${headingClassName}`}>
                  {i + 1}. {sec.heading}
                </h2>
                <div className="mt-2 space-y-2">
                  {sec.body.map((p, j) => (
                    <p
                      key={j}
                      className="text-sm leading-relaxed text-foreground/80"
                    >
                      {withEmail(p)}
                    </p>
                  ))}
                </div>
              </section>
            ))}
        </div>

        <p className="mt-8 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          {t("legal.contactLine", "Ερωτήσεις;")}{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
