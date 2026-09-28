import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { MapPin, Star, LayoutGrid, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SPORTS, type Sport } from "../lib/sports";

import { listVenues } from "../lib/api/venues.functions";
import { amenityMeta } from "../lib/amenities";
import { useRedirectOwnersAway } from "../hooks/use-redirect-owners-away";
import padelImg from "../assets/sport-padel.jpg";
import tennisImg from "../assets/sport-tennis.jpg";
import basketballImg from "../assets/sport-basketball.jpg";
import footballImg from "../assets/sport-football.jpg";
import volleyballImg from "../assets/sport-volleyball.jpg";
import beachVolleyImg from "../assets/sport-beach-volley.jpg";

const FALLBACK_IMG: Record<Sport, string> = {
  padel: padelImg,
  tennis: tennisImg,
  basketball: basketballImg,
  football: footballImg,
  volleyball: volleyballImg,
  beach_volley: beachVolleyImg,
};

const searchSchema = z.object({
  sport: z.enum(["padel", "tennis", "basketball", "football", "volleyball", "beach_volley"]).optional(),
  q: z.string().optional(),
});

const venuesQuery = (sport?: Sport, q?: string) =>
  queryOptions({
    queryKey: ["venues", sport ?? "all", q ?? ""],
    queryFn: () => listVenues({ data: { sport, q } }),
  });

export const Route = createFileRoute("/venues/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ sport: search.sport, q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(venuesQuery(deps.sport, deps.q)),
  head: () => ({
    meta: [
      { title: "Γήπεδα — Courtsie" },
      { name: "description", content: "Όλα τα γήπεδα για padel, tennis, μπάσκετ και ποδόσφαιρο." },
    ],
  }),
  errorComponent: ErrorView,
  notFoundComponent: NotFoundView,
  component: VenuesPage,
});

function ErrorView({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-xl font-semibold">{t("venuesList.errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  );
}

function NotFoundView() {
  const { t } = useTranslation();
  return <div className="p-8">{t("venuesList.notFound")}</div>;
}

function VenuesPage() {
  useRedirectOwnersAway();
  const { t } = useTranslation();
  const { sport, q } = Route.useSearch();
  const { data: venues } = useSuspenseQuery(venuesQuery(sport, q));
  const qc = useQueryClient();
  const activeMeta = SPORTS.find((s) => s.id === sport);
  const sportLabel = activeMeta ? t(`sports.${activeMeta.id}`) : "";

  // Refresh list when any venue or its photos change
  useEffect(() => {
    const ch = supabase
      .channel("venues-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues" },
        () => qc.invalidateQueries({ queryKey: ["venues"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_photos" },
        () => qc.invalidateQueries({ queryKey: ["venues"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const heading = q
    ? t("venuesList.resultsFor", { q })
    : activeMeta
      ? t("venuesList.titleSport", { sport: sportLabel })
      : t("venuesList.title");

  const countText = venues.length === 1
    ? t("venuesList.countSingular", { count: venues.length })
    : t("venuesList.countPlural", { count: venues.length });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {countText}{activeMeta && !q ? t("venuesList.forSport", { sport: sportLabel.toLowerCase() }) : ""}.
        </p>
      </header>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <Link
          to="/venues"
          className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
            !sport ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
          }`}
        >
          {t("sports.all")}
        </Link>
        {SPORTS.map((s) => {
          const isActive = sport === s.id;
          return (
            <Link
              key={s.id}
              to="/venues"
              search={{ sport: s.id }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${
                isActive ? s.tokenClass : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`sports.${s.id}`)}
            </Link>
          );
        })}
      </div>

      {venues.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? t("venuesList.emptyQ", { q }) : t("venuesList.emptySport")}
          </p>
        </div>
      ) : (
        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      )}

      <div className="h-16" />
    </div>
  );
}

function VenueCard({ venue }: { venue: Awaited<ReturnType<typeof listVenues>>[number] }) {
  const { t } = useTranslation();
  const sportMeta = SPORTS.find((s) => s.id === venue.sport)!;
  const img = venue.photo_url || FALLBACK_IMG[venue.sport];
  const topAmenities = venue.amenities.slice(0, 4);

  return (
    <Link
      to="/venues/$venueId"
      params={{ venueId: venue.id }}
      className="group card-lift flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={img}
          alt={venue.name}
          loading="lazy"
          className="zoom-img h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.35) 100%)" }}
        />
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur ${sportMeta.tokenClass}`}>
          {t(`sports.${venue.sport}`)}
        </span>

        {venue.rating != null && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Star className="h-3 w-3 fill-primary text-primary" />
            {Number(venue.rating).toFixed(1)}
            <span className="font-normal text-white/70">({venue.reviews_count})</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold leading-tight">{venue.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {venue.area}
          <span className="mx-1.5">·</span>
          <LayoutGrid className="h-3 w-3" /> {venue.courts_count} {venue.courts_count === 1 ? t("common.court_one") : t("common.courts")}
        </p>

        {topAmenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topAmenities.map((a) => {
              const { icon: Icon, label } = amenityMeta(a);
              return (
                <span
                  key={a}
                  title={label}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <Icon className="h-3 w-3" /> {label}
                </span>
              );
            })}
            {venue.amenities.length > topAmenities.length && (
              <span className="inline-flex items-center rounded-md px-1.5 py-1 text-[11px] text-muted-foreground">
                +{venue.amenities.length - topAmenities.length}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          {(() => {
            const SLOT_ENABLED: Record<Sport, boolean> = {
              padel: true, tennis: true, basketball: false, football: false, volleyball: false, beach_volley: false,
            };
            const slot = SLOT_ENABLED[venue.sport];
            const price = slot
              ? Number(venue.slot_price ?? 0)
              : Number(venue.base_price_per_hour);
            if (!price || price <= 0) {
              return (
                <span className="text-xs font-medium text-muted-foreground">
                  {t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
                </span>
              );
            }
            return (
              <span className="font-display text-lg font-bold">
                €{price.toFixed(price < 10 ? 1 : 0)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {slot ? t("common.perPerson", "/ άτομο") : t("common.perHour")}
                </span>
              </span>
            );
          })()}
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-300 group-hover:gap-1.5 group-hover:shadow-glow">
            {t("common.viewVenue")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
