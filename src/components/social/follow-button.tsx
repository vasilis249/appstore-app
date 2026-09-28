import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { followUser, unfollowUser, type FollowState } from "@/lib/api/social.functions";

/** Follow / Requested / Following toggle. Keeps its own optimistic state. */
export function FollowButton({
  userId,
  state,
  followsMe = false,
  size = "md",
  className,
}: {
  userId: string;
  state: FollowState;
  followsMe?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const [current, setCurrent] = useState<FollowState>(state);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res =
        current === "none"
          ? await follow({ data: { userId } })
          : await unfollow({ data: { userId } });
      setCurrent(res.status);
      void qc.invalidateQueries({ queryKey: ["social-profile"] });
      void qc.invalidateQueries({ queryKey: ["follow-list"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label =
    current === "accepted"
      ? t("social.followingBtn")
      : current === "pending"
        ? t("social.requested")
        : followsMe
          ? t("social.followBack")
          : t("social.follow");

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        current === "none"
          ? "bg-primary text-primary-foreground shadow-glow hover:opacity-95"
          : "bg-secondary text-secondary-foreground hover:bg-muted",
        className,
      )}
    >
      {label}
    </button>
  );
}
