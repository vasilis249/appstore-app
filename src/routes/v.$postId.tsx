import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Heart, ImageIcon, Lock, MessageCircle } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useAuth } from "@/hooks/use-auth";
import { postPreview } from "@/lib/api/post.functions";
import { formatClock } from "@/lib/audio";
import { NEXT_KEY } from "@/lib/invites";

export const Route = createFileRoute("/v/$postId")({
  // Server-side, so link previews (WhatsApp, iMessage, Instagram) show who said what.
  loader: ({ params }) => postPreview({ data: { id: params.postId } }),
  head: ({ loaderData: p }) => {
    const title = p ? `${p.name}${p.school ? ` · ${p.school}` : ""} στο Speak` : "Speak — μόνο για φοιτητές";
    const text = p?.text || (p?.durationMs ? "Είπε κάτι με τη φωνή του/της στο Speak." : "Το social δίκτυο με φωνή, μόνο για φοιτητές.");
    return {
      meta: [
        { title },
        { name: "description", content: text },
        { property: "og:title", content: title },
        { property: "og:description", content: text },
        { property: "og:type", content: "article" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: SharedPostPage,
});

/**
 * A shared post for anyone (no account): a teaser — first name, school, text, "has a voice / n photos", counts — and
 * the way in (3-step student sign-up). Signed-in students go straight to the post; new ones land on it after signing up.
 */
function SharedPostPage() {
  const { postId } = Route.useParams();
  const p = Route.useLoaderData();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) void navigate({ to: "/p/$postId", params: { postId }, replace: true });
    else if (!loading && p) {
      try {
        localStorage.setItem(NEXT_KEY, `/p/${postId}`);
      } catch {
        /* private mode: they land on Home instead */
      }
    }
  }, [user, loading, p, postId, navigate]);

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-8">
      <Wordmark className="text-center text-display" />
      <div className="flex flex-1 flex-col justify-center py-8">
        {p ? (
          <article className="rounded-3xl bg-card p-5">
            <p className="text-callout font-semibold">{p.name}</p>
            {p.school && (
              <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
                <GraduationCap className="h-4 w-4 shrink-0" /> {p.school}
              </p>
            )}
            {p.text && <p className="mt-3 whitespace-pre-line text-tagline leading-snug">{p.text}</p>}
            {(!!p.durationMs || p.photos > 0) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {!!p.durationMs && (
                  <span className="flex h-10 items-center gap-2 rounded-full bg-secondary pl-3 pr-4 text-callout font-semibold">
                    <VoiceIcon className="h-5 w-5 text-link" /> {t("share.voice", { clock: formatClock(p.durationMs) })}
                  </span>
                )}
                {p.photos > 0 && (
                  <span className="flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-callout font-semibold">
                    <ImageIcon className="h-4 w-4" /> {t("share.photos", { count: p.photos })}
                  </span>
                )}
              </div>
            )}
            <p className="mt-4 flex items-center gap-4 text-caption text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4" /> {p.likes}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> {p.replies}
              </span>
            </p>
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-caption font-semibold text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" /> {t("share.studentsOnly")}
            </p>
          </article>
        ) : (
          <div className="text-center">
            <h1 className="text-display font-semibold">{t("share.unavailable")}</h1>
            <p className="mt-3 text-callout text-muted-foreground">{t("invite.pageText")}</p>
          </div>
        )}
      </div>
      <Link to="/auth" search={{ mode: "signup" }} className="grid h-14 w-full place-items-center rounded-xl bg-primary text-body font-semibold text-primary-foreground">
        {t("auth.startStudent")}
      </Link>
      <p className="mt-3 text-center text-caption leading-snug text-muted-foreground">{t("auth.startStudentHint")}</p>
    </div>
  );
}
