import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, Trophy } from "lucide-react";
import { courseKeys, helperStats } from "@/lib/courses";

/** On a profile: «Top βοηθός» / «Ιδρυτικό μέλος» badges and the points line (→ the department's courses + board). */
export function HelperBadges({ userId, department }: { userId: string; department: string | null }) {
  const { t } = useTranslation();
  const stats = useQuery({ queryKey: courseKeys.stats(userId), queryFn: () => helperStats(userId), enabled: !!department });
  const s = stats.data;
  if (!s || !department) return null;
  const pill = "inline-flex min-h-[26px] items-center gap-1.5 rounded-2xl px-2.5 py-1 text-caption font-semibold";
  return (
    <>
      {(s.top || s.founding) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {s.top && (
            <span className={`${pill} bg-link text-primary-foreground`}>
              <Trophy className="h-3.5 w-3.5" /> {t("helper.top")}
            </span>
          )}
          {s.founding && (
            <span className={`${pill} bg-secondary`}>
              <Sparkles className="h-3.5 w-3.5 text-link" /> {t("helper.founding")}
            </span>
          )}
        </div>
      )}
      {s.points > 0 && (
        <Link to="/courses" search={{ d: department }} className="mt-2 block text-caption text-muted-foreground">
          <span className="font-semibold text-foreground">{t("courses.points", { count: s.points })}</span>
          {s.rank && ` · ${t("helper.rank", { rank: s.rank })}`}
          {s.downloads > 0 && ` · ${t("helper.helped", { count: s.downloads })}`}
        </Link>
      )}
    </>
  );
}
