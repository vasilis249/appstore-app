import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Sport } from "@/lib/sports";

const sportSchema = z.enum([
  "padel",
  "tennis",
  "basketball",
  "football",
  "volleyball",
  "beach_volley",
]);

export type VenueListItem = {
  id: string;
  name: string;
  sport: Sport;
  area: string;
  base_price_per_hour: number;
  slot_price: number;
  rating: number | null;
  reviews_count: number;
  courts_count: number;
  amenities: string[];
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
};

export const listVenues = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({ sport: sportSchema.optional(), q: z.string().max(120).optional() })
      .optional()
      .default({}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("venues")
      .select("id,name,sport,area,base_price_per_hour,slot_price,rating,reviews_count,courts_count,amenities,photo_url,lat,lng")
      .eq("approved", true)
      .order("rating", { ascending: false, nullsFirst: false });
    if (data?.sport) q = q.eq("sport", data.sport);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let result = (rows ?? []) as VenueListItem[];

    if (data?.q && data.q.trim()) {
      const { normalize, matchSport } = await import("@/lib/normalize");
      const query = normalize(data.q);
      const tokens = query.split(" ").filter(Boolean);
      const sportFromQuery = tokens.map(matchSport).find(Boolean) ?? null;
      result = result.filter((v) => {
        const hay = `${normalize(v.name)} ${normalize(v.area)} ${normalize(v.sport)}`;
        if (sportFromQuery && v.sport !== sportFromQuery) {
          // If user typed a sport-only query, restrict by sport only.
          const nonSportTokens = tokens.filter((t) => !matchSport(t));
          if (nonSportTokens.length === 0) return false;
        }
        if (sportFromQuery && v.sport === sportFromQuery) {
          const nonSportTokens = tokens.filter((t) => !matchSport(t));
          if (nonSportTokens.length === 0) return true;
          return nonSportTokens.every((t) => hay.includes(t));
        }
        return tokens.every((t) => hay.includes(t));
      });
    }

    return result;
  });

export const getVenue = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Optional auth: extract caller identity from the Authorization header (if present).
    let callerId: string | null = null;
    let callerIsAdmin = false;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const authHeader = req?.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { data: claims } = await supabaseAdmin.auth.getClaims(token);
        if (claims?.claims?.sub) {
          callerId = claims.claims.sub as string;
          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId);
          callerIsAdmin = !!roles?.some((r: any) => r.role === "admin");
        }
      }
    } catch {
      // Anonymous caller — fall through.
    }

    const { data: venue, error } = await supabaseAdmin
      .from("venues")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!venue) return null;

    const isOwner = !!callerId && (venue as any).owner_id === callerId;
    const canSeeAll = callerIsAdmin || isOwner;

    // Unapproved venues are only visible to their owner or admins.
    if (!(venue as any).approved && !canSeeAll) return null;

    // Data minimization: expose only the fields the public UI needs. Internal /
    // moderation columns (owner_id, rejection_reason, timestamps, place_id) are
    // returned only to the owner or an admin.
    const v = venue as any;
    const PUBLIC_FIELDS = [
      "id", "name", "sport", "area", "address", "lat", "lng",
      "base_price_per_hour", "slot_price", "rating", "reviews_count",
      "courts_count", "amenities", "photo_url", "approved", "formatted_address",
    ] as const;
    let safeVenue: any;
    if (canSeeAll) {
      safeVenue = { ...v };
    } else {
      safeVenue = {};
      for (const k of PUBLIC_FIELDS) safeVenue[k] = v[k];
    }

    const [{ data: courts }, { data: photos }] = await Promise.all([
      supabaseAdmin
        .from("courts")
        .select("id,name,sport")
        .eq("venue_id", data.id)
        .order("name"),
      supabaseAdmin
        .from("venue_photos")
        .select("id,url,storage_path,sort_order")
        .eq("venue_id", data.id)
        .order("sort_order"),
    ]);
    return { ...safeVenue, courts: courts ?? [], photos: photos ?? [] };
  });

export type OpenGameWithPlayers = {
  id: string;
  venue_id: string;
  sport: Sport;
  date: string;
  start_time: string;
  level: "beginner" | "intermediate" | "advanced" | null;
  max_players: number;
  host_id: string;
  notes: string | null;
  players: {
    player_id: string;
    full_name: string | null;
    photo_url: string | null;
    rating: number | null;
    level: "beginner" | "intermediate" | "advanced" | null;
    is_host: boolean;
  }[];
};

export const listOpenGamesByVenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: gamesRaw, error } = await supabaseAdmin
      .from("open_games")
      .select("id,venue_id,sport,date,start_time,level,max_players,host_id,notes,booking_id,bookings:booking_id(status)")
      .eq("venue_id", data.venueId)
      .gte("date", today)
      .order("date")
      .order("start_time");
    if (error) throw new Error(error.message);
    // Ignore games whose underlying booking has been cancelled (ghosts).
    const games = (gamesRaw ?? []).filter(
      (g: any) => !g.bookings || g.bookings.status !== "cancelled",
    );
    if (!games || games.length === 0) return [] as OpenGameWithPlayers[];

    const gameIds = games.map((g) => g.id);
    const { data: joins } = await supabaseAdmin
      .from("open_game_players")
      .select("open_game_id,player_id")
      .in("open_game_id", gameIds);

    const allPlayerIds = Array.from(
      new Set([...(joins ?? []).map((j) => j.player_id), ...games.map((g) => g.host_id)]),
    );
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id,full_name,photo_url,rating,level")
      .in("user_id", allPlayerIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return games.map<OpenGameWithPlayers>((g) => {
      const playerIds = new Set<string>([g.host_id]);
      (joins ?? []).filter((j) => j.open_game_id === g.id).forEach((j) => playerIds.add(j.player_id));
      const players = Array.from(playerIds).map((id) => {
        const p = profileMap.get(id);
        return {
          player_id: id,
          full_name: p?.full_name ?? null,
          photo_url: p?.photo_url ?? null,
          rating: p?.rating ?? null,
          level: p?.level ?? null,
          is_host: id === g.host_id,
        };
      });
      return { ...g, players };
    });
  });

export const joinOpenGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ openGameId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rpcData, error } = await supabase.rpc("join_open_game", {
      _open_game_id: data.openGameId,
    });
    if (error) throw new Error(error.message);
    const r = rpcData as { ok: boolean; error?: string };
    if (!r.ok) {
      switch (r.error) {
        case "full":
          throw new Error("Το παιχνίδι είναι γεμάτο");
        case "already_joined":
          throw new Error("Είσαι ήδη σε αυτό το παιχνίδι");
        case "not_found":
          throw new Error("Το παιχνίδι δεν βρέθηκε");
        case "unauthorized":
          throw new Error("Πρέπει να συνδεθείς πρώτα");
        default:
          throw new Error(r.error ?? "Σφάλμα");
      }
    }
    return { ok: true };
  });


export const leaveOpenGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ openGameId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("open_game_players")
      .delete()
      .eq("open_game_id", data.openGameId)
      .eq("player_id", userId);
    if (error) throw new Error(error.message);

    // Notify host (best-effort)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: og } = await supabaseAdmin
        .from("open_games")
        .select("host_id,venue_id,date,start_time")
        .eq("id", data.openGameId)
        .maybeSingle();
      if (og && og.host_id !== userId) {
        const { data: v } = await supabaseAdmin
          .from("venues")
          .select("name")
          .eq("id", og.venue_id)
          .maybeSingle();
        const venueName = v?.name ?? "γήπεδο";
        const d = new Date(og.date as string);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const tm = String(og.start_time).slice(0, 5);
        await supabaseAdmin.from("notifications").insert({
          user_id: og.host_id,
          type: "open_game_leave",
          title: "Παίκτης αποχώρησε",
          body: `Ένας παίκτης αποχώρησε από το παιχνίδι σου στο ${venueName}, ${dd}/${mm} ${tm} — άνοιξε μια θέση.`,
          data: { open_game_id: data.openGameId, venue_id: og.venue_id },
        });
      }
    } catch {
      // Ignore notification failures — leaving must still succeed.
    }
    return { ok: true };
  });

/* -------------------- Available courts today (public) --------------- */

export type AvailableTodayVenue = {
  id: string;
  name: string;
  area: string;
  sport: Sport;
  base_price_per_hour: number;
  slot_price: number;
  photo_url: string | null;
  slots: string[]; // HH:MM
};

export const listAvailableTodayVenues = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .optional()
      .default({}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Compute "now" in Europe/Athens (server runs in UTC on Cloudflare Workers)
    const athensParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const getPart = (t: string) => athensParts.find((p) => p.type === t)!.value;
    const today = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const nowMinutes = Number(getPart("hour")) * 60 + Number(getPart("minute"));
    const targetDate = data?.date && data.date >= today ? data.date : today;
    const isToday = targetDate === today;
    // weekday in Athens for the target date (noon avoids DST edge)
    const weekday = new Date(`${targetDate}T12:00:00+02:00`).getDay();

    const { data: venues, error: vErr } = await supabaseAdmin
      .from("venues")
      .select("id,name,area,sport,base_price_per_hour,slot_price,photo_url")
      .eq("approved", true);
    if (vErr) throw new Error(vErr.message);
    if (!venues || venues.length === 0) return [] as AvailableTodayVenue[];

    const venueIds = venues.map((v: any) => v.id as string);
    const { data: courts } = await supabaseAdmin
      .from("courts")
      .select("id,venue_id")
      .in("venue_id", venueIds);
    const courtIds = (courts ?? []).map((c: any) => c.id as string);
    if (!courtIds.length) return [];

    const [slotsRes, bookingsRes, closuresRes] = await Promise.all([
      supabaseAdmin
        .from("court_slots")
        .select("court_id,start_time,end_time")
        .in("court_id", courtIds)
        .eq("day_of_week", weekday)
        .order("start_time"),
      supabaseAdmin
        .from("bookings")
        .select("venue_id,court_id,start_time,duration_hours")
        .eq("date", targetDate)
        .neq("status", "cancelled")
        .in("venue_id", venueIds),
      supabaseAdmin
        .from("court_closures")
        .select("court_id,start_time,end_time,date,weekday")
        .in("court_id", courtIds)
        .or(`date.eq.${targetDate},weekday.eq.${weekday}`),
    ]);

    const allSlots = (slotsRes.data ?? []) as any[];
    const allBookings = (bookingsRes.data ?? []) as any[];
    const allClosures = (closuresRes.data ?? []) as any[];

    // (nowMinutes computed above in Athens timezone)
    const toHr = (t: string) => {
      const [h, m] = t.split(":");
      return Number(h) + Number(m) / 60;
    };

    const result: AvailableTodayVenue[] = [];
    for (const v of venues as any[]) {
      const sport = v.sport as Sport;
      const vCourtIds = (courts ?? [])
        .filter((c: any) => c.venue_id === v.id)
        .map((c: any) => c.id as string);
      const venueSlots = allSlots.filter((s) => vCourtIds.includes(s.court_id));
      if (!venueSlots.length) continue;

      const vBookings = allBookings.filter((b) => b.venue_id === v.id);
      const vClosures = allClosures.filter((c) => vCourtIds.includes(c.court_id));

      const byStart = new Map<string, { court_id: string; end: string }[]>();
      for (const s of venueSlots) {
        const t = (s.start_time as string).slice(0, 5);
        const e = (s.end_time as string).slice(0, 5);
        const arr = byStart.get(t) ?? [];
        arr.push({ court_id: s.court_id, end: e });
        byStart.set(t, arr);
      }
      const availableTimes: string[] = [];
      for (const [time, courtList] of byStart) {
        if (isToday) {
          const [sh, sm] = time.split(":").map(Number);
          const slotMinutes = sh * 60 + sm;
          // Strictly after current Athens time (with 1-min grace)
          if (slotMinutes <= nowMinutes) continue;
        }
        const h = toHr(time);
        const endH = Math.max(...courtList.map((c) => toHr(c.end)));
        const eligible = new Set(courtList.map((c) => c.court_id));
        const blocked = new Set<string>();
        for (const b of vBookings) {
          if (!eligible.has(b.court_id)) continue;
          const s = toHr(b.start_time as string);
          if (s < endH && s + Number(b.duration_hours) > h) blocked.add(b.court_id);
        }
        for (const c of vClosures) {
          if (!eligible.has(c.court_id)) continue;
          const cs = toHr(c.start_time as string);
          const ce = toHr(c.end_time as string);
          if (cs < endH && ce > h) blocked.add(c.court_id);
        }
        if (eligible.size - blocked.size > 0) availableTimes.push(time);
      }

      if (availableTimes.length) {
        availableTimes.sort();
        result.push({
          id: v.id,
          name: v.name,
          area: v.area,
          sport,
          base_price_per_hour: Number(v.base_price_per_hour),
          slot_price: Number(v.slot_price ?? 0),
          photo_url: v.photo_url ?? null,
          slots: availableTimes,
        });
      }
    }
    return result;
  });
