import type { Sport } from "@/lib/sports";
import { distanceKm, type LatLng } from "@/lib/geo";
import type { VenueListItem } from "@/lib/api/venues.functions";

// Filtering for the venue list (filter sheet + map). Pure functions, shared by
// src/components/venues/venue-filters.tsx and src/routes/venues.index.tsx.

export type VenueFilters = {
  sport?: Sport;
  minRating?: number;
  priceMin?: number;
  priceMax?: number;
  maxKm?: number;
  amenities?: string[];
};

// Padel/tennis are sold per player slot; other sports per hour (same rule as the list cards).
const SLOT_SPORTS: ReadonlySet<Sport> = new Set<Sport>(["padel", "tennis"]);

/** The price shown on a venue card (per player for slot sports, per hour otherwise). */
export function displayPrice(
  v: Pick<VenueListItem, "sport" | "slot_price" | "base_price_per_hour">,
) {
  return SLOT_SPORTS.has(v.sport) ? Number(v.slot_price ?? 0) : Number(v.base_price_per_hour);
}

export function isSlotPriced(sport: Sport) {
  return SLOT_SPORTS.has(sport);
}

export function applyVenueFilters(
  venues: VenueListItem[],
  f: VenueFilters,
  myPos: LatLng | null,
): VenueListItem[] {
  return venues.filter((v) => {
    if (f.sport && v.sport !== f.sport) return false;
    if (f.minRating && (v.rating ?? 0) < f.minRating) return false;
    const price = displayPrice(v);
    if (f.priceMin != null && price > 0 && price < f.priceMin) return false;
    if (f.priceMax != null && price > 0 && price > f.priceMax) return false;
    if (f.amenities?.length && !f.amenities.every((a) => v.amenities.includes(a))) return false;
    if (f.maxKm && myPos) {
      if (v.lat == null || v.lng == null) return false;
      if (distanceKm(myPos, { lat: v.lat, lng: v.lng }) > f.maxKm) return false;
    }
    return true;
  });
}

/** Number of active filters, excluding sport (it has its own chips on the page). */
export function countActiveFilters(f: VenueFilters) {
  return (
    (f.minRating ? 1 : 0) +
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    (f.maxKm ? 1 : 0) +
    (f.amenities?.length ? 1 : 0)
  );
}
