import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mic, Sparkles } from "lucide-react";
import { useSections } from "@/hooks/use-sections";
import { dailyKeys, getToday } from "@/lib/daily";

/** "Topic of the day" at the top of Home: the question everyone answers today. */
export function DailyTopicCard() {
  const { t } = useTranslation();
  const { name } = useSections();
  const q = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  const d = q.data;
  if (!d?.topic_id || !d.topic_title) return null;
  return (
    <section className="mx-4 mb-3 rounded-3xl bg-primary p-4 text-primary-foreground">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-70">
        <Sparkles className="h-3.5 w-3.5" /> {t("daily.topicOfDay")}
        {d.topic_section && <span className="font-medium normal-case tracking-normal">· {name(d.topic_section)}</span>}
      </p>
      <Link to="/t/$topicId" params={{ topicId: d.topic_id }} className="mt-1 block text-lg font-bold leading-snug">
        {d.topic_title}
      </Link>
      <Link
        to="/record"
        search={{ topic: d.topic_id }}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary"
      >
        <Mic className="h-4 w-4" /> {t("posts.giveYourTake")}
      </Link>
    </section>
  );
}
