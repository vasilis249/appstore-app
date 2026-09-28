import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Minus, Plus, SlidersHorizontal, Star } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { SPORTS } from "@/lib/sports";
import { AMENITIES } from "@/lib/amenities";
import type { LatLng } from "@/lib/geo";
import type { VenueListItem } from "@/lib/api/venues.functions";
import {
  applyVenueFilters,
  countActiveFilters,
  displayPrice,
  type VenueFilters,
} from "@/lib/venue-filters";

/** Distance steps for the −/+ stepper; undefined = any distance. */
const KM_STEPS = [1, 2, 5, 10, 20, 50] as const;

const CHIP = "rounded-[14px] px-3.5 py-2.5 text-sm font-medium transition";
const CHIP_ON = "bg-primary text-primary-foreground shadow-glow";
const CHIP_OFF = "bg-card text-foreground shadow-sm ring-1 ring-border/60";

export function VenueFilterSheet({
  venues,
  value,
  onApply,
  myPos,
  onNeedLocation,
}: {
  /** All venues for the current text query (before filters), used for counts and price bounds. */
  venues: VenueListItem[];
  value: VenueFilters;
  onApply: (f: VenueFilters) => void;
  myPos: LatLng | null;
  /** Asks for the device location; resolves false if it is unavailable or denied. */
  onNeedLocation: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VenueFilters>(value);

  const bounds = useMemo(() => {
    const prices = venues.map(displayPrice).filter((p) => p > 0);
    if (prices.length < 2) return null;
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return min < max ? { min, max } : null;
  }, [venues]);

  const resultCount = useMemo(
    () => applyVenueFilters(venues, draft, myPos).length,
    [venues, draft, myPos],
  );
  const active = countActiveFilters(value);

  async function stepKm(dir: 1 | -1) {
    const idx = draft.maxKm ? KM_STEPS.indexOf(draft.maxKm as (typeof KM_STEPS)[number]) : -1;
    const next = idx + dir;
    if (next < 0) return setDraft((d) => ({ ...d, maxKm: undefined }));
    if (next >= KM_STEPS.length) return;
    if (!myPos && !(await onNeedLocation())) return;
    setDraft((d) => ({ ...d, maxKm: KM_STEPS[next] }));
  }

  const priceValue: [number, number] | null = bounds
    ? [draft.priceMin ?? bounds.min, draft.priceMax ?? bounds.max]
    : null;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        // Start from the applied filters each time the sheet opens; later parent
        // re-renders (e.g. when the location arrives) must not reset the draft.
        if (o) setDraft(value);
        setOpen(o);
      }}
    >
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("venueFilters.open")}
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-glow transition hover:opacity-95"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {active > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background">
              {active}
            </span>
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <div className="safe-bottom overflow-y-auto px-5 pb-4">
          <div className="relative flex items-center justify-center py-4">
            <DrawerTitle className="font-display text-lg font-bold">
              {t("venueFilters.title")}
            </DrawerTitle>
            <button
              type="button"
              onClick={() => setDraft({})}
              className="absolute right-0 text-sm text-muted-foreground transition hover:text-primary"
            >
              {t("venueFilters.reset")}
            </button>
          </div>
          <DrawerDescription className="sr-only">{t("venueFilters.description")}</DrawerDescription>

          <Section title={t("venueFilters.categories")}>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((s) => {
                const on = draft.sport === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, sport: on ? undefined : s.id }))}
                    className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                  >
                    {t(`sports.${s.id}`)}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title={t("venueFilters.distance")}
            aside={
              <div className="flex items-center gap-3">
                <StepButton
                  label={t("venueFilters.less")}
                  onClick={() => stepKm(-1)}
                  disabled={!draft.maxKm}
                >
                  <Minus className="h-4 w-4" />
                </StepButton>
                <span className="min-w-14 text-center font-semibold text-primary">
                  {draft.maxKm ? `${draft.maxKm} km` : t("venueFilters.anyDistance")}
                </span>
                <StepButton
                  label={t("venueFilters.more")}
                  onClick={() => stepKm(1)}
                  disabled={draft.maxKm === KM_STEPS[KM_STEPS.length - 1]}
                >
                  <Plus className="h-4 w-4" />
                </StepButton>
              </div>
            }
          />

          <Section title={t("venueFilters.rating")} hint={t("venueFilters.ratingHint")}>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((r) => {
                const on = draft.minRating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((d) => ({ ...d, minRating: on ? undefined : r }))}
                    className={`${CHIP} inline-flex items-center justify-center gap-1 px-0 ${on ? CHIP_ON : CHIP_OFF}`}
                  >
                    {r}
                    <Star className="h-3.5 w-3.5 fill-optic text-optic" />
                  </button>
                );
              })}
            </div>
          </Section>

          {bounds && priceValue && (
            <Section
              title={t("venueFilters.price")}
              aside={
                <span className="font-semibold text-primary">
                  €{priceValue[0]}–€{priceValue[1]}
                </span>
              }
            >
              <SliderPrimitive.Root
                min={bounds.min}
                max={bounds.max}
                step={1}
                minStepsBetweenThumbs={1}
                value={priceValue}
                onValueChange={([lo, hi]) =>
                  setDraft((d) => ({
                    ...d,
                    priceMin: lo > bounds.min ? lo : undefined,
                    priceMax: hi < bounds.max ? hi : undefined,
                  }))
                }
                className="relative flex h-8 w-full touch-none select-none items-center"
              >
                <SliderPrimitive.Track className="relative h-1 grow rounded-full bg-muted">
                  <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
                </SliderPrimitive.Track>
                {[0, 1].map((i) => (
                  <SliderPrimitive.Thumb
                    key={i}
                    aria-label={i === 0 ? t("venueFilters.priceMin") : t("venueFilters.priceMax")}
                    className="block h-6 w-6 rounded-full bg-primary shadow-md ring-4 ring-background focus-visible:outline-none focus-visible:ring-primary/40"
                  />
                ))}
              </SliderPrimitive.Root>
              <p className="mt-1 text-xs text-muted-foreground">{t("venueFilters.priceHint")}</p>
            </Section>
          )}

          <Section title={t("venueFilters.amenities")}>
            <div className="flex flex-wrap gap-2">
              {Object.entries(AMENITIES).map(([slug, { label, icon: Icon }]) => {
                const on = draft.amenities?.includes(slug) ?? false;
                return (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setDraft((d) => {
                        const cur = new Set(d.amenities ?? []);
                        if (on) cur.delete(slug);
                        else cur.add(slug);
                        return { ...d, amenities: cur.size ? [...cur] : undefined };
                      })
                    }
                    className={`${CHIP} inline-flex items-center gap-1.5 py-2 ${on ? CHIP_ON : CHIP_OFF}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </div>
          </Section>

          <button
            type="button"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
          >
            {t("venueFilters.show", { count: resultCount })}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/70 py-5 first-of-type:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">
          {title}
          {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
        </h3>
        {aside}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-10 w-10 place-items-center rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border/60 transition disabled:opacity-40"
    >
      {children}
    </button>
  );
}
