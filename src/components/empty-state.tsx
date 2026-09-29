import type { LucideIcon } from "lucide-react";

/** One icon, one short line (UX rule for every empty screen). */
export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center animate-fade-in-up">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary">
        <Icon className="h-8 w-8" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
