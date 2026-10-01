import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_E164 } from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const { t } = useTranslation();
  const items = [
    { href: `mailto:${CONTACT_EMAIL}`, icon: Mail, label: t("help.emailLabel"), value: CONTACT_EMAIL },
    { href: `tel:${CONTACT_PHONE_E164}`, icon: Phone, label: t("help.phoneLabel"), value: CONTACT_PHONE_DISPLAY },
  ];
  return (
    <div className="px-4 py-8">
      <h1 className="font-display text-display font-semibold">{t("help.title")}</h1>
      <ul className="mt-6 divide-y divide-border/70 rounded-2xl bg-card">
        {items.map(({ href, icon: Icon, label, value }) => (
          <li key={href}>
            <a href={href} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-link/10 text-link">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-fine text-muted-foreground">{label}</span>
                <span className="block break-all text-caption font-normal">{value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
