import { cn } from "@/lib/utils";

/** Round profile photo with an initial fallback; `ring` draws the orange story ring. */
export function UserAvatar({
  name,
  photoUrl,
  size = 40,
  ring = false,
  className,
}: {
  name: string | null | undefined;
  photoUrl: string | null | undefined;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const inner = (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.38) }}
    >
      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
  if (!ring) return <span className={cn("inline-flex", className)}>{inner}</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-gradient-to-tr from-optic via-coral to-primary p-[2.5px]",
        className,
      )}
    >
      <span className="rounded-full bg-background p-[2.5px]">{inner}</span>
    </span>
  );
}
