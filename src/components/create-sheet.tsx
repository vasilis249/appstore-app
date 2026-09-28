import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CalendarPlus,
  ChevronRight,
  CircleDashed,
  Clock,
  ImagePlus,
  type LucideIcon,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/use-auth";
import { CreatePostSheet } from "@/components/social/create-post-sheet";
import { useStoryUpload } from "@/components/social/stories-tray";

type Action = {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  to?: string;
  onClick?: () => void;
};

/** The "+" tab: one short list of things you can start. */
export function CreateSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [postOpen, setPostOpen] = useState(false);
  const storyInput = useRef<HTMLInputElement>(null);
  const { upload } = useStoryUpload();

  const actions: Action[] = [
    ...(user
      ? [
          {
            key: "post",
            icon: ImagePlus,
            title: t("create.post"),
            hint: t("create.postHint"),
            onClick: () => {
              onOpenChange(false);
              setPostOpen(true);
            },
          },
          {
            key: "story",
            icon: CircleDashed,
            title: t("create.story"),
            hint: t("create.storyHint"),
            onClick: () => storyInput.current?.click(),
          },
        ]
      : []),
    {
      key: "book",
      to: "/venues",
      icon: CalendarPlus,
      title: t("create.book"),
      hint: t("create.bookHint"),
    },
    {
      key: "times",
      to: "/open-games",
      icon: Clock,
      title: t("create.join"),
      hint: t("create.joinHint"),
    },
  ];

  const rowClass =
    "flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border/60 transition active:scale-[0.99]";
  const body = (a: Action) => (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <a.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{a.title}</span>
        <span className="block truncate text-sm text-muted-foreground">{a.hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </>
  );

  return (
    <>
      <input
        ref={storyInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onOpenChange(false);
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-background">
          <DrawerTitle className="sr-only">{t("create.title")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("create.title")}</DrawerDescription>
          <ul className="safe-bottom space-y-2 p-4 pt-5">
            {actions.map((a) => (
              <li key={a.key}>
                {a.to ? (
                  <Link to={a.to} onClick={() => onOpenChange(false)} className={rowClass}>
                    {body(a)}
                  </Link>
                ) : (
                  <button type="button" onClick={a.onClick} className={rowClass}>
                    {body(a)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
      {user && <CreatePostSheet open={postOpen} onOpenChange={setPostOpen} />}
    </>
  );
}
