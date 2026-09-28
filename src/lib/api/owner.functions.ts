import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BookingRow = {
  id: string;
  court_id: string;
  venue_id: string;
  date: string;
  start_time: string;
  duration_hours: number;
  type: "online" | "phone" | "closed";
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_name: string | null;
  customer_phone: string | null;
  player_id: string | null;
  player_name: string | null;
  player_photo_url: string | null;
  price: number;
  cancelled_at: string | null;
};

export type CourtRow = { id: string; name: string; sport: string };

export type OwnerVenue = {
  id: string;
  name: string;
  sport: string;
  area: string | null;
  base_price_per_hour: number;
  approved: boolean;
  rejection_reason: string | null;
};


async function assertOwnerOfVenue(
  supabase: any,
  userId: string,
  venueId: string,
) {
  const { data, error } = await supabase
    .from("venues")
    .select("id, owner_id, base_price_per_hour, slot_price, sport, name, area, approved, rejection_reason")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Το γήπεδο δεν βρέθηκε");
  if (data.owner_id !== userId) {
    // allow admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Δεν έχεις πρόσβαση σε αυτό το γήπεδο");
  }
  return data;
}

export const listOwnerVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const q = supabase
      .from("venues")
      .select("id,name,sport,area,base_price_per_hour,approved,rejection_reason")
      .order("name", { ascending: true });
    const { data, error } = isAdmin ? await q : await q.eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((v: any) => ({
      ...v,
      base_price_per_hour: Number(v.base_price_per_hour),
    })) as OwnerVenue[];
  });

export const getOwnerSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const venue = await assertOwnerOfVenue(supabase, userId, data.venueId);

    const [{ data: courts, error: cErr }, { data: bookings, error: bErr }] =
      await Promise.all([
        supabase
          .from("courts")
          .select("id,name,sport")
          .eq("venue_id", data.venueId)
          .order("name"),
        supabase
          .from("bookings")
          .select(
            "id,court_id,venue_id,date,start_time,duration_hours,type,status,customer_name,customer_phone,price,player_id,cancelled_at",
          )
          .eq("venue_id", data.venueId)
          .gte("date", data.dateFrom)
          .lte("date", data.dateTo),
      ]);
    if (cErr) throw new Error(cErr.message);
    if (bErr) throw new Error(bErr.message);

    const playerIds = Array.from(
      new Set((bookings ?? []).map((b: any) => b.player_id).filter(Boolean)),
    );
    let nameById = new Map<string, string>();
    let photoById = new Map<string, string | null>();
    if (playerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, photo_url")
        .in("user_id", playerIds);
      nameById = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p.full_name ?? ""]),
      );
      photoById = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p.photo_url ?? null]),
      );
    }

    const courtIds = (courts ?? []).map((c: any) => c.id as string);
    const { data: closures } = courtIds.length
      ? await supabase
          .from("court_closures")
          .select("id,court_id,date,weekday,start_time,end_time,reason")
          .in("court_id", courtIds)
      : { data: [] as any[] };
    const { data: slots } = courtIds.length
      ? await supabase
          .from("court_slots")
          .select("court_id,day_of_week,start_time,end_time")
          .in("court_id", courtIds)
          .order("start_time")
      : { data: [] as any[] };

    return {
      venue: {
        id: venue.id,
        name: venue.name,
        sport: venue.sport,
        area: venue.area,
        base_price_per_hour: Number(venue.base_price_per_hour),
        approved: !!(venue as any).approved,
        rejection_reason: (venue as any).rejection_reason ?? null,
      } as OwnerVenue,
      courts: (courts ?? []) as CourtRow[],
      bookings: (bookings ?? []).map((b: any) => ({
        id: b.id,
        court_id: b.court_id,
        venue_id: b.venue_id,
        date: b.date,
        start_time: b.start_time,
        duration_hours: Number(b.duration_hours),
        type: b.type,
        status: b.status,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        player_id: b.player_id ?? null,
        player_name: b.player_id ? nameById.get(b.player_id) ?? null : null,
        player_photo_url: b.player_id ? photoById.get(b.player_id) ?? null : null,
        price: Number(b.price),
        cancelled_at: b.cancelled_at ?? null,
      })) as BookingRow[],
      closures: (closures ?? []) as Array<{
        id: string;
        court_id: string;
        date: string | null;
        weekday: number | null;
        start_time: string;
        end_time: string;
        reason: string | null;
      }>,
      slots: (slots ?? []).map((s: any) => ({
        court_id: s.court_id as string,
        day_of_week: Number(s.day_of_week),
        start_time: (s.start_time as string).slice(0, 5),
        end_time: (s.end_time as string).slice(0, 5),
      })) as Array<{ court_id: string; day_of_week: number; start_time: string; end_time: string }>,
    };
  });


export const cancelBookingAsOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bookingId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Explicit authorization: confirm the caller owns the venue (or is admin)
    // before mutating. RLS also enforces this, but relying on RLS alone turns an
    // unauthorized attempt into a silent no-op that still returns ok:true.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bk, error: bkErr } = await supabaseAdmin
      .from("bookings")
      .select("venue_id")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bkErr) throw new Error(bkErr.message);
    if (!bk) throw new Error("Η κράτηση δεν βρέθηκε");
    await assertOwnerOfVenue(supabase, userId, bk.venue_id);

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);

    try {
      const { data: b } = await supabaseAdmin
        .from("bookings")
        .select("player_id,venue_id,date,start_time")
        .eq("id", data.bookingId)
        .maybeSingle();
      if (b?.player_id) {
        const { data: v } = await supabaseAdmin
          .from("venues")
          .select("name")
          .eq("id", b.venue_id)
          .maybeSingle();
        const d = new Date(b.date as string);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const tm = String(b.start_time).slice(0, 5);
        await supabaseAdmin.from("notifications").insert({
          user_id: b.player_id,
          type: "booking_cancelled",
          title: "Η κράτησή σου ακυρώθηκε",
          body: `Η κράτησή σου στο ${v?.name ?? "γήπεδο"}, ${dd}/${mm} ${tm} ακυρώθηκε από το γήπεδο.`,
          data: { booking_id: data.bookingId, venue_id: b.venue_id },
        });
      }
    } catch {
      // Ignore notification failures.
    }

    return { ok: true };
  });

export const createOwnerBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      courtId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      durationHours: z.number().min(0.5).max(6),
      type: z.enum(["phone", "closed"]),
      // For "phone" bookings: "whole" locks the slot, "slot" reserves one seat
      // and creates an open_games entry so online players can join.
      mode: z.enum(["whole", "slot"]).optional(),
      customerName: z.string().trim().max(120).optional(),
      customerPhone: z.string().trim().max(40).optional(),
      price: z.number().min(0).optional(),
      paymentMethod: z.enum(["cash"]).optional(),
      reason: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const venue = await assertOwnerOfVenue(supabase, userId, data.venueId);
    const mode = data.mode ?? "whole";

    // Phone bookings require customer name + phone
    if (data.type === "phone") {
      const name = (data.customerName ?? "").trim();
      const phone = (data.customerPhone ?? "").trim();
      if (name.length < 2) throw new Error("Το όνομα πελάτη είναι υποχρεωτικό");
      if (phone.length < 6) throw new Error("Το τηλέφωνο πελάτη είναι υποχρεωτικό");
    }

    const SLOT_MAX: Record<string, number> = {
      padel: 4, tennis: 4, basketball: 1, football: 1, volleyball: 12, beach_volley: 4,
    };
    const SLOT_ENABLED: Record<string, boolean> = {
      padel: true, tennis: true, basketball: false, football: false, volleyball: false, beach_volley: false,
    };
    const FIXED: Record<string, number> = { padel: 1.5 };

    // Single source of truth: ensure a matching slot exists on this weekday.
    // For "closed" bookings the owner can pick any time (overrides allowed).
    const { data: vCourtsList } = await supabase
      .from("courts")
      .select("id")
      .eq("venue_id", data.venueId);
    const allCourtIds = (vCourtsList ?? []).map((c: any) => c.id as string);
    const weekdayOfDate = new Date(`${data.date}T12:00:00`).getDay();
    let slotDurationHours: number | null = null;
    if (allCourtIds.length) {
      const { data: matched } = await supabase
        .from("court_slots")
        .select("end_time")
        .in("court_id", allCourtIds)
        .eq("day_of_week", weekdayOfDate)
        .eq("start_time", `${data.startTime}:00`)
        .limit(1)
        .maybeSingle();
      if (matched) {
        const [sh, sm] = data.startTime.split(":").map(Number);
        const [eh, em] = (matched.end_time as string).slice(0, 5).split(":").map(Number);
        slotDurationHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      } else if (data.type !== "closed") {
        throw new Error("Αυτή η ώρα δεν είναι διαθέσιμη");
      }
    }

    // Padel slots are always 1.5h. Otherwise prefer the matched slot duration.
    const durationHours = FIXED[venue.sport as string] ?? slotDurationHours ?? data.durationHours;

    if (mode === "slot" && data.type === "phone" && !SLOT_ENABLED[venue.sport as string]) {
      throw new Error("Η κράτηση μίας θέσης δεν υποστηρίζεται για αυτό το άθλημα");
    }

    // No past-time guard: owners may backfill phone bookings or close past
    // slots (e.g. logging a call that just ended). Online bookings have
    // their own past-time guard in create_whole_booking / create_slot_booking.

    const toHour = (t: string) => {
      const [h, m] = t.split(":");
      return Number(h) + Number(m) / 60;
    };
    const reqStart = toHour(data.startTime);
    const reqEnd = reqStart + durationHours;

    let effectiveCourtId = data.courtId;

    if (mode === "slot" && data.type === "phone") {
      // For slot phone bookings, auto-pick any free court of the same sport at
      // this venue — the originally-picked court may be busy while others free.
      const { data: courts, error: cErr } = await supabase
        .from("courts")
        .select("id,name")
        .eq("venue_id", data.venueId)
        .eq("sport", venue.sport)
        .order("name");
      if (cErr) throw new Error(cErr.message);
      const courtIds = (courts ?? []).map((c: any) => c.id as string);
      const { data: dayBookings, error: dbErr } = await supabase
        .from("bookings")
        .select("court_id,start_time,duration_hours,status")
        .in("court_id", courtIds)
        .eq("date", data.date)
        .neq("status", "cancelled");
      if (dbErr) throw new Error(dbErr.message);
      const weekday = new Date(`${data.date}T12:00:00`).getDay();
      const { data: closures } = await supabase
        .from("court_closures")
        .select("court_id,start_time,end_time,date,weekday")
        .in("court_id", courtIds)
        .or(`date.eq.${data.date},weekday.eq.${weekday}`);
      const busy = new Set<string>();
      for (const b of dayBookings ?? []) {
        const s = toHour(b.start_time as string);
        if (s < reqEnd && s + Number(b.duration_hours) > reqStart) {
          busy.add(b.court_id as string);
        }
      }
      for (const c of closures ?? []) {
        const cs = toHour(c.start_time as string);
        const ce = toHour(c.end_time as string);
        if (cs < reqEnd && ce > reqStart) busy.add(c.court_id as string);
      }
      const free = courtIds.find((id) => !busy.has(id));
      if (!free) throw new Error("Το γήπεδο είναι ήδη κατειλημμένο για αυτή την ώρα");
      effectiveCourtId = free;
    } else {
      const { data: existing, error: eErr } = await supabase
        .from("bookings")
        .select("id,start_time,duration_hours,status,type")
        .eq("court_id", data.courtId)
        .eq("date", data.date)
        .neq("status", "cancelled");
      if (eErr) throw new Error(eErr.message);
      const overlapping = (existing ?? []).filter((b: any) => {
        const s = toHour(b.start_time);
        return s < reqEnd && s + Number(b.duration_hours) > reqStart;
      });
      if (overlapping.length > 0) {
        throw new Error("Υπάρχει ήδη κράτηση σε αυτή την ώρα");
      }
      // Block on court closures
      const weekday = new Date(`${data.date}T12:00:00`).getDay();
      const { data: courtClosures } = await supabase
        .from("court_closures")
        .select("start_time,end_time,date,weekday")
        .eq("court_id", data.courtId)
        .or(`date.eq.${data.date},weekday.eq.${weekday}`);
      const closureOverlap = (courtClosures ?? []).find((c: any) => {
        const cs = toHour(c.start_time);
        const ce = toHour(c.end_time);
        return cs < reqEnd && ce > reqStart;
      });
      if (closureOverlap) throw new Error("Το γήπεδο είναι κλειστό αυτή την ώρα");
    }


    const isSlotPhone = mode === "slot" && data.type === "phone";
    const price =
      data.type === "closed"
        ? 0
        : data.price ??
          (isSlotPhone
            ? Number((venue as any).slot_price ?? 0)
            : Number(venue.base_price_per_hour) * durationHours);

    const { data: inserted, error: insErr } = await supabase
      .from("bookings")
      .insert({
        court_id: effectiveCourtId,
        venue_id: data.venueId,
        player_id: null,
        date: data.date,
        start_time: `${data.startTime}:00`,
        duration_hours: durationHours,
        type: data.type,
        status: "confirmed",
        customer_name:
          data.type === "phone"
            ? data.customerName ?? null
            : data.reason ?? null,
        customer_phone:
          data.type === "phone" ? data.customerPhone ?? null : null,
        payment_method:
          data.type === "phone" ? data.paymentMethod ?? "cash" : null,
        price,
      })
      .select("id")
      .single();
    if (insErr) {
      if ((insErr as any).code === "23P01") {
        throw new Error("Το γήπεδο είναι ήδη κατειλημμένο για αυτή την ώρα");
      }
      throw new Error(insErr.message);
    }

    if (mode === "slot" && data.type === "phone") {
      const maxPlayers = SLOT_MAX[venue.sport as string] ?? 4;
      const { error: ogErr } = await supabase.from("open_games").insert({
        venue_id: data.venueId,
        sport: venue.sport,
        date: data.date,
        start_time: `${data.startTime}:00`,
        max_players: maxPlayers,
        host_id: userId,
        booking_id: inserted.id,
      });
      if (ogErr) {
        await supabase.from("bookings").delete().eq("id", inserted.id);
        throw new Error(ogErr.message);
      }
    }

    return { ok: true, bookingId: inserted.id as string };
  });

