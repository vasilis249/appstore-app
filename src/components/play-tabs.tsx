import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Segmented switch between the venue list and open games (one tab in the bottom nav). */
export function PlayTabs() {
  const { t } = useTranslation();
  const tab =
    "flex-1 rounded-[12px] py-2 text-center text-sm font-semibold text-muted-foreground transition";
  const active = { className: "bg-background text-foreground shadow-sm" };
  return (
    <nav className="mb-5 flex rounded-[14px] bg-secondary p-1">
      <Link to="/venues" className={tab} activeProps={active}>
        {t("playTabs.venues")}
      </Link>
      <Link to="/open-games" className={tab} activeProps={active}>
        {t("playTabs.games")}
      </Link>
    </nav>
  );
}
