import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Twitter, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { CONTACT_EMAIL } from "@/lib/contact";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="relative mt-16 overflow-hidden bg-petrol text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-3rem] flex items-end justify-center select-none"
      >
        <span
          className="font-display font-bold leading-none tracking-tighter text-white/[0.07]"
          style={{ fontSize: "clamp(8rem, 22vw, 22rem)" }}
        >
          Courtsie
        </span>
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="white" className="h-10 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-white/75">{t("footer.tagline")}</p>
          </div>

          <FooterCol title={t("footer.platform")} links={[
            { to: "/venues", label: t("footer.venues") },
            { to: "/bookings", label: t("footer.bookings") },
            { to: "/open-games", label: t("footer.games") },
          ]} />

          <FooterCol title={t("footer.support")} links={[
            { to: "/help", label: t("footer.help") },
            { to: "/contact", label: t("footer.contact") },
          ]} />

          <FooterCol title={t("footer.legal")} links={[
            { to: "/terms", label: t("footer.terms") },
            { to: "/privacy", label: t("footer.privacy") },
          ]} />
        </div>

        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row">
          <p className="text-xs text-white/70">{t("footer.copyright")}</p>
          <div className="flex items-center gap-2">
            {[
              { Icon: Instagram, href: "#", label: "Instagram" },
              { Icon: Facebook, href: "#", label: "Facebook" },
              { Icon: Twitter, href: "#", label: "Twitter" },
              { Icon: Mail, href: `mailto:${CONTACT_EMAIL}`, label: "Email" },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-coral"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-optic">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm text-white/80">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="transition hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
