import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Change #1 — Owner-facing player profile.
 *
 * Privacy contract: `phone` is present on the response ONLY when the player
 * currently has an ACTIVE booking (status = 'confirmed' AND starts in the
 * future, Europe/Athens) at a venue the caller owns. The condition is
 * enforced inside the `get_owner_player_profile` SECURITY DEFINER RPC — the
 * database returns NULL otherwise, and this layer strips the key entirely so
 * the field is absent (not blurred, not placeholdered) from the payload.
 *
 * Booking history is double-scoped to the caller's venues: RLS on
 * public.bookings already restricts owners to their own venues' rows, and we
 * additionally filter by an explicit list of owned venue ids so a future RLS
 * change can never widen this endpoint.
 */

export type OwnerPlayerBooking = {
  id: string;
  venue_id: string;
  venue_name: string;
  court_name: string;
  date: string;
  start_time: string;
  duration_hours: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  type: "online" | "phone" | "closed";
  price: number;
};

export type OwnerPlayerProfile = {
  player_id: string;
  full_name: string | null;
  photo_url: string | null;
  rating: number | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  has_active_booking: boolean;
  /** Present ONLY while the active-booking condition holds. */
  phone?: string;
  bookings: OwnerPlayerBooking[];
};

export const getOwnerPlayerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ playerId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<OwnerPlayerProfile> => {
    const { supabase, userId } = context;

    // 1) Profile + conditional phone via the SECURITY DEFINER RPC.
    //    Must run on the user-scoped client so auth.uid() is the caller.
    const { data: rows, error: rpcErr } = await supabase.rpc(
      "get_owner_player_profile",
      { _player_id: data.playerId },
    );
    if (rpcErr) throw new Error(rpcErr.message);
    const profile = rows?.[0];
    // Empty result = player unknown OR caller not authorized. One generic
    // message for both, so this endpoint is not an existence oracle.
    if (!profile) throw new Error("Ο παίκτης δεν βρέθηκε");

    // 2) The caller's venue ids (admins see all venues, matching listOwnerVenues).
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const venuesQ = supabase.from("venues").select("id,name");
    const { data: venues, error: vErr } = isAdmin
      ? await venuesQ
      : await venuesQ.eq("owner_id", userId);
    if (vErr) throw new Error(vErr.message);
    const venueIds = (venues ?? []).map((v: any) => v.id as string);
    const venueNameById = new Map(
      (venues ?? []).map((v: any) => [v.id as string, v.name as string]),
    );

    // 3) Booking history for THIS caller's venues only (RLS + explicit filter).
    let bookings: OwnerPlayerBooking[] = [];
    if (venueIds.length) {
      const { data: bk, error: bErr } = await supabase
        .from("bookings")
        .select("id,venue_id,court_id,date,start_time,duration_hours,status,type,price")
        .eq("player_id", data.playerId)
        .in("venue_id", venueIds)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(50);
      if (bErr) throw new Error(bErr.message);

      const courtIds = Array.from(
        new Set((bk ?? []).map((b: any) => b.court_id).filter(Boolean)),
      );
      let courtNameById = new Map<string, string>();
      if (courtIds.length) {
        const { data: courts } = await supabase
          .from("courts")
          .select("id,name")
          .in("id", courtIds);
        courtNameById = new Map(
          (courts ?? []).map((c: any) => [c.id as string, c.name as string]),
        );
      }

      bookings = (bk ?? []).map((b: any) => ({
        id: b.id,
        venue_id: b.venue_id,
        venue_name: venueNameById.get(b.venue_id) ?? "",
        court_name: courtNameById.get(b.court_id) ?? "",
        date: b.date,
        start_time: b.start_time,
        duration_hours: Number(b.duration_hours),
        status: b.status,
        type: b.type,
        price: Number(b.price),
      }));
    }

    return {
      player_id: profile.player_id,
      full_name: profile.full_name,
      photo_url: profile.photo_url,
      rating: profile.rating === null ? null : Number(profile.rating),
      level: profile.level as OwnerPlayerProfile["level"],
      has_active_booking: profile.has_active_booking,
      // Key is spread in only when the DB released it — otherwise absent.
      ...(profile.phone ? { phone: profile.phone } : {}),
      bookings,
    };
  });
