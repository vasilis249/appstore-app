import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/user-avatar";
import { useSections } from "@/hooks/use-sections";
import type { NewsTopic } from "@/lib/posts";
import { timeAgoShort } from "@/lib/time-ago";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { cn } from "@/lib/utils";

/** The cover: the publisher's photo (shown from their server), or the section's icon on a soft tile. */
export function NewsCover({ src, section, className }: { src: string | null | undefined; section: string; className?: string }) {
  const { icon } = useSections();
  const [broken, setBroken] = useState(false);
  const Icon = icon(section);
  if (src && !broken)
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn("aspect-[16/9] w-full rounded-2xl bg-secondary object-cover", className)}
      />
    );
  return (
    <div className={cn("grid aspect-[16/9] w-full place-items-center rounded-2xl bg-secondary", className)}>
      <Icon className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
    </div>
  );
}

/**
 * Home → News (DESIGN.md, Quiet). The topic of the day = a lead card (photo if the publisher has one, indigo label,
 * big headline, who spoke + "Give your take"); every other headline = a typographic row (indigo section, headline,
 * source · time · voices) with a small photo on the right when there is one. Tap → its voices.
 */
export function NewsCard({ topic, daily }: { topic: NewsTopic; daily?: boolean }) {
  const { t, i18n } = useTranslation();
  const { name } = useSections();
  const first = topic.speakers[0]?.name?.split(" ")[0] ?? "";
  const when = timeAgoShort(topic.created_at, i18n.language);
  const spoke =
    topic.speakers_count === 0
      ? null
      : topic.speakers_count === 1
        ? t("news.spokeOne", { name: first })
        : t("news.spokeMany", { name: first, count: topic.speakers_count - 1 });

  if (daily)
    return (
      <Link to="/t/$topicId" params={{ topicId: topic.id }} className="mx-4 mb-4 mt-1 block overflow-hidden rounded-3xl bg-card active:opacity-90">
        {topic.image_url && <NewsCover src={topic.image_url} section={topic.section_id} className="rounded-none" />}
        <div className="p-4">
          <p className="flex items-center justify-between gap-2 text-fine">
            <span className="font-semibold text-link">{t("daily.topicOfDay")}</span>
            <span className="truncate text-muted-foreground">{[topic.source_name, when].filter(Boolean).join(" · ")}</span>
          </p>
          <h2 className="mt-1.5 line-clamp-3 text-[22px] font-[650] leading-[1.27] tracking-[-0.022em]">{topic.title}</h2>
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
              {topic.speakers_count > 0 && (
                <span className="flex shrink-0 -space-x-2">
                  {topic.speakers.map((sp, i) => (
                    <span key={i} className="rounded-full ring-2 ring-card">
                      <UserAvatar name={sp.name} path={sp.avatar_path} size={24} />
                    </span>
                  ))}
                </span>
              )}
              <span className="truncate">{spoke ?? t("news.beFirst")}</span>
            </div>
            <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] bg-primary px-3.5 text-caption font-semibold text-primary-foreground">
              <VoiceIcon className="h-4 w-4" /> {t("posts.giveYourTake")}
            </span>
          </div>
        </div>
      </Link>
    );

  return (
    <Link to="/t/$topicId" params={{ topicId: topic.id }} className="mx-4 flex gap-3 border-b border-border py-3.5 active:opacity-70">
      <div className="min-w-0 flex-1">
        <p className="truncate text-fine font-semibold text-link">{name(topic.section_id)}</p>
        <h2 className="mt-0.5 line-clamp-3 text-body font-semibold leading-[1.32] tracking-[-0.012em]">{topic.title}</h2>
        <p className="mt-1 truncate text-caption tabular-nums text-muted-foreground">
          {[topic.source_name, when, topic.posts_count > 0 ? t("posts.voicesCount", { count: topic.posts_count }) : t("news.beFirst")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {topic.image_url && (
        <img
          src={topic.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => e.currentTarget.remove()}
          className="mt-1 h-[68px] w-[68px] shrink-0 rounded-xl bg-secondary object-cover"
        />
      )}
    </Link>
  );
}
