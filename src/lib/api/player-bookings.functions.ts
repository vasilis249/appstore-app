import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Sport } from "@/lib/sports";
import { SPORT_SLOT_CONFIG, FIXED_DURATION } from "@/lib/api/bookings.functions";

export type MyBookingRow = {
  id: string;
  venue_id: string;
  court_id: string;
  court_name: string | null;
  date: string;
  start_time: string;
  duration_hours: number;
  status: string;
  type: string;
  price: number;
  series_id: string | null;
  cancelled_at: string | null;
  venue: { id: string; name: string; area: string; sport: Sport } | null;
};

export type MyJoinedGameRow = {
  open_game_id: string;
  booking_id: string | null;
  venue_id: string;
  court_name: string | null;
  date: string;
  start_time: string;
  duration_hours: number;
  sport: Sport;
  level: "beginner" | "intermediate" | "advanced" | null;
  players_count: number;
  max_players: number;
  host_id: string;
  venue: { id: string; name: string; area: string; sport: Sport } | null;
};

export const listMyJoinedGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // "Today" in Europe/Athens
    const athensParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const getPart = (t: string) => athensParts.find((p) => p.type === t)!.value;
    const today = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

    const { data: memberships, error: mErr } = await supabaseAdmin
      .from("open_game_players")
      .select("open_game_id")
      .eq("player_id", userId);
    if (mErr) throw new Error(mErr.message);
    const gameIds = (memberships ?? []).map((m: any) => m.open_game_id as string);
    if (gameIds.length === 0) return [] as MyJoinedGameRow[];

    const { data: games, error: gErr } = await supabaseAdmin
      .from("open_games")
      .select("id,venue_id,sport,date,start_time,level,max_players,host_id,booking_id,venues:venue_id(id,name,area,sport),bookings:booking_id(status,duration_hours,court_id,courts:court_id(name))")
      .in("id", gameIds)
      .gte("date", today);
    if (gErr) throw new Error(gErr.message);

    const filtered = (games ?? []).filter((g: any) =>
      g.host_id !== userId && (!g.bookings || g.bookings.status !== "cancelled"),
    );
    if (filtered.length === 0) return [] as MyJoinedGameRow[];

    const { data: counts } = await supabaseAdmin
      .from("open_game_players")
      .select("open_game_id")
      .in("open_game_id", filtered.map((g: any) => g.id));
    const countMap = new Map<string, number>();
    for (const c of counts ?? []) {
      const k = (c as any).open_game_id as string;
      countMap.set(k, (countMap.get(k) ?? 0) + 1);
    }

    return filtered.map((g: any) => ({
      open_game_id: g.id,
      booking_id: g.booking_id ?? null,
      venue_id: g.venue_id,
      court_name: g.bookings?.courts?.name ?? null,
      date: g.date,
      start_time: (g.start_time as string).slice(0, 5),
      duration_hours: Number(g.bookings?.duration_hours ?? 1),
      sport: g.sport as Sport,
      level: g.level ?? null,
      players_count: (countMap.get(g.id) ?? 0) + 1, // +1 host
      max_players: g.max_players,
      host_id: g.host_id,
      venue: g.venues
        ? { id: g.venues.id, name: g.venues.name, area: g.venues.area, sport: g.venues.sport as Sport }
        : null,
    })) as MyJoinedGameRow[];
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,venue_id,court_id,date,start_time,duration_hours,status,type,price,series_id,cancelled_at,venues:venue_id(id,name,area,sport),courts:court_id(name)",
      )
      .eq("player_id", userId)
      .order("date", { ascending: false })
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((b: any) => ({
      id: b.id,
      venue_id: b.venue_id,
      court_id: b.court_id,
      court_name: b.courts?.name ?? null,
      date: b.date,
      start_time: (b.start_time as string).slice(0, 5),
      duration_hours: Number(b.duration_hours),
      status: b.status,
      type: b.type,
      price: Number(b.price),
      series_id: b.series_id,
      cancelled_at: b.cancelled_at ?? null,
      venue: b.venues
        ? {
            id: b.venues.id,
            name: b.venues.name,
            area: b.venues.area,
            sport: b.venues.sport as Sport,
          }
        : null,
    })) as MyBookingRow[];
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("player_id", userId);
    if (error) throw new Error(error.message);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: b } = await supabaseAdmin
        .from("bookings")
        .select("venue_id,date,start_time")
        .eq("id", data.id)
        .maybeSingle();
      if (b) {
        const { data: v } = await supabaseAdmin
          .from("venues")
          .select("owner_id,name")
          .eq("id", b.venue_id)
          .maybeSingle();
        if (v?.owner_id) {
          const d = new Date(b.date as string);
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const tm = String(b.start_time).slice(0, 5);
          await supabaseAdmin.from("notifications").insert({
            user_id: v.owner_id,
            type: "booking_cancelled",
            title: "Ακύρωση κράτησης",
            body: `Μια κράτηση στο ${v.name ?? "γήπεδο"}, ${dd}/${mm} ${tm} ακυρώθηκε.`,
            data: { booking_id: data.id, venue_id: b.venue_id },
          });
        }
      }
    } catch {
      // Ignore notification failures.
    }

    return { ok: true };
  });

export const cancelMySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ seriesId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const todayIso = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("series_id", data.seriesId)
      .eq("player_id", userId)
      .gte("date", todayIso)
      .neq("status", "cancelled");
    if (error) throw new Error(error.message);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: anyBooking } = await supabaseAdmin
        .from("bookings")
        .select("venue_id")
        .eq("series_id", data.seriesId)
        .eq("player_id", userId)
        .limit(1)
        .maybeSingle();
      if (anyBooking) {
        const { data: v } = await supabaseAdmin
          .from("venues")
          .select("owner_id,name")
          .eq("id", anyBooking.venue_id)
          .maybeSingle();
        if (v?.owner_id) {
          await supabaseAdmin.from("notifications").insert({
            user_id: v.owner_id,
            type: "booking_cancelled",
            title: "Ακύρωση σειράς κρατήσεων",
            body: `Μια επαναλαμβανόμενη σειρά κρατήσεων στο ${v.name ?? "γήπεδο"} ακυρώθηκε.`,
            data: { series_id: data.seriesId, venue_id: anyBooking.venue_id },
          });
        }
      }
    } catch {
      // Ignore notification failures.
    }

    return { ok: true };
  });

/**
 * Create a recurring weekly booking. Tries each week, skipping conflicts.
 * Returns per-week status so the UI can surface skipped dates.
 */
export const createRecurringBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      weeks: z.number().int().min(1).max(52),
      mode: z.enum(["slot", "whole"]),
      courtId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: venue, error: vErr } = await supabaseAdmin
      .from("venues")
      .select("id,sport,courts_count,base_price_per_hour")
      .eq("id", data.venueId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!venue) throw new Error("Το γήπεδο δεν βρέθηκε");

    const sport = venue.sport as Sport;
    const cfg = SPORT_SLOT_CONFIG[sport];
    if (data.mode === "slot" && !cfg.slotEnabled) {
      return { ok: false as const, error: "Ατομική θέση δεν υποστηρίζεται" };
    }

    let chosenCourtId: string | null = null;
    if (data.courtId) {
      const { data: court, error: cErr } = await supabaseAdmin
        .from("courts")
        .select("id,venue_id,sport")
        .eq("id", data.courtId)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!court || court.venue_id !== data.venueId || court.sport !== sport) {
        return { ok: false as const, error: "no_court" };
      }
      chosenCourtId = court.id;
    }

    // Ensure courts exist
    const { data: existingCourts } = await supabaseAdmin
      .from("courts")
      .select("id")
      .eq("venue_id", data.venueId)
      .eq("sport", sport);
    const courtIds = (existingCourts ?? []).map((c: any) => c.id as string);
    if (courtIds.length === 0) {
      return { ok: false as const, error: "Δεν υπάρχουν διαθέσιμα γήπεδα" };
    }

    // Find weekday + matching slot for the first occurrence
    const weekday = new Date(`${data.startDate}T12:00:00`).getDay();
    const { data: matchingSlot } = await supabaseAdmin
      .from("court_slots")
      .select("end_time")
      .in("court_id", chosenCourtId ? [chosenCourtId] : courtIds)
      .eq("day_of_week", weekday)
      .eq("start_time", `${data.startTime}:00`)
      .limit(1)
      .maybeSingle();
    if (!matchingSlot) {
      return { ok: false as const, error: "Αυτή η ώρα δεν είναι διαθέσιμη" };
    }
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = (matchingSlot.end_time as string).slice(0, 5).split(":").map(Number);
    const slotDuration = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    const effectiveDuration = FIXED_DURATION[sport] ?? slotDuration;

    // Generate one shared series_id (uuid) — we use crypto.randomUUID
    const seriesId = (globalThis.crypto as Crypto).randomUUID();

    const results: { date: string; ok: boolean; error?: string; bookingId?: string }[] = [];

    for (let i = 0; i < data.weeks; i++) {
      const d = new Date(`${data.startDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i * 7);
      const iso = d.toISOString().slice(0, 10);

      const rpcName = data.mode === "slot" ? "create_slot_booking" : "create_whole_booking";
      const rpcArgs: any = {
        _venue: data.venueId,
        _date: iso,
        _start: `${data.startTime}:00`,
        _duration: effectiveDuration,
      };
      if (data.mode === "slot") rpcArgs._max_players = cfg.maxPlayers;
      rpcArgs._court_id = chosenCourtId;

      const { data: rpcData, error } = await supabase.rpc(rpcName, rpcArgs);
      if (error) {
        results.push({ date: iso, ok: false, error: error.message });
        continue;
      }
      const r = rpcData as { ok: boolean; error?: string; booking_id?: string; joined?: boolean };
      if (!r?.ok) {
        results.push({ date: iso, ok: false, error: r?.error ?? "skipped" });
        continue;
      }
      // Tag with series_id
      if (r.booking_id && !r.joined) {
        await supabaseAdmin
          .from("bookings")
          .update({ series_id: seriesId })
          .eq("id", r.booking_id);
      }
      results.push({ date: iso, ok: true, bookingId: r.booking_id });
    }

    const createdCount = results.filter((r) => r.ok).length;
    return {
      ok: true as const,
      seriesId,
      created: createdCount,
      skipped: results.length - createdCount,
      results,
    };
  });
