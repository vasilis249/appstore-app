import { cn } from "@/lib/utils";

export const APP_NAME = "Speak";

/** Text wordmark ("Name."): SF Pro Display 600 with the Apple tight tracking (DESIGN.md: no 700+ weights). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("block font-display text-tagline font-semibold tracking-[-0.5px]", className)}>
      {APP_NAME}.
    </span>
  );
}
