import { cn } from "@/lib/utils";

export const APP_NAME = "Speak";

/** Text wordmark ("Name."): heavy, tight system display type (until the real logo arrives). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("block font-display text-[26px] font-extrabold leading-none tracking-[-0.04em]", className)}>
      {APP_NAME}.
    </span>
  );
}
