import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/user-avatar";
import { useSections } from "@/hooks/use-sections";
import type { NewsTopic } from "@/lib/posts";
import { timeAgoShort } from "@/lib/time-ago";
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

/** Home → News: big photo, big headline, and in small letters who spoke about it. Tap → its voices. */
export function NewsCard({ topic, daily }: { topic: NewsTopic; daily?: boolean }) {
  const { t, i18n } = useTranslation();
  const { name } = useSections();
  const first = topic.speakers[0]?.name?.split(" ")[0] ?? "";
  return (
    <Link to="/t/$topicId" params={{ topicId: topic.id }} className="block px-4 pb-5 pt-2 active:opacity-80">
      <NewsCover src={topic.image_url} section={topic.section_id} />
      <p className="mt-2.5 flex items-center gap-1 text-[12px] text-muted-foreground">
        {daily && <span className="font-bold uppercase tracking-wide text-link">{t("daily.topicOfDay")} ·</span>}
        <span className="font-medium text-foreground/80">{name(topic.section_id)}</span>
        {topic.source_name && <span className="truncate">· {topic.source_name}</span>}
        <span className="shrink-0">· {timeAgoShort(topic.created_at, i18n.language)}</span>
      </p>
      <h2 className="mt-1 line-clamp-3 text-[21px] font-bold leading-[1.2] tracking-tight">{topic.title}</h2>
      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
        {topic.speakers_count > 0 ? (
          <>
            <span className="flex -space-x-2">
              {topic.speakers.map((s, i) => (
                <span key={i} className="rounded-full ring-2 ring-background">
                  <UserAvatar name={s.name} path={s.avatar_path} size={22} />
                </span>
              ))}
            </span>
            <span className="truncate">
              {topic.speakers_count === 1
                ? t("news.spokeOne", { name: first })
                : t("news.spokeMany", { name: first, count: topic.speakers_count - 1 })}
              {" · "}
              {t("posts.voicesCount", { count: topic.posts_count })}
            </span>
          </>
        ) : (
          <span className="font-medium text-link">{t("news.beFirst")}</span>
        )}
      </div>
    </Link>
  );
}
