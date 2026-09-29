import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { dailyKeys, getToday } from "@/lib/daily";

/** "Topic of the day" at the top of Home: one quiet row — the question, and a mic to answer it. */
export function DailyTopicCard() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  const d = q.data;
  if (!d?.topic_id || !d.topic_title) return null;
  return (
    <section className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-secondary py-3 pl-4 pr-3">
      <Link to="/t/$topicId" params={{ topicId: d.topic_id }} className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-coral">{t("daily.topicOfDay")}</span>
        <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-snug">{d.topic_title}</span>
      </Link>
      <Link
        to="/record"
        search={{ topic: d.topic_id }}
        aria-label={t("posts.giveYourTake")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
      >
        <Mic className="h-5 w-5" />
      </Link>
    </section>
  );
}
