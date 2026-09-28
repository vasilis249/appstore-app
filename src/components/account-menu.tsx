import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, User as UserIcon, Eye, Check, LayoutDashboard, Shield } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, setViewAs, getViewAs, type AppRole } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name && name.trim()) || (email ?? "");
  const parts = src.split(/\s+|@/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

export function AccountMenu() {
  const { user, actualRole } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [viewAs, setViewAsLocal] = useState<AppRole | null>(getViewAs());

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    supabase
      .from("profiles")
      .select("photo_url, full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPhoto(data?.photo_url ?? null);
        setName(data?.full_name ?? null);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
      >
        {t("nav.signIn")}
      </Link>
    );
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    setViewAs(null);
    await supabase.auth.signOut();
    toast.success(t("account.signedOut"));
    navigate({ to: "/auth", replace: true });
  }

  function applyViewAs(next: AppRole | null) {
    setViewAs(next);
    setViewAsLocal(next);
    // Push to a sensible landing for the chosen environment
    if (next === "owner") navigate({ to: "/owner" });
    else navigate({ to: "/" });
  }

  const isAdmin = actualRole === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account.menu")}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-foreground transition hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Avatar className="h-10 w-10">
          {photo ? <AvatarImage src={photo} alt={name ?? user.email ?? ""} /> : null}
          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
            {initials(name, user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{name ?? user.email}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          {isAdmin && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Shield className="h-3 w-3" /> Admin
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" /> {t("account.profile")}
          </Link>
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {t("account.viewAs")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => applyViewAs(null)} className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" /> {t("account.viewAsAdmin")}
              {viewAs === null && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyViewAs("owner")} className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" /> {t("account.viewAsOwner")}
              {viewAs === "owner" && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyViewAs("player")} className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" /> {t("account.viewAsPlayer")}
              {viewAs === "player" && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> {t("account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
