import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [venuesAll, venuesPending, bookings30, revenue30, players, owners] = await Promise.all([
      supabaseAdmin.from("venues").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("venues").select("id", { count: "exact", head: true }).eq("approved", false),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("date", since).neq("status", "cancelled"),
      supabaseAdmin.from("bookings").select("price").gte("date", since).neq("status", "cancelled").neq("type", "closed"),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "player"),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "owner"),
    ]);

    const revenue = (revenue30.data ?? []).reduce((a, r: any) => a + Number(r.price || 0), 0);
    return {
      venues: venuesAll.count ?? 0,
      pendingVenues: venuesPending.count ?? 0,
      bookings30: bookings30.count ?? 0,
      revenue30: revenue,
      players: players.count ?? 0,
      owners: owners.count ?? 0,
    };
  });

export const listAllVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("venues")
      .select("id, name, sport, area, approved, owner_id, rating, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((v) => v.owner_id).filter(Boolean) as string[]));
    const { data: owners } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, full_name").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };
    const ownerMap = new Map((owners ?? []).map((o) => [o.user_id, o.full_name]));
    return (data ?? []).map((v) => ({ ...v, owner_name: v.owner_id ? ownerMap.get(v.owner_id) ?? null : null }));
  });

export const setVenueApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueId: string; approved: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { approved: data.approved };
    if (data.approved) patch.rejection_reason = null;
    const { error } = await supabaseAdmin.from("venues").update(patch).eq("id", data.venueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.reason.trim()) throw new Error("Απαιτείται λόγος απόρριψης");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("venues")
      .update({ approved: false, rejection_reason: data.reason.trim() })
      .eq("id", data.venueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("venues").delete().eq("id", data.venueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { role?: "player" | "owner" | "coach" | "admin" }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userIds: string[] | null = null;
    if (data.role) {
      const { data: rows } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", data.role);
      userIds = (rows ?? []).map((r) => r.user_id);
      if (!userIds.length) return [];
    }

    let q = supabaseAdmin.from("profiles").select("user_id, full_name, photo_url, level, games_played, rating, disabled, created_at").order("created_at", { ascending: false }).limit(500);
    if (userIds) q = q.in("user_id", userIds);
    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.user_id);
    const { data: roles } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; role: string }> };
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.user_id) ?? ["player"] }));
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; disabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ disabled: data.disabled }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    // Ban/unban auth user (sets banned_until)
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    return { ok: true };
  });

// ============ Moderation: message reports ============

export type AdminReportRow = {
  id: string;
  status: "open" | "dismissed" | "actioned";
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  action: string | null;
  reporter: { user_id: string; full_name: string | null } | null;
  reported_user: { user_id: string; full_name: string | null } | null;
  conversation_id: string | null;
  message: { id: string; body: string; created_at: string; deleted_at: string | null } | null;
};

export const listMessageReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { status?: "open" | "dismissed" | "actioned" | "all" }) => d ?? {})
  .handler(async ({ data, context }): Promise<AdminReportRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("message_reports")
      .select("id,status,reason,created_at,resolved_at,action,reporter_id,reported_user_id,conversation_id,message_id")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).flatMap((r: any) => [r.reporter_id, r.reported_user_id]).filter(Boolean)));
    const msgIds = Array.from(new Set((rows ?? []).map((r: any) => r.message_id).filter(Boolean)));

    const [{ data: profiles }, { data: msgs }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      msgIds.length
        ? supabaseAdmin.from("messages").select("id, body, created_at, deleted_at").in("id", msgIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
    const mMap = new Map((msgs ?? []).map((m: any) => [m.id, m]));

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      action: r.action,
      reporter: r.reporter_id ? { user_id: r.reporter_id, full_name: pMap.get(r.reporter_id) ?? null } : null,
      reported_user: r.reported_user_id ? { user_id: r.reported_user_id, full_name: pMap.get(r.reported_user_id) ?? null } : null,
      conversation_id: r.conversation_id,
      message: r.message_id ? (mMap.get(r.message_id) ?? null) : null,
    }));
  });

export const dismissReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("message_reports")
      .update({ status: "dismissed", action: "dismissed", resolved_by: context.userId, resolved_at: new Date().toISOString() })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReportedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error: e1 } = await supabaseAdmin
      .from("message_reports")
      .select("id, message_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!r || !r.message_id) throw new Error("Δεν υπάρχει μήνυμα προς διαγραφή");
    const now = new Date().toISOString();
    const { error: e2 } = await supabaseAdmin
      .from("messages")
      .update({ deleted_at: now, deleted_by: context.userId })
      .eq("id", r.message_id);
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin
      .from("message_reports")
      .update({ status: "actioned", action: "message_deleted", resolved_by: context.userId, resolved_at: now })
      .eq("id", data.reportId);
    if (e3) throw new Error(e3.message);
    return { ok: true };
  });
