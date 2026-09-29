import { cn } from "@/lib/utils";

export const APP_NAME = "Courtsie";

/** Text wordmark ("Name."), bold and tight like a system-font logo. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("block font-display text-2xl font-extrabold tracking-tight", className)}>
      {APP_NAME}.
    </span>
  );
}
