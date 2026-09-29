import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { SectionChips } from "@/components/posts/section-chips";
import { TopicStrip } from "@/components/posts/topic-strip";
import { useSections } from "@/hooks/use-sections";

export const Route = createFileRoute("/_authenticated/s/$sectionId")({
  component: SectionPage,
});

function SectionPage() {
  const { sectionId } = Route.useParams();
  const { t } = useTranslation();
  const { name, icon } = useSections();
  const Icon = icon(sectionId);
  return (
    <>
      <AppHeader
        back
        center={
          <span className="flex items-center gap-2 text-lg font-bold">
            <Icon className="h-5 w-5" /> {name(sectionId)}
          </span>
        }
      />
      <div className="pt-1">
        <SectionChips active={sectionId} />
        <TopicStrip section={sectionId} />
        <FeedList
          key={sectionId}
          params={{ scope: "section", section: sectionId }}
          empty={
            <EmptyState
              icon={Icon}
              text={t("posts.emptySection")}
              action={
                <Link to="/record" search={{ section: sectionId }} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
                  <Mic className="h-5 w-5" /> {t("posts.speak")}
                </Link>
              }
            />
          }
        />
      </div>
    </>
  );
}
