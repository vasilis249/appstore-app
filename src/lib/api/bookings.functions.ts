import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Sport } from "@/lib/sports";

export const SPORT_SLOT_CONFIG: Record<
  Sport,
  { slotEnabled: boolean; maxPlayers: number; defaultMode: "slot" | "whole" }
> = {
  padel:        { slotEnabled: true,  maxPlayers: 4,  defaultMode: "slot" },
  tennis:       { slotEnabled: true,  maxPlayers: 4,  defaultMode: "slot" },
  basketball:   { slotEnabled: false, maxPlayers: 1,  defaultMode: "whole" },
  football:     { slotEnabled: false, maxPlayers: 1,  defaultMode: "whole" },
  volleyball:   { slotEnabled: false, maxPlayers: 12, defaultMode: "whole" },
  beach_volley: { slotEnabled: false, maxPlayers: 4,  defaultMode: "whole" },
};

// Legacy constants kept only for any remaining imports — slot times now come
// from court_slots.
export const DURATIONS = [1, 1.5, 2] as const;

// Sports whose slots are always created/locked in this fixed length
export const FIXED_DURATION: Partial<Record<Sport, number>> = {
  padel: 1.5,
};

export type DurationHours = (typeof DURATIONS)[number];

export type AvailabilitySlot = {
  court_id: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
};

export type CourtSlotState =
  | { kind: "free" }
  | { kind: "whole_booked" }
  | { kind: "open_game"; open_game_id: string; players_count: number; max_players: number };

export type CourtAvailability = {
  court_id: string;
  court_name: string;
  starts: {
    start_time: string;
    duration: number;
    state: CourtSlotState;
  }[];
};

export type AvailabilityResponse = {
  venue: {
    id: string;
    sport: Sport;
    courts_count: number;
    base_price_per_hour: number;
  };
  slots: AvailabilitySlot[];
  bookings: { court_id: string; start_time: string; duration_hours: number }[];
  closures: { court_id: string; start_time: string; end_time: string }[];
  slot_games: {
    id: string;
    booking_id: string | null;
    court_id: string | null;
    start_time: string;
    duration_hours: number;
    max_players: number;
    players_count: number;
  }[];
  slot_availability: {
    start_time: string; // HH:MM
    duration: number;   // hours
    free_courts: number;
  }[];
  court_availability: CourtAvailability[];
};


export const getVenueAvailability = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: venue, error: vErr } = await supabaseAdmin
      .from("venues")
      .select("id,sport,courts_count,base_price_per_hour")
      .eq("id", data.venueId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!venue) throw new Error("Το γήπεδο δεν βρέθηκε");

    const { data: courtsList } = await supabaseAdmin
      .from("courts")
      .select("id,name,sport")
      .eq("venue_id", data.venueId);
    const allCourts = (courtsList ?? []) as { id: string; name: string; sport: string }[];
    const courtIds = allCourts.map((c) => c.id);

    // Courts the RPC actually books over: same venue + same sport.
    const sportCourts = allCourts.filter((c) => c.sport === venue.sport);
    const sportCourtIds = sportCourts.map((c) => c.id);

    const weekday = new Date(`${data.date}T12:00:00`).getDay();

    const [bookingsRes, gamesRes, closuresRes, slotsRes] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("court_id,start_time,duration_hours,status")
        .eq("venue_id", data.venueId)
        .eq("date", data.date)
        .neq("status", "cancelled"),
      supabaseAdmin
        .from("open_games")
        .select("id,booking_id,start_time,max_players,bookings:booking_id(court_id,duration_hours),open_game_players(player_id)")
        .eq("venue_id", data.venueId)
        .eq("date", data.date),
      courtIds.length
        ? supabaseAdmin
            .from("court_closures")
            .select("court_id,start_time,end_time,date,weekday")
            .in("court_id", courtIds)
            .or(`date.eq.${data.date},weekday.eq.${weekday}`)
        : Promise.resolve({ data: [] as any[], error: null }),
      courtIds.length
        ? supabaseAdmin
            .from("court_slots")
            .select("court_id,start_time,end_time")
            .in("court_id", courtIds)
            .eq("day_of_week", weekday)
            .order("start_time")
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (bookingsRes.error) throw new Error(bookingsRes.error.message);
    if (gamesRes.error) throw new Error(gamesRes.error.message);
    if ((closuresRes as any).error) throw new Error((closuresRes as any).error.message);
    if ((slotsRes as any).error) throw new Error((slotsRes as any).error.message);

    const slot_games = (gamesRes.data ?? []).map((g: any) => ({
      id: g.id as string,
      booking_id: g.booking_id as string | null,
      court_id: (g.bookings?.court_id ?? null) as string | null,
      start_time: g.start_time as string,
      duration_hours: Number(g.bookings?.duration_hours ?? 1.5),
      max_players: Number(g.max_players),
      players_count: 1 + (g.open_game_players?.length ?? 0),
    }));

    const slotRows = ((slotsRes as any).data ?? []) as { court_id: string; start_time: string; end_time: string }[];
    const bookingRows = (bookingsRes.data ?? []) as { court_id: string; start_time: string; duration_hours: number }[];
    const closureRows = (((closuresRes as any).data ?? []) as { court_id: string; start_time: string; end_time: string }[]);

    const toMin = (t: string) => {
      const [h, m] = t.slice(0, 5).split(":").map(Number);
      return h * 60 + m;
    };
    const fixedDur = FIXED_DURATION[venue.sport as Sport];

    // Distinct start times across the venue's court_slots for the weekday.
    const distinctStarts = new Map<string, string>(); // start "HH:MM" -> earliest end "HH:MM" seen
    for (const s of slotRows) {
      const st = s.start_time.slice(0, 5);
      const et = s.end_time.slice(0, 5);
      const prev = distinctStarts.get(st);
      if (!prev || toMin(et) > toMin(prev)) distinctStarts.set(st, et);
    }

    const startsSorted = Array.from(distinctStarts.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const courtHasConflict = (cid: string, startM: number, endM: number) => {
      const bConflict = bookingRows.some((b) => {
        if (b.court_id !== cid) return false;
        const bs = toMin(b.start_time);
        const be = bs + Math.round(Number(b.duration_hours) * 60);
        return bs < endM && be > startM;
      });
      if (bConflict) return true;
      return closureRows.some((c) => {
        if (c.court_id !== cid) return false;
        const cs = toMin(c.start_time);
        const ce = toMin(c.end_time);
        return cs < endM && ce > startM;
      });
    };

    const slot_availability = startsSorted.map(([start, end]) => {
      const startM = toMin(start);
      const durHours = fixedDur != null ? fixedDur : (toMin(end) - startM) / 60;
      const endM = startM + Math.round(durHours * 60);
      let blocked = 0;
      for (const cid of sportCourtIds) {
        if (courtHasConflict(cid, startM, endM)) blocked++;
      }
      return {
        start_time: start,
        duration: durHours,
        free_courts: Math.max(sportCourtIds.length - blocked, 0),
      };
    });

    // Per-court state
    const court_availability: CourtAvailability[] = sportCourts.map((c) => {
      const starts = startsSorted.map(([start, end]) => {
        const startM = toMin(start);
        const durHours = fixedDur != null ? fixedDur : (toMin(end) - startM) / 60;
        const endM = startM + Math.round(durHours * 60);
        const game = slot_games.find(
          (g) => g.court_id === c.id && g.start_time.slice(0, 5) === start,
        );
        let state: CourtSlotState;
        if (game) {
          state = {
            kind: "open_game",
            open_game_id: game.id,
            players_count: game.players_count,
            max_players: game.max_players,
          };
        } else if (courtHasConflict(c.id, startM, endM)) {
          state = { kind: "whole_booked" };
        } else {
          state = { kind: "free" };
        }
        return { start_time: start, duration: durHours, state };
      });
      return { court_id: c.id, court_name: c.name, starts };
    });

    return {
      venue: {
        ...venue,
        base_price_per_hour: Number(venue.base_price_per_hour),
      },
      slots: slotRows.map((s) => ({
        court_id: s.court_id,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
      })) as AvailabilitySlot[],
      bookings: bookingRows.map((b) => ({
        court_id: b.court_id,
        start_time: b.start_time,
        duration_hours: Number(b.duration_hours),
      })),
      closures: closureRows.map((c) => ({
        court_id: c.court_id,
        start_time: c.start_time,
        end_time: c.end_time,
      })),
      slot_games,
      slot_availability,
      court_availability,
    } satisfies AvailabilityResponse;


  });

// Maps the SQL function's error codes into Greek messages the UI can show.
function mapBookingError(code: string): string {
  switch (code) {
    case "past_slot":
      return "Η ώρα έχει ήδη περάσει.";
    case "user_overlap":
      return "Έχεις ήδη κράτηση αυτή την ώρα.";
    case "slot_full":
      return "Η θέση είναι πλήρης.";
    case "already_joined":
      return "Είσαι ήδη σε αυτή τη θέση.";
    case "no_court":
      return "Δεν υπάρχει διαθέσιμο γήπεδο για αυτή την ώρα.";
    case "venue_not_found":
      return "Το γήπεδο δεν βρέθηκε.";
    case "unauthorized":
      return "Πρέπει να συνδεθείς πρώτα.";
    default:
      return "Η κράτηση δεν ολοκληρώθηκε.";
  }
}

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
      durationHours: z.number().min(0.5).max(6),
      mode: z.enum(["slot", "whole"]),
      equipmentIds: z.array(z.string().uuid()).max(20).optional(),
      courtId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    try {
      // Look up the sport to enforce fixed-duration sports server-side.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: venue, error: vErr } = await supabaseAdmin
        .from("venues")
        .select("sport,courts_count")
        .eq("id", data.venueId)
        .maybeSingle();
      if (vErr) throw new Error(vErr.message);
      if (!venue) throw new Error("Το γήπεδο δεν βρέθηκε");

      const sport = venue.sport as Sport;
      const cfg = SPORT_SLOT_CONFIG[sport];

      if (data.mode === "slot" && !cfg.slotEnabled) {
        return { ok: false as const, error: "Ατομική θέση δεν υποστηρίζεται για αυτό το άθλημα" };
      }

      // Ensure court rows exist for legacy venues so the SQL function can find one.
      let { data: existingCourts } = await supabaseAdmin
        .from("courts")
        .select("id")
        .eq("venue_id", data.venueId)
        .eq("sport", venue.sport);
      if (!existingCourts || existingCourts.length === 0) {
        const n = Math.max(1, Number(venue.courts_count) || 1);
        const rows = Array.from({ length: n }, (_, i) => ({
          venue_id: data.venueId,
          sport: venue.sport,
          name: `Γήπεδο ${i + 1}`,
        }));
        const { error: provErr } = await supabaseAdmin.from("courts").insert(rows);
        if (provErr) throw new Error(provErr.message);
        const refreshed = await supabaseAdmin
          .from("courts")
          .select("id")
          .eq("venue_id", data.venueId)
          .eq("sport", venue.sport);
        existingCourts = refreshed.data ?? [];
      }

      // Single source of truth: requested slot MUST exist in court_slots
      const weekday = new Date(`${data.date}T12:00:00`).getDay();
      const { data: matchingSlot } = await supabaseAdmin
        .from("court_slots")
        .select("court_id,end_time")
        .in("court_id", (existingCourts ?? []).map((c: any) => c.id))
        .eq("day_of_week", weekday)
        .eq("start_time", `${data.startTime}:00`)
        .limit(1)
        .maybeSingle();
      if (!matchingSlot) {
        return { ok: false as const, error: "Αυτή η ώρα δεν είναι διαθέσιμη" };
      }
      // Derive duration from the slot — overrides anything the client sent
      const [sh, sm] = data.startTime.split(":").map(Number);
      const [eh, em] = (matchingSlot.end_time as string).slice(0, 5).split(":").map(Number);
      const slotDuration = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      const effectiveDuration = FIXED_DURATION[sport] ?? slotDuration;

      const startTimeSql = `${data.startTime}:00`;

      // Validate optional courtId belongs to the venue + sport
      let chosenCourtId: string | null = null;
      if (data.courtId) {
        const { data: cRow } = await supabaseAdmin
          .from("courts")
          .select("id,sport,venue_id")
          .eq("id", data.courtId)
          .maybeSingle();
        if (!cRow || cRow.venue_id !== data.venueId || cRow.sport !== venue.sport) {
          return { ok: false as const, error: mapBookingError("no_court") };
        }
        chosenCourtId = cRow.id;
      }

      let bookingId = "";
      let joined = false;

      if (data.mode === "slot") {
        const { data: rpcData, error } = await supabase.rpc("create_slot_booking", {
          _venue: data.venueId,
          _date: data.date,
          _start: startTimeSql,
          _duration: effectiveDuration,
          _max_players: cfg.maxPlayers,
          _court_id: chosenCourtId,
        } as any);
        if (error) return { ok: false as const, error: error.message };
        const result = rpcData as { ok: boolean; error?: string; booking_id?: string; open_game_id?: string; joined?: boolean };
        if (!result?.ok) return { ok: false as const, error: mapBookingError(result?.error ?? "") };
        bookingId = result.booking_id ?? "";
        joined = !!result.joined;
      } else {
        const { data: rpcData, error } = await supabase.rpc("create_whole_booking", {
          _venue: data.venueId,
          _date: data.date,
          _start: startTimeSql,
          _duration: effectiveDuration,
          _court_id: chosenCourtId,
        } as any);
        if (error) return { ok: false as const, error: error.message };
        const result = rpcData as { ok: boolean; error?: string; booking_id?: string };
        if (!result?.ok) return { ok: false as const, error: mapBookingError(result?.error ?? "") };
        bookingId = result.booking_id ?? "";
      }

      // Attach equipment (owner-set prices, exact) — only if a real booking was created
      if (bookingId && !joined && data.equipmentIds && data.equipmentIds.length > 0) {
        const ids = Array.from(new Set(data.equipmentIds));
        const { data: equipRows } = await supabaseAdmin
          .from("venue_equipment")
          .select("id,name,price,active,venue_id")
          .in("id", ids)
          .eq("venue_id", data.venueId)
          .eq("active", true);
        const valid = equipRows ?? [];
        if (valid.length > 0) {
          const equipSum = valid.reduce((acc: number, r: any) => acc + Number(r.price), 0);
          await supabaseAdmin.from("booking_equipment").insert(
            valid.map((r: any) => ({
              booking_id: bookingId,
              equipment_id: r.id,
              name: r.name,
              price: Number(r.price),
            })),
          );
          // Add equipment cost on top of the slot/whole price (no division)
          const { data: bk } = await supabaseAdmin
            .from("bookings")
            .select("price")
            .eq("id", bookingId)
            .maybeSingle();
          const basePrice = Number(bk?.price ?? 0);
          await supabaseAdmin
            .from("bookings")
            .update({ price: basePrice + equipSum })
            .eq("id", bookingId);
        }
      }

      return { ok: true as const, bookingId, joined };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Η κράτηση δεν ολοκληρώθηκε",
      };
    }
  });
