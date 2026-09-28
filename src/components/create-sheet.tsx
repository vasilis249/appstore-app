import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarPlus, ChevronRight, Clock, type LucideIcon } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

type Action = { to: string; icon: LucideIcon; title: string; hint: string };

/** The "+" tab: one short list of things you can start. */
export function CreateSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const actions: Action[] = [
    { to: "/venues", icon: CalendarPlus, title: t("create.book"), hint: t("create.bookHint") },
    { to: "/open-games", icon: Clock, title: t("create.join"), hint: t("create.joinHint") },
  ];
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="sr-only">{t("create.title")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("create.title")}</DrawerDescription>
        <ul className="safe-bottom space-y-2 p-4 pt-5">
          {actions.map(({ to, icon: Icon, title, hint }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60 transition active:scale-[0.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{hint}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
