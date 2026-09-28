import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { MapPin, Star, LayoutGrid, ArrowRight, Search, Map as MapIcon, List } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SPORTS, type Sport } from "../lib/sports";

import { listVenues } from "../lib/api/venues.functions";
import { amenityMeta } from "../lib/amenities";
import { useRedirectOwnersAway } from "../hooks/use-redirect-owners-away";
import { VenueFilterSheet } from "@/components/venues/venue-filters";
import {
  applyVenueFilters,
  countActiveFilters,
  displayPrice,
  isSlotPriced,
  type VenueFilters,
} from "@/lib/venue-filters";
import { VenuesMap } from "@/components/venues/venues-map";
import { PlayTabs } from "@/components/play-tabs";
import { distanceKm, formatKm, getCurrentPosition, type LatLng } from "@/lib/geo";
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
  sport: z
    .enum(["padel", "tennis", "basketball", "football", "volleyball", "beach_volley"])
    .optional(),
  q: z.string().optional(),
  view: z.enum(["list", "map"]).optional(),
  // Filter sheet (see components/venues/venue-filters.tsx)
  rating: z.number().int().min(1).max(5).optional(),
  pmin: z.number().optional(),
  pmax: z.number().optional(),
  km: z.number().optional(),
  am: z.string().optional(), // comma-separated amenity slugs
});

// All approved venues for the text query; sport and the other filters apply on the client
// so the filter sheet can count results for any combination.
const venuesQuery = (q?: string) =>
  queryOptions({
    queryKey: ["venues", "all", q ?? ""],
    queryFn: () => listVenues({ data: { q } }),
  });

export const Route = createFileRoute("/venues/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(venuesQuery(deps.q)),
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
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const { sport, q, view } = search;
  const navigate = useNavigate();
  const [query, setQuery] = useState(q ?? "");
  const { data: allVenues } = useSuspenseQuery(venuesQuery(q));
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";

  const filters: VenueFilters = {
    sport,
    minRating: search.rating,
    priceMin: search.pmin,
    priceMax: search.pmax,
    maxKm: search.km,
    amenities: search.am ? search.am.split(",").filter(Boolean) : undefined,
  };

  async function requestLocation(): Promise<boolean> {
    try {
      setMyPos(await getCurrentPosition());
      return true;
    } catch {
      toast.error(t("venueFilters.locationDenied"));
      return false;
    }
  }

  // A distance filter in the URL (e.g. after going back) needs the position again.
  useEffect(() => {
    if (search.km && !myPos) void requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.km]);

  const venues = useMemo(() => {
    const list = applyVenueFilters(allVenues, filters, myPos);
    if (!myPos) return list;
    const d = (v: VenueItem) =>
      v.lat != null && v.lng != null ? distanceKm(myPos, { lat: v.lat, lng: v.lng }) : Infinity;
    return search.km ? [...list].sort((a, b) => d(a) - d(b)) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVenues, myPos, sport, search.rating, search.pmin, search.pmax, search.km, search.am]);

  const distanceText = (v: VenueItem) =>
    myPos && v.lat != null && v.lng != null
      ? formatKm(distanceKm(myPos, { lat: v.lat, lng: v.lng }), locale)
      : null;

  function applyFilters(f: VenueFilters) {
    navigate({
      to: "/venues",
      search: {
        q,
        view,
        sport: f.sport,
        rating: f.minRating,
        pmin: f.priceMin,
        pmax: f.priceMax,
        km: f.maxKm,
        am: f.amenities?.length ? f.amenities.join(",") : undefined,
      },
    });
  }

  function selectFromMap(id: string) {
    setSelectedId(id);
    document
      .getElementById(`venue-row-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const qc = useQueryClient();
  const activeMeta = SPORTS.find((s) => s.id === sport);
  const sportLabel = activeMeta ? t(`sports.${activeMeta.id}`) : "";

  // Refresh list when any venue or its photos change
  useEffect(() => {
    const ch = supabase
      .channel("venues-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "venues" }, () =>
        qc.invalidateQueries({ queryKey: ["venues"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "venue_photos" }, () =>
        qc.invalidateQueries({ queryKey: ["venues"] }),
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


  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="sr-only">{heading}</h1>
      <PlayTabs />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/venues", search: { ...search, q: query.trim() || undefined } });
        }}
        className="mb-4 flex items-center gap-3"
      >
        <label className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm">
          <Search className="h-5 w-5 shrink-0 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            name="q"
            placeholder={t("nav.searchPlaceholder")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <VenueFilterSheet
          venues={allVenues}
          value={filters}
          onApply={applyFilters}
          myPos={myPos}
          onNeedLocation={requestLocation}
        />
        <Link
          to="/venues"
          search={{ ...search, view: view === "map" ? undefined : "map" }}
          aria-label={view === "map" ? t("venueMap.showList") : t("venueMap.showMap")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-card text-foreground shadow-sm ring-1 ring-border/60 transition hover:text-primary"
        >
          {view === "map" ? <List className="h-5 w-5" /> : <MapIcon className="h-5 w-5" />}
        </Link>
      </form>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link
          to="/venues"
          search={{ ...search, sport: undefined }}
          className={`whitespace-nowrap rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${
            !sport ? CHIP_ACTIVE : CHIP_IDLE
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
              search={{ ...search, sport: s.id }}
              className={`whitespace-nowrap rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${
                isActive ? CHIP_ACTIVE : CHIP_IDLE
              }`}
            >
              {t(`sports.${s.id}`)}
            </Link>
          );
        })}
      </div>

      {view === "map" && (
        <div className="mb-5 h-[52vh] min-h-72 sm:h-[60vh]">
          <VenuesMap
            venues={venues}
            myPos={myPos}
            selectedId={selectedId}
            onSelect={selectFromMap}
          />
        </div>
      )}

      {venues.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {countActiveFilters(filters) > 0
              ? t("venueFilters.empty")
              : q
                ? t("venuesList.emptyQ", { q })
                : t("venuesList.emptySport")}
          </p>
        </div>
      ) : (
        <>
          <div
            className={`stagger-children flex flex-col gap-3 ${view === "map" ? "sm:grid sm:grid-cols-2" : "sm:hidden"}`}
          >
            {venues.map((v) => (
              <VenueRow
                key={v.id}
                venue={v}
                distance={distanceText(v)}
                selected={view === "map" && selectedId === v.id}
              />
            ))}
          </div>
          {view !== "map" && (
            <div className="stagger-children hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((v) => (
                <VenueCard key={v.id} venue={v} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="h-16" />
    </div>
  );
}

type VenueItem = Awaited<ReturnType<typeof listVenues>>[number];

const CHIP_ACTIVE = "bg-primary text-primary-foreground shadow-glow";
const CHIP_IDLE = "bg-card text-foreground shadow-sm hover:text-primary";

function VenuePrice({ venue, compact = false }: { venue: VenueItem; compact?: boolean }) {
  const { t } = useTranslation();
  const slot = isSlotPriced(venue.sport);
  const price = displayPrice(venue);
  if (!price || price <= 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {t("common.priceNotSet", "Τιμή κατόπιν συνεννόησης")}
      </span>
    );
  }
  return (
    <span className={`font-display font-bold ${compact ? "text-sm text-primary" : "text-lg"}`}>
      €{price.toFixed(price < 10 ? 1 : 0)}
      <span className="ml-1 text-xs font-normal text-muted-foreground">
        {slot ? t("common.perPerson", "/ άτομο") : t("common.perHour")}
      </span>
    </span>
  );
}

/** Compact list row for phones: thumbnail left, name + rating, area, price. */
function VenueRow({
  venue,
  distance,
  selected = false,
}: {
  venue: VenueItem;
  distance?: string | null;
  selected?: boolean;
}) {
  const { t } = useTranslation();
  const img = venue.photo_url || FALLBACK_IMG[venue.sport];
  return (
    <Link
      id={`venue-row-${venue.id}`}
      to="/venues/$venueId"
      params={{ venueId: venue.id }}
      className={`flex scroll-mt-28 items-center gap-3 rounded-2xl bg-card p-3 shadow-sm transition active:scale-[0.99] ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <img src={img} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-base font-semibold leading-tight">
            {venue.name}
          </h3>
          {venue.rating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-optic text-optic" />
              {Number(venue.rating).toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {venue.area} · {t(`sports.${venue.sport}`)} · {venue.courts_count}{" "}
            {venue.courts_count === 1 ? t("common.court_one") : t("common.courts")}
          </span>
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <VenuePrice venue={venue} compact />
          {distance && (
            <span className="text-xs font-medium text-muted-foreground">{distance}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function VenueCard({ venue }: { venue: VenueItem }) {
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
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur ${sportMeta.tokenClass}`}
        >
          {t(`sports.${venue.sport}`)}
        </span>

        {venue.rating != null && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Star className="h-3 w-3 fill-optic text-optic" />
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
          <LayoutGrid className="h-3 w-3" /> {venue.courts_count}{" "}
          {venue.courts_count === 1 ? t("common.court_one") : t("common.courts")}
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
          <VenuePrice venue={venue} />
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-300 group-hover:gap-1.5 group-hover:shadow-glow">
            {t("common.viewVenue")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
