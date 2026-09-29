import { cn } from "@/lib/utils";

/** Decorative bars (stable per seed) with a played-part highlight. */
export function Waveform({ seed, progress = 0, bars = 36, className }: { seed: string; progress?: number; bars?: number; className?: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const heights = Array.from({ length: bars }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const wave = Math.sin((i / bars) * Math.PI);
    return 0.25 + 0.75 * wave * ((h % 1000) / 1000 * 0.7 + 0.3);
  });
  return (
    <div className={cn("flex h-10 flex-1 items-center gap-[3px]", className)} aria-hidden>
      {heights.map((v, i) => (
        <span
          key={i}
          className={cn("w-full rounded-full", i / bars < progress ? "bg-foreground" : "bg-foreground/30")}
          style={{ height: `${Math.round(v * 100)}%` }}
        />
      ))}
    </div>
  );
}
