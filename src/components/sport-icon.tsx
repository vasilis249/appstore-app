import { cn } from "@/lib/utils";
import type { Sport } from "@/lib/sports";
import padelImg from "@/assets/sport-padel.jpg";
import tennisImg from "@/assets/sport-tennis.jpg";
import basketballImg from "@/assets/sport-basketball.jpg";
import footballImg from "@/assets/sport-football.jpg";
import volleyballImg from "@/assets/sport-volleyball.jpg";
import beachVolleyImg from "@/assets/sport-beach-volley.jpg";

export const SPORT_IMAGES: Record<Sport, string> = {
  padel: padelImg,
  tennis: tennisImg,
  basketball: basketballImg,
  football: footballImg,
  volleyball: volleyballImg,
  beach_volley: beachVolleyImg,
};

interface SportIconProps {
  sport: Sport;
  className?: string;
  alt?: string;
}

/** Circular brand sport token. Default size = 1rem (size-4). */
export function SportIcon({ sport, className, alt = "" }: SportIconProps) {
  return (
    <img
      src={SPORT_IMAGES[sport]}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={cn("inline-block size-4 rounded-full object-cover ring-1 ring-border/40", className)}
      loading="lazy"
      decoding="async"
    />
  );
}
