import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { friendKeys, rpcErrorKey, setFollowing } from "@/lib/friends";
import { postKeys } from "@/lib/posts";
import { cn } from "@/lib/utils";

/** Follow (white) / Following (grey) / Follow back. */
export function FollowButton({
  userId,
  following,
  followsMe,
  size = "sm",
}: {
  userId: string;
  following: boolean;
  followsMe?: boolean;
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => setFollowing(userId, !following),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: friendKeys.all });
      void qc.invalidateQueries({ queryKey: postKeys.all });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <button
      type="button"
      disabled={m.isPending}
      onClick={() => m.mutate()}
      className={cn(
        "shrink-0 rounded-[10px] font-semibold transition-colors duration-300 disabled:opacity-50",
        size === "lg" ? "h-11 px-6 text-callout" : "h-8 px-3.5 text-caption",
        // Follow is the one indigo button (DESIGN.md, Quiet); Following goes grey.
        following ? "bg-secondary text-foreground" : "bg-link text-primary-foreground",
      )}
    >
      {following ? t("people.following") : followsMe ? t("people.followBack") : t("people.follow")}
    </button>
  );
}
