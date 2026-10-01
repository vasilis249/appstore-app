import { cn } from "@/lib/utils";

/**
 * Decorative bars (stable per seed): thin, grey until played, ink once played. `live` = it's playing now, the bars
 * breathe (Quiet motion).
 */
export function Waveform({
  seed,
  progress = 0,
  bars = 36,
  live = false,
  className,
}: {
  seed: string;
  progress?: number;
  bars?: number;
  live?: boolean;
  className?: string;
}) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const heights = Array.from({ length: bars }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const wave = Math.sin((i / bars) * Math.PI);
    return 0.2 + 0.8 * wave * ((h % 1000) / 1000 * 0.7 + 0.3);
  });
  return (
    <div className={cn("flex h-7 flex-1 items-center justify-between gap-[2px]", live && "wave-live", className)} aria-hidden>
      {heights.map((v, i) => (
        <span
          key={i}
          className={cn("w-full max-w-[3px] rounded-full transition-colors duration-200", i / bars < progress ? "bg-foreground" : "bg-wave")}
          style={{ height: `${Math.round(v * 100)}%` }}
        />
      ))}
    </div>
  );
}
