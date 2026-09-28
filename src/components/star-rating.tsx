import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, onChange, size = 18, readOnly = false }: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            className={cn("transition", !readOnly && "hover:scale-110 cursor-pointer", readOnly && "cursor-default")}
            aria-label={`${n} αστέρια`}
          >
            <Star
              width={size}
              height={size}
              className={cn(active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
            />
          </button>
        );
      })}
    </div>
  );
}
