import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { differenceInCalendarDays, differenceInCalendarMonths, eachDayOfInterval, eachMonthOfInterval, endOfMonth, format, isAfter, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ----------------------------- Helpers ------------------------------ */

async function assertVenueOwner(
  supabase: any,
  userId: string,
  venueId: string,
) {
  const { data, error } = await supabase
    .from("venues")
    .select("id, owner_id")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Το γήπεδο δεν βρέθηκε");
  if (data.owner_id !== userId) {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Δεν έχεις πρόσβαση σε αυτό το γήπεδο");
  }
}

async function assertCourtOwner(supabase: any, userId: string, courtId: string) {
  const { data, error } = await supabase
    .from("courts")
    .select("venue_id")
    .eq("id", courtId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Το γήπεδο δεν βρέθηκε");
  await assertVenueOwner(supabase, userId, data.venue_id);
}

/* --------------------------- Pricing zones -------------------------- */

export type PricingZone = {
  id: string;
  court_id: string;
  label: string;
  start_hour: number;
  end_hour: number;
  price_per_hour: number;
  days_mask: number;
};

export const listPricingZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: venue } = await supabase
      .from("venues")
      .select("base_price_per_hour")
      .eq("id", data.venueId)
      .maybeSingle();
    const { data: courts } = await supabase
      .from("courts")
      .select("id,name,sport")
      .eq("venue_id", data.venueId)
      .order("name");
    const courtIds = (courts ?? []).map((c: any) => c.id);
    const { data: zones, error } = courtIds.length
      ? await supabase
          .from("court_pricing")
          .select("id,court_id,label,start_hour,end_hour,price_per_hour,days_mask")
          .in("court_id", courtIds)
          .order("start_hour")
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    return {
      basePricePerHour: Number(venue?.base_price_per_hour ?? 0),
      courts: (courts ?? []) as { id: string; name: string; sport: string }[],
      zones: (zones ?? []).map((z: any) => ({
        ...z,
        price_per_hour: Number(z.price_per_hour),
      })) as PricingZone[],
    };
  });

export const savePricingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      courtId: z.string().uuid(),
      label: z.string().trim().min(1).max(40),
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24),
      pricePerHour: z.number().min(0).max(10000),
      daysMask: z.number().int().min(1).max(127),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCourtOwner(supabase, userId, data.courtId);
    if (data.endHour <= data.startHour)
      throw new Error("Η ώρα τέλους πρέπει να είναι μετά την ώρα έναρξης");

    const payload = {
      court_id: data.courtId,
      label: data.label,
      start_hour: data.startHour,
      end_hour: data.endHour,
      price_per_hour: data.pricePerHour,
      days_mask: data.daysMask,
    };

    if (data.id) {
      const { error } = await supabase
        .from("court_pricing")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("court_pricing").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePricingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("court_pricing")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Court slots (weekly schedule) ------------ */

export type CourtSlot = {
  id: string;
  court_id: string;
  day_of_week: number;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
};

export const listCourtSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: courts } = await supabase
      .from("courts")
      .select("id,name,sport")
      .eq("venue_id", data.venueId)
      .order("name");
    const courtIds = (courts ?? []).map((c: any) => c.id as string);
    const { data: slots, error } = courtIds.length
      ? await supabase
          .from("court_slots")
          .select("id,court_id,day_of_week,start_time,end_time")
          .in("court_id", courtIds)
          .order("day_of_week")
          .order("start_time")
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    return {
      courts: (courts ?? []) as { id: string; name: string; sport: string }[],
      slots: (slots ?? []).map((s: any) => ({
        id: s.id as string,
        court_id: s.court_id as string,
        day_of_week: Number(s.day_of_week),
        start_time: (s.start_time as string).slice(0, 5),
        end_time: (s.end_time as string).slice(0, 5),
      })) as CourtSlot[],
    };
  });

export const addCourtSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      courtId: z.string().uuid(),
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }).refine((d) => d.endTime > d.startTime, {
      message: "Η ώρα τέλους πρέπει να είναι μετά την έναρξη",
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCourtOwner(supabase, userId, data.courtId);
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const newStart = toMinutes(data.startTime);
    const newEnd = toMinutes(data.endTime);
    const { data: existingSlots, error: exErr } = await supabase
      .from("court_slots")
      .select("start_time,end_time")
      .eq("court_id", data.courtId)
      .eq("day_of_week", data.dayOfWeek);
    if (exErr) throw new Error(exErr.message);
    const overlaps = (existingSlots ?? []).some((s: any) => {
      const es = toMinutes((s.start_time as string).slice(0, 5));
      const ee = toMinutes((s.end_time as string).slice(0, 5));
      return newStart < ee && newEnd > es;
    });
    if (overlaps) throw new Error("Αυτό το slot επικαλύπτεται με υπάρχον slot");
    const { error } = await supabase.from("court_slots").insert({
      court_id: data.courtId,
      day_of_week: data.dayOfWeek,
      start_time: `${data.startTime}:00`,
      end_time: `${data.endTime}:00`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourtSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: rErr } = await supabase
      .from("court_slots")
      .select("court_id")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    await assertCourtOwner(supabase, userId, row.court_id);
    const { error } = await supabase.from("court_slots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkGenerateCourtSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      courtId: z.string().uuid(),
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotMinutes: z.number().int().min(15).max(240),
      replace: z.boolean().default(false),
    }).refine((d) => d.closeTime > d.openTime, {
      message: "Η ώρα τέλους πρέπει να είναι μετά την έναρξη",
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCourtOwner(supabase, userId, data.courtId);
    const toMin = (t: string) => {
      const [h, m] = t.split(":");
      return Number(h) * 60 + Number(m);
    };
    const fromMin = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const start = toMin(data.openTime);
    const end = toMin(data.closeTime);
    const rows: { court_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
    for (let cur = start; cur + data.slotMinutes <= end; cur += data.slotMinutes) {
      rows.push({
        court_id: data.courtId,
        day_of_week: data.dayOfWeek,
        start_time: `${fromMin(cur)}:00`,
        end_time: `${fromMin(cur + data.slotMinutes)}:00`,
      });
    }
    if (data.replace) {
      await supabase
        .from("court_slots")
        .delete()
        .eq("court_id", data.courtId)
        .eq("day_of_week", data.dayOfWeek);
    }
    if (rows.length) {
      const { error } = await supabase
        .from("court_slots")
        .upsert(rows, { onConflict: "court_id,day_of_week,start_time" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: rows.length };
  });

/* ----------------------------- Venue edit --------------------------- */

export type VenueEditPayload = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  base_price_per_hour: number;
  amenities: string[];
  photo_url: string | null;
};

export const getOwnerVenueDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: v, error } = await supabase
      .from("venues")
      .select(
        "id,name,sport,area,address,base_price_per_hour,slot_price,amenities,photo_url,lat,lng,place_id,formatted_address,approved,rejection_reason,courts_count",
      )
      .eq("id", data.venueId)
      .single();
    if (error) throw new Error(error.message);
    const { count: courtsActual } = await supabase
      .from("courts")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", data.venueId);
    return {
      ...v,
      base_price_per_hour: Number(v.base_price_per_hour),
      slot_price: Number((v as any).slot_price ?? 0),
      amenities: (v.amenities ?? []) as string[],
      courts_count: courtsActual ?? v.courts_count ?? 1,
    };
  });


export const updateVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      area: z.string().trim().max(120).nullable(),
      address: z.string().trim().max(240).nullable(),
      basePricePerHour: z.number().min(0).max(10000),
      slotPrice: z.number().min(0).max(10000).optional(),
      amenities: z.array(z.string().max(40)).max(40),
      photoUrl: z.string().url().max(800).nullable(),
      lat: z.number().min(-90).max(90).nullable().optional(),
      lng: z.number().min(-180).max(180).nullable().optional(),
      placeId: z.string().max(240).nullable().optional(),
      formattedAddress: z.string().max(400).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const patch: any = {
      name: data.name,
      area: data.area ?? "",
      address: data.address ?? undefined,
      base_price_per_hour: data.basePricePerHour,
      amenities: data.amenities,
      photo_url: data.photoUrl ?? undefined,
    };
    if (data.slotPrice !== undefined) patch.slot_price = data.slotPrice;
    if (data.lat !== undefined) patch.lat = data.lat;
    if (data.lng !== undefined) patch.lng = data.lng;
    if (data.placeId !== undefined) patch.place_id = data.placeId;
    if (data.formattedAddress !== undefined) patch.formatted_address = data.formattedAddress;
    const { error } = await supabase
      .from("venues")
      .update(patch)
      .eq("id", data.venueId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Photos ------------------------------ */

export type VenuePhoto = {
  id: string;
  storage_path: string;
  url: string;
  sort_order: number;
};

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

export const listVenuePhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: rows, error } = await supabase
      .from("venue_photos")
      .select("id,storage_path,url,sort_order")
      .eq("venue_id", data.venueId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []) as VenuePhoto[];
  });

export const registerVenuePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("venue-photos")
      .createSignedUrl(data.storagePath, PHOTO_URL_TTL_SECONDS);
    if (sErr) throw new Error(sErr.message);
    const { data: row, error } = await supabase
      .from("venue_photos")
      .insert({
        venue_id: data.venueId,
        storage_path: data.storagePath,
        url: signed!.signedUrl,
        sort_order: Math.floor(Date.now() / 1000),
      })
      .select("id,storage_path,url,sort_order")
      .single();
    if (error) throw new Error(error.message);

    // Auto-set as cover if the venue has no cover yet
    const { data: v } = await supabase
      .from("venues")
      .select("photo_url")
      .eq("id", data.venueId)
      .maybeSingle();
    if (!v?.photo_url) {
      await supabase
        .from("venues")
        .update({ photo_url: signed!.signedUrl })
        .eq("id", data.venueId);
    }
    return row as VenuePhoto;
  });


export const setVenueCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      photoUrl: z.string().url().max(800).nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { error } = await supabase
      .from("venues")
      .update({ photo_url: data.photoUrl })
      .eq("id", data.venueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVenuePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ photoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: photo, error: pErr } = await supabase
      .from("venue_photos")
      .select("id,venue_id,storage_path,url")
      .eq("id", data.photoId)
      .single();
    if (pErr) throw new Error(pErr.message);
    await assertVenueOwner(supabase, userId, photo.venue_id);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.storage.from("venue-photos").remove([photo.storage_path]);
    const { error } = await supabase
      .from("venue_photos")
      .delete()
      .eq("id", data.photoId);
    if (error) throw new Error(error.message);

    // If the deleted photo was the cover, pick a new one (or clear it)
    const { data: v } = await supabase
      .from("venues")
      .select("photo_url")
      .eq("id", photo.venue_id)
      .maybeSingle();
    if (v?.photo_url === photo.url) {
      const { data: next } = await supabase
        .from("venue_photos")
        .select("url")
        .eq("venue_id", photo.venue_id)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      await supabase
        .from("venues")
        .update({ photo_url: next?.url ?? null })
        .eq("id", photo.venue_id);
    }
    return { ok: true };
  });

/* ------------------------------ Reports ----------------------------- */

export const getOwnerReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      granularity: z.enum(["day", "month"]),
      compare: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);

    const fromDate = parseISO(data.from);
    const toDate = parseISO(data.to);
    if (isAfter(fromDate, toDate)) throw new Error("Invalid range: from > to");
    if (
      data.granularity === "day" &&
      differenceInCalendarDays(toDate, fromDate) > 400
    ) {
      throw new Error("Range too large for daily granularity");
    }
    if (
      data.granularity === "month" &&
      differenceInCalendarMonths(toDate, fromDate) > 60
    ) {
      throw new Error("Range too large");
    }

    /* "Now" in Europe/Athens, without relying on the server timezone. */
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Athens",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const gp = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
    const todayKey = `${gp("year")}-${gp("month")}-${gp("day")}`;
    const nowMin = Number(gp("hour")) * 60 + Number(gp("minute"));

    /* A booking counts only once its END time has passed (Athens time). */
    const isCompleted = (b: {
      date: string;
      start_time: string;
      duration_hours: number;
    }) => {
      if (b.date < todayKey) return true;
      if (b.date > todayKey) return false;
      const [h, m] = b.start_time.split(":").map(Number);
      const endMin = (h || 0) * 60 + (m || 0) + Math.round(Number(b.duration_hours) * 60);
      return endMin <= nowMin;
    };

    /* Previous period of identical length/shape, immediately before `from`. */
    let prevFromD: Date | null = null;
    let prevToD: Date | null = null;
    if (data.compare) {
      if (data.granularity === "day") {
        const n = differenceInCalendarDays(toDate, fromDate) + 1;
        prevToD = subDays(fromDate, 1);
        prevFromD = subDays(prevToD, n - 1);
      } else {
        const m = differenceInCalendarMonths(toDate, fromDate) + 1;
        prevFromD = startOfMonth(subMonths(fromDate, m));
        prevToD = endOfMonth(subMonths(toDate, m));
      }
    }

    const fmtD = (d: Date) => format(d, "yyyy-MM-dd");
    const fetchFrom = prevFromD ? fmtD(prevFromD) : data.from;

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("date,start_time,duration_hours,price,type,status")
      .eq("venue_id", data.venueId)
      .gte("date", fetchFrom)
      .lte("date", data.to)
      .neq("status", "cancelled");
    if (error) throw new Error(error.message);

    type Row = {
      date: string;
      start_time: string;
      duration_hours: number;
      price: number;
      type: "online" | "phone" | "closed";
      status: string;
    };
    const completed = ((rows ?? []) as Row[]).filter(
      (r) => r.type !== "closed" && isCompleted(r),
    );

    const bucketKeyOf = (dateStr: string) =>
      data.granularity === "day" ? dateStr : dateStr.slice(0, 7);

    const makeKeys = (a: Date, b: Date) =>
      data.granularity === "day"
        ? eachDayOfInterval({ start: a, end: b }).map((d) =>
            format(d, "yyyy-MM-dd"),
          )
        : eachMonthOfInterval({ start: a, end: b }).map((d) =>
            format(d, "yyyy-MM"),
          );

    type Agg = {
      revenue: number;
      onlineRevenue: number;
      phoneRevenue: number;
      onlineCount: number;
      phoneCount: number;
    };
    const zero = (): Agg => ({
      revenue: 0,
      onlineRevenue: 0,
      phoneRevenue: 0,
      onlineCount: 0,
      phoneCount: 0,
    });

    const aggregate = (fromKey: string, toKey: string, keys: string[]) => {
      const map = new Map<string, Agg>(keys.map((k) => [k, zero()]));
      for (const r of completed) {
        if (r.date < fromKey || r.date > toKey) continue;
        const agg = map.get(bucketKeyOf(r.date));
        if (!agg) continue;
        const price = Number(r.price || 0);
        agg.revenue += price;
        if (r.type === "online") {
          agg.onlineRevenue += price;
          agg.onlineCount += 1;
        } else if (r.type === "phone") {
          agg.phoneRevenue += price;
          agg.phoneCount += 1;
        }
      }
      return keys.map((k) => ({ key: k, ...map.get(k)! }));
    };

    const cur = aggregate(data.from, data.to, makeKeys(fromDate, toDate));
    const prev =
      prevFromD && prevToD
        ? aggregate(fmtD(prevFromD), fmtD(prevToD), makeKeys(prevFromD, prevToD))
        : null;

    const round = (n: number) => Math.round(n);
    const buckets = cur.map((b, i) => ({
      key: b.key,
      revenue: round(b.revenue),
      onlineRevenue: round(b.onlineRevenue),
      phoneRevenue: round(b.phoneRevenue),
      onlineCount: b.onlineCount,
      phoneCount: b.phoneCount,
      ...(prev
        ? {
            prevRevenue: round(prev[i]?.revenue ?? 0),
            prevOnlineRevenue: round(prev[i]?.onlineRevenue ?? 0),
            prevPhoneRevenue: round(prev[i]?.phoneRevenue ?? 0),
            prevOnlineCount: prev[i]?.onlineCount ?? 0,
            prevPhoneCount: prev[i]?.phoneCount ?? 0,
          }
        : {}),
    }));

    const sumBy = (arr: Agg[], f: (a: Agg) => number) =>
      arr.reduce((s, a) => s + f(a), 0);
    const totals = {
      revenue: round(sumBy(cur, (a) => a.revenue)),
      bookings: sumBy(cur, (a) => a.onlineCount + a.phoneCount),
      online: sumBy(cur, (a) => a.onlineCount),
      phone: sumBy(cur, (a) => a.phoneCount),
      ...(prev
        ? {
            prevRevenue: round(sumBy(prev, (a) => a.revenue)),
            prevBookings: sumBy(prev, (a) => a.onlineCount + a.phoneCount),
            prevOnline: sumBy(prev, (a) => a.onlineCount),
            prevPhone: sumBy(prev, (a) => a.phoneCount),
          }
        : {}),
    };

    /* Popular hours over the CURRENT period, completed bookings only. */
    const hourCounts = new Map<number, number>();
    for (const r of completed) {
      if (r.date < data.from || r.date > data.to) continue;
      const h = Number(r.start_time.split(":")[0]);
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
    const popularHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({
        hour: `${String(hour).padStart(2, "0")}:00`,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      granularity: data.granularity,
      from: data.from,
      to: data.to,
      prevFrom: prevFromD ? fmtD(prevFromD) : null,
      prevTo: prevToD ? fmtD(prevToD) : null,
      buckets,
      totals,
      popularHours,
    };
  });

/* --------------------------- Notifications -------------------------- */

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  read_at: string | null;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,data,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRow[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- Create venue --------------------------- */

export const createVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(2).max(120),
      sport: z.enum(["padel", "tennis", "basketball", "football", "volleyball", "beach_volley"]),
      area: z.string().trim().min(2).max(120),
      address: z.string().trim().max(240).optional().nullable(),
      courtsCount: z.number().int().min(1).max(50).default(1),
      basePricePerHour: z.number().min(0).max(10000).default(0),
      slotPrice: z.number().min(0).max(10000).default(0),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      placeId: z.string().min(1).max(240),
      formattedAddress: z.string().min(1).max(400),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isOwner && !isAdmin) {
      throw new Error("Δεν έχεις δικαίωμα δημιουργίας γηπέδου");
    }
    const { data: row, error } = await supabase
      .from("venues")
      .insert({
        owner_id: userId,
        name: data.name,
        sport: data.sport,
        area: data.area,
        address: data.address ?? data.formattedAddress,
        formatted_address: data.formattedAddress,
        place_id: data.placeId,
        lat: data.lat,
        lng: data.lng,
        courts_count: data.courtsCount,
        base_price_per_hour: data.basePricePerHour,
        slot_price: data.slotPrice,
        amenities: [],
        approved: !!isAdmin,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const venueId = row.id as string;

    const courtRows = Array.from({ length: data.courtsCount }, (_, i) => ({
      venue_id: venueId,
      sport: data.sport,
      name: `Γήπεδο ${i + 1}`,
    }));
    const { error: courtInsertError } = await supabase.from("courts").insert(courtRows);
    if (courtInsertError) throw new Error(courtInsertError.message);

    return { id: venueId, approved: !!isAdmin };
  });

/* ----------------------------- Courts count ------------------------- */

export const setCourtsCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid(), count: z.number().int().min(1).max(50) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: venue } = await supabase
      .from("venues")
      .select("sport")
      .eq("id", data.venueId)
      .single();
    const { data: existing } = await supabase
      .from("courts")
      .select("id,name")
      .eq("venue_id", data.venueId)
      .order("name");
    const have = existing?.length ?? 0;
    if (data.count > have) {
      const rows = Array.from({ length: data.count - have }, (_, i) => ({
        venue_id: data.venueId,
        sport: venue!.sport,
        name: `Γήπεδο ${have + i + 1}`,
      }));
      const { error } = await supabase.from("courts").insert(rows);
      if (error) throw new Error(error.message);
    } else if (data.count < have) {
      const toRemove = (existing ?? []).slice(data.count);
      for (const c of toRemove) {
        const { count: bookingCount } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("court_id", c.id);
        if ((bookingCount ?? 0) > 0) {
          throw new Error(`Δεν μπορεί να αφαιρεθεί το "${c.name}" — έχει κρατήσεις.`);
        }
      }
      const ids = toRemove.map((c: any) => c.id);
      if (ids.length) {
        const { error } = await supabase.from("courts").delete().in("id", ids);
        if (error) throw new Error(error.message);
      }
    }
    await supabase.from("venues").update({ courts_count: data.count }).eq("id", data.venueId);
    return { ok: true };
  });

/* ---------------------------- Court closures ------------------------ */

export type CourtClosure = {
  id: string;
  court_id: string;
  date: string | null;
  weekday: number | null;
  start_time: string;
  end_time: string;
  reason: string | null;
};

export const listCourtClosures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);
    const { data: courts } = await supabase
      .from("courts")
      .select("id,name")
      .eq("venue_id", data.venueId)
      .order("name");
    const ids = (courts ?? []).map((c: any) => c.id);
    if (!ids.length) return { courts: [], closures: [] as CourtClosure[] };
    const { data: closures, error } = await supabase
      .from("court_closures")
      .select("id,court_id,date,weekday,start_time,end_time,reason")
      .in("court_id", ids)
      .order("date", { nullsFirst: false });
    if (error) throw new Error(error.message);
    return {
      courts: (courts ?? []) as { id: string; name: string }[],
      closures: (closures ?? []) as CourtClosure[],
    };
  });

export const addCourtClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      courtId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      weekday: z.number().int().min(0).max(6).nullable(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      reason: z.string().trim().max(200).optional(),
    }).refine((d) => d.date != null || d.weekday != null, {
      message: "Πρέπει να ορίσεις ημερομηνία ή ημέρα εβδομάδας",
    }).refine((d) => d.endTime > d.startTime, {
      message: "Η ώρα τέλους πρέπει να είναι μετά την έναρξη",
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCourtOwner(supabase, userId, data.courtId);
    const { error } = await supabase.from("court_closures").insert({
      court_id: data.courtId,
      date: data.date,
      weekday: data.weekday,
      start_time: `${data.startTime}:00`,
      end_time: `${data.endTime}:00`,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourtClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: rErr } = await supabase
      .from("court_closures")
      .select("court_id")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    await assertCourtOwner(supabase, userId, row.court_id);
    const { error } = await supabase.from("court_closures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------- Public closure lookup ------------------------ */

export const getVenueClosuresPublic = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      venueId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: courts } = await supabaseAdmin
      .from("courts")
      .select("id")
      .eq("venue_id", data.venueId);
    const ids = (courts ?? []).map((c: any) => c.id);
    if (!ids.length) return [] as CourtClosure[];
    const weekday = new Date(`${data.date}T12:00:00`).getDay();
    const { data: rows } = await supabaseAdmin
      .from("court_closures")
      .select("id,court_id,date,weekday,start_time,end_time,reason")
      .in("court_id", ids)
      .or(`date.eq.${data.date},weekday.eq.${weekday}`);
    return (rows ?? []) as CourtClosure[];
  });




/* ----------------------------- Delete venue ------------------------ */

export const deleteVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertVenueOwner(supabase, userId, data.venueId);

    // Remove storage objects for this venue's photos (best effort)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: photos } = await supabase
      .from("venue_photos")
      .select("storage_path")
      .eq("venue_id", data.venueId);
    const paths = (photos ?? []).map((p: any) => p.storage_path).filter(Boolean);
    if (paths.length) {
      await supabaseAdmin.storage.from("venue-photos").remove(paths);
    }

    // FKs cascade: courts, bookings, open_games, venue_photos, venue_hours,
    // court_pricing, court_closures, open_game_players all ON DELETE CASCADE.
    const { error } = await supabase.from("venues").delete().eq("id", data.venueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
