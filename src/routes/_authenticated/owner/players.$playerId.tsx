import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Phone } from "lucide-react";

import {
  getOwnerPlayerProfile,
  type OwnerPlayerBooking,
} from "@/lib/api/owner-players.functions";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/players/$playerId")({
  head: () => ({ meta: [{ title: "Προφίλ παίκτη — Courtsie" }] }),
  component: OwnerPlayerProfilePage,
});

function OwnerPlayerProfilePage() {
  const { t, i18n } = useTranslation();
  const { playerId } = Route.useParams();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const profileFn = useServerFn(getOwnerPlayerProfile);

  const q = useQuery({
    queryKey: ["owner-player-profile", playerId],
    queryFn: () => profileFn({ data: { playerId } }),
  });

  if (q.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {(q.error as Error | undefined)?.message ?? t("common.error")}
        </p>
        <Link
          to="/owner"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </div>
    );
  }

  const p = q.data;
  const initial = (p.full_name ?? "?").charAt(0).toUpperCase();
  const rating = p.rating ? Number(p.rating) : 0;

  return (
    <div className="space-y-6">
      <Link
        to="/owner"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>

      <div className="rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {p.photo_url ? (
              <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate font-display text-2xl font-bold">
              {p.full_name || t("ownerPlayerProfile.unnamed")}
            </h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <StarRating value={rating} readOnly size={14} />
                {rating ? rating.toFixed(1) : "—"}
              </span>
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium">
                {p.level ? t(`levels.${p.level}`, p.level) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/*
          Privacy rule: the phone key exists on the payload ONLY while the
          player has an active (confirmed, future) booking at this owner's
          venues. When absent, nothing phone-related renders — no
          placeholder, no blurred value.
        */}
        {p.phone && (
          <a
            href={`tel:${p.phone}`}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold text-primary">{p.phone}</span>
              <span className="block text-xs text-muted-foreground">{t("ownerPlayerProfile.phone")}</span>
            </span>
          </a>
        )}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">
          {t("ownerPlayerProfile.historyTitle")}
        </h2>
        {p.bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t("ownerPlayerProfile.historyEmpty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {p.bookings.map((b) => (
              <BookingHistoryRow key={b.id} booking={b} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_TONE: Record<OwnerPlayerBooking["status"], string> = {
  confirmed: "border-primary/40 bg-primary/15 text-primary",
  completed: "border-border bg-muted text-muted-foreground",
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-500",
  cancelled: "border-destructive/40 bg-destructive/10 text-destructive",
};

function BookingHistoryRow({
  booking,
  locale,
}: {
  booking: OwnerPlayerBooking;
  locale: string;
}) {
  const { t } = useTranslation();
  const dateLabel = new Date(`${booking.date}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border/60 bg-card p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {booking.court_name}
          {booking.venue_name ? ` · ${booking.venue_name}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {dateLabel} · {booking.start_time.slice(0, 5)} · {booking.duration_hours}h
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium",
            STATUS_TONE[booking.status],
          )}
        >
          {t(`ownerPlayerProfile.status.${booking.status}`, booking.status)}
        </span>
        <span className="font-mono text-sm font-semibold">
          €{booking.price.toFixed(2)}
        </span>
      </div>
    </li>
  );
}
