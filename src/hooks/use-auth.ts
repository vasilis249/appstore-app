import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "owner" | "coach" | "player";

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** Effective role (respects admin "view as" override). */
  role: AppRole | null;
  /** Actual role from DB (not affected by view-as). */
  actualRole: AppRole | null;
  loading: boolean;
}

const VIEW_AS_KEY = "courtsie:viewAs";
const VIEW_AS_EVENT = "courtsie:viewAs-change";

export function getViewAs(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_AS_KEY);
  return v === "owner" || v === "player" ? v : null;
}

export function setViewAs(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(VIEW_AS_KEY, role);
  else window.localStorage.removeItem(VIEW_AS_KEY);
  window.dispatchEvent(new Event(VIEW_AS_EVENT));
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [actualRole, setActualRole] = useState<AppRole | null>(null);
  const [viewAs, setViewAsState] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setViewAsState(getViewAs());
    const onChange = () => setViewAsState(getViewAs());
    window.addEventListener(VIEW_AS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(VIEW_AS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setActualRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) fetchRole(data.session.user.id);
      setLoading(false);
    });

    async function fetchRole(userId: string) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setActualRole((data?.role as AppRole) ?? "player");
    }

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const role: AppRole | null =
    actualRole === "admin" && viewAs ? viewAs : actualRole;

  return { session, user: session?.user ?? null, role, actualRole, loading };
}
