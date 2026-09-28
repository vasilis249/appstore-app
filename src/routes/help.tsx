import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_E164,
  CONTACT_PHONE_DISPLAY,
} from "@/lib/contact";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

function HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <header className="mb-10 text-center sm:mb-12">
        <h1 className="font-display text-3xl font-bold text-petrol dark:text-optic sm:text-4xl">
          {t("help.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-petrol/80 dark:text-optic/80">
          {t("help.subtitle")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label={`${t("help.emailLabel")}: ${CONTACT_EMAIL}`}
          className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <Card className="flex h-full flex-col items-start gap-3 border-2 border-transparent bg-card p-6 transition hover:border-coral sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-petrol/10 text-petrol transition group-hover:bg-coral group-hover:text-white dark:bg-optic/10 dark:text-optic">
              <Mail className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wider text-petrol dark:text-optic">
                {t("help.emailLabel")}
              </p>
              <p className="mt-1 text-sm text-petrol/70 dark:text-optic/70">{t("help.emailHint")}</p>
              <p className="mt-2 break-all text-base font-medium text-petrol dark:text-optic">
                {CONTACT_EMAIL}
              </p>
            </div>
          </Card>
        </a>

        <a
          href={`tel:${CONTACT_PHONE_E164}`}
          aria-label={`${t("help.phoneLabel")}: ${CONTACT_PHONE_DISPLAY}`}
          className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <Card className="flex h-full flex-col items-start gap-3 border-2 border-transparent bg-card p-6 transition hover:border-coral sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-petrol/10 text-petrol transition group-hover:bg-coral group-hover:text-white dark:bg-optic/10 dark:text-optic">
              <Phone className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wider text-petrol dark:text-optic">
                {t("help.phoneLabel")}
              </p>
              <p className="mt-1 text-sm text-petrol/70 dark:text-optic/70">{t("help.phoneHint")}</p>
              <p className="mt-2 text-base font-medium text-petrol dark:text-optic">
                {CONTACT_PHONE_DISPLAY}
              </p>
            </div>
          </Card>
        </a>
      </div>
    </div>
  );
}
