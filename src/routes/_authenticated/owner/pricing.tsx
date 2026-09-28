import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Save, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { updateVenue } from "@/lib/api/owner-management.functions";
import { listOwnerVenues } from "@/lib/api/owner.functions";
import { getVenue } from "@/lib/api/venues.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EquipmentManager } from "@/components/owner/equipment-manager";
import { playersFor, deriveSlotPrice, deriveBasePrice, type Sport } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/owner/pricing")({
  head: () => ({ meta: [{ title: "Τιμές — Courtsie" }] }),
  component: PricingPage,
});

function PricingPage() {
  const { t } = useTranslation();
  const [venueId, setVenueId] = useState<string | null>(null);

  const venuesQ = useQuery({
    queryKey: ["owner-venues"],
    queryFn: () => listOwnerVenues(),
  });
  useEffect(() => {
    if (!venueId && venuesQ.data?.[0]) setVenueId(venuesQ.data[0].id);
  }, [venuesQ.data, venueId]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("pricing.title", "Τιμές")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pricing.subtitleSimple", "Τιμή γηπέδου και τιμές παροχών/εξοπλισμού.")}
          </p>
        </div>
        {venuesQ.data && venuesQ.data.length > 0 && (
          <select
            value={venueId ?? ""}
            onChange={(e) => setVenueId(e.target.value)}
            className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
          >
            {venuesQ.data.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </header>

      {venuesQ.isLoading && (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {t("pricing.loading", "Φόρτωση…")}
        </div>
      )}

      {venuesQ.data && venuesQ.data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {t("ownerVenues.empty")}
        </div>
      )}

      {venueId && <VenuePricingPanel venueId={venueId} />}
    </div>
  );
}

function VenuePricingPanel({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateVenue);

  const venueQ = useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => getVenue({ data: { id: venueId } }),
  });

  const sport: Sport = (venueQ.data as any)?.sport ?? "padel";
  const players = useMemo(() => playersFor(sport), [sport]);

  const [base, setBase] = useState<number>(0);
  const [slot, setSlot] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!venueQ.data || hydrated) return;
    const v: any = venueQ.data;
    setBase(Number(v.base_price_per_hour ?? 0));
    setSlot(Number(v.slot_price ?? 0));
    setHydrated(true);
  }, [venueQ.data, hydrated]);

  // Reset when switching venue
  useEffect(() => {
    setHydrated(false);
  }, [venueId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const v: any = venueQ.data;
      if (!v) throw new Error("loading");
      return updateFn({
        data: {
          venueId,
          name: v.name,
          area: v.area ?? null,
          address: v.address ?? null,
          basePricePerHour: base,
          slotPrice: slot,
          amenities: v.amenities ?? [],
          photoUrl: v.photo_url ?? null,
          lat: v.lat != null ? Number(v.lat) : null,
          lng: v.lng != null ? Number(v.lng) : null,
          placeId: v.place_id ?? null,
          formattedAddress: v.formatted_address ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["venue", venueId] });
      qc.invalidateQueries({ queryKey: ["owner-venues"] });
      qc.invalidateQueries({ queryKey: ["available-by-date"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("common.error")),
  });

  if (venueQ.isLoading || !venueQ.data) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        {t("pricing.loading", "Φόρτωση…")}
      </div>
    );
  }

  const dirty =
    base !== Number((venueQ.data as any).base_price_per_hour ?? 0) ||
    slot !== Number((venueQ.data as any).slot_price ?? 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {t("pricing.courtPrice", "Τιμή γηπέδου")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("pricing.courtPriceSub", "Άθλημα: {{sport}} · {{n}} άτομα ανά γήπεδο", {
                sport: t(`sports.${sport}`),
                n: players,
              })}
            </p>
          </div>
          <Link
            to="/owner/venues/$venueId"
            params={{ venueId }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t("pricing.editVenue", "Επεξεργασία γηπέδου")} <ArrowRight className="h-3 w-3" />
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              {t("ownerVenues.wholeCourtPrice")}
            </Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={base || ""}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setBase(v);
                setSlot(deriveSlotPrice(v, sport));
              }}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("ownerVenues.wholeCourtHint")}
            </p>
          </div>
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              {t("ownerVenues.slotPrice")}
            </Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={slot || ""}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setSlot(v);
                setBase(deriveBasePrice(v, sport));
              }}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {base > 0 && slot > 0
                ? t("ownerVenues.slotPriceAuto", { n: players })
                : t("ownerVenues.slotPriceManualSync", { n: players })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {t("pricing.preview", "Προεπισκόπηση: ολόκληρο γήπεδο €{{base}} / ώρα · ατομική θέση €{{slot}} / ώρα", {
              base: base.toFixed(base < 10 ? 1 : 0),
              slot: slot.toFixed(slot < 10 ? 1 : 0),
            })}
          </span>
          <Button
            size="sm"
            disabled={!dirty || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-1 h-4 w-4" />
            {saveMut.isPending ? t("common.saving", "Αποθήκευση…") : t("common.save", "Αποθήκευση")}
          </Button>
        </div>
      </div>

      <EquipmentManager venueId={venueId} />
    </div>
  );
}
