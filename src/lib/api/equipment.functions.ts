import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EquipmentItem = {
  id: string;
  venue_id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
};

/** Public read — only active items of approved venues (via RLS). */
export const listVenueEquipment = createServerFn({ method: "GET" })
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await sb
      .from("venue_equipment")
      .select("id,venue_id,name,price,active,sort_order")
      .eq("venue_id", data.venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      price: Number(r.price),
    })) as EquipmentItem[];
  });

/** Owner read — all items, including inactive. */
export const listOwnerEquipment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ venueId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("venue_equipment")
      .select("id,venue_id,name,price,active,sort_order")
      .eq("venue_id", data.venueId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      price: Number(r.price),
    })) as EquipmentItem[];
  });

/** Owner write — create/update a single item. */
export const upsertEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      venueId: z.string().uuid(),
      name: z.string().min(1).max(80),
      price: z.number().min(0).max(9999),
      active: z.boolean().default(true),
      sortOrder: z.number().int().min(0).max(999).default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase
        .from("venue_equipment")
        .update({
          name: data.name.trim(),
          price: data.price,
          active: data.active,
          sort_order: data.sortOrder,
        })
        .eq("id", data.id)
        .eq("venue_id", data.venueId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabase
      .from("venue_equipment")
      .insert({
        venue_id: data.venueId,
        name: data.name.trim(),
        price: data.price,
        active: data.active,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id as string };
  });

export const deleteEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("venue_equipment")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type BookingEquipmentItem = {
  id: string;
  booking_id: string;
  equipment_id: string | null;
  name: string;
  price: number;
};

/** Read equipment lines for one booking (owner or player; RLS-controlled). */
export const listBookingEquipment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bookingId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("booking_equipment")
      .select("id,booking_id,equipment_id,name,price")
      .eq("booking_id", data.bookingId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      price: Number(r.price),
    })) as BookingEquipmentItem[];
  });
