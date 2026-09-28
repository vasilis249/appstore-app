import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MapPin, Zap, Calendar, CalendarDays, Users, Star, ArrowRight, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SPORTS, type Sport } from "../lib/sports";
import { useRedirectOwnersAway } from "../hooks/use-redirect-owners-away";
import padelImg from "../assets/sport-padel.jpg";
import tennisImg from "../assets/sport-tennis.jpg";
import basketballImg from "../assets/sport-basketball.jpg";
import footballImg from "../assets/sport-football.jpg";
import volleyballImg from "../assets/sport-volleyball.jpg";
import beachVolleyImg from "../assets/sport-beach-volley.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Courtsie — Κράτηση γηπέδων για padel, tennis, μπάσκετ & ποδόσφαιρο" },
      { name: "description", content: "Βρες και κλείσε γήπεδο σε δευτερόλεπτα. Padel, tennis, μπάσκετ και ποδόσφαιρο σε όλη την Ελλάδα." },
    ],
  }),
  component: Home,
});

type SportCardData = {
  id: Sport;
  image: string;
  accent: string; // CSS color var
};

const SPORT_CARDS: SportCardData[] = [
  { id: "padel",        image: padelImg,        accent: "var(--padel)" },
  { id: "tennis",       image: tennisImg,       accent: "var(--tennis)" },
  { id: "basketball",   image: basketballImg,   accent: "var(--basketball)" },
  { id: "football",     image: footballImg,     accent: "var(--football)" },
  { id: "volleyball",   image: volleyballImg,   accent: "var(--volleyball)" },
  { id: "beach_volley", image: beachVolleyImg,  accent: "var(--beach)" },
];


function Home() {
  useRedirectOwnersAway();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // Smooth-scroll to anchor section when navigated with hash (e.g. /#owner-cta)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  function submitSearch() {
    navigate({ to: "/venues", search: { q: q.trim() || undefined } });
  }
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface px-6 py-12 sm:px-10 sm:py-16">
        <div className="hero-blob-a pointer-events-none absolute -right-20 -top-24 h-[26rem] w-[26rem] rounded-full bg-coral/60 opacity-80 blur-3xl saturate-150" />
        <div className="hero-blob-b pointer-events-none absolute -right-10 top-10 h-56 w-56 rounded-full bg-coral/40 blur-2xl" />
        <div className="hero-blob-b pointer-events-none absolute -bottom-28 -left-24 h-[26rem] w-[26rem] rounded-full bg-optic/60 opacity-80 blur-3xl saturate-150" />
        <div className="hero-blob-a pointer-events-none absolute -bottom-10 left-20 h-56 w-56 rounded-full bg-petrol/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Zap className="h-3.5 w-3.5" /> {t("home.badge")}
          </span>
          <h1 className="animate-fade-in-up mt-5 text-4xl font-bold leading-tight sm:text-6xl" style={{ animationDelay: "70ms" }}>
            {t("home.title1")} <span className="text-primary">{t("home.title2")}</span> {t("home.title3")}
          </h1>
          <p className="animate-fade-in-up mt-4 text-base text-muted-foreground sm:text-lg" style={{ animationDelay: "140ms" }}>
            {t("home.subtitle")}
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
            className="animate-fade-in-up mt-6 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:flex-row"
            style={{ animationDelay: "210ms" }}
          >
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-background px-4 py-3 transition focus-within:ring-2 focus-within:ring-coral/30">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("home.searchPlaceholder")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:-translate-y-0.5 hover:opacity-95"
            >
              <Search className="h-4 w-4" /> {t("home.searchCta")}
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("home.chooseSport")}</h2>
          <Link to="/venues" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex sm:items-center sm:gap-1">
            {t("home.allVenues")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="reveal-on-scroll grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SPORT_CARDS.map((s) => (
            <SportCinematicCard key={s.id} sport={s} label={t(`sports.${s.id}`)} />
          ))}
        </div>
      </section>

      {/* Owner CTA section */}
      <section id="owner-cta" className="mt-12 scroll-mt-24 overflow-hidden rounded-3xl bg-petrol px-6 py-12 sm:px-10 sm:py-16">
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-optic/40 bg-optic/15 px-3 py-1 text-xs font-semibold text-optic">
            Courtsie for Business
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            {t("home.ownerCta.heading")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
            {t("home.ownerCta.subheading")}
          </p>

          <div className="stagger-children mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { icon: CalendarDays, title: t("home.ownerCta.benefit1Title"), desc: t("home.ownerCta.benefit1Desc") },
              { icon: Zap, title: t("home.ownerCta.benefit2Title"), desc: t("home.ownerCta.benefit2Desc") },
              { icon: TrendingUp, title: t("home.ownerCta.benefit3Title"), desc: t("home.ownerCta.benefit3Desc") },
              { icon: Users, title: t("home.ownerCta.benefit4Title"), desc: t("home.ownerCta.benefit4Desc") },
            ].map((b) => (
              <div
                key={b.title}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-optic/40 hover:bg-white/10"
              >
                <b.icon className="h-6 w-6 text-optic transition-transform duration-300 group-hover:scale-110" />
                <h3 className="mt-3 font-semibold text-white">{b.title}</h3>
                <p className="mt-1 text-sm text-white/65">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              to="/auth"
              search={{ mode: "signup", role: "owner" }}
              className="btn-shine inline-flex items-center gap-2 rounded-xl bg-coral px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:opacity-95"
            >
              {t("home.ownerCta.cta")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <section className="reveal-on-scroll mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Calendar, title: t("home.feature1Title"), desc: t("home.feature1Desc") },
          { icon: Users, title: t("home.feature2Title"), desc: t("home.feature2Desc") },
          { icon: Star, title: t("home.feature3Title"), desc: t("home.feature3Desc") },
        ].map((f) => (
          <div
            key={f.title}
            className="group card-lift rounded-2xl border border-border/60 bg-card p-5"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <div className="h-16" />
      {/* Keep SPORTS import used elsewhere */}
      <span className="hidden">{SPORTS.length}</span>
    </div>
  );
}

function SportCinematicCard({ sport, label }: { sport: SportCardData; label: string }) {
  return (
    <Link
      to="/venues"
      search={{ sport: sport.id }}
      aria-label={`${label}`}
      className={`sport-card is-${sport.id} group relative block aspect-[4/5] overflow-hidden rounded-3xl border border-border/60 sm:aspect-[5/4]`}
      style={{ ["--sport-accent" as string]: sport.accent }}
    >
      <div
        className="sc-img absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${sport.image})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.85) 100%)",
        }}
        aria-hidden
      />
      <div
        className="sc-ring pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          boxShadow:
            "inset 0 0 0 2px var(--sport-accent), 0 0 40px -4px var(--sport-accent), 0 0 80px -10px var(--sport-accent)",
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-6">
        <h3 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {label}
        </h3>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition group-hover:translate-x-1"
          style={{ border: "1px solid color-mix(in oklab, var(--sport-accent) 50%, transparent)" }}
          aria-hidden
        >
          <ArrowRight className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}
