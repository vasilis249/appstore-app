import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/**
 * Photos (a post's, a DM's) full screen on black: swipe between them (native scroll snap), a glass ✕ and "1 από 3" on top.
 * Radix Dialog gives the focus trap, Escape and the screen-reader title.
 */
export function PhotoViewer({ urls, start, alt, onClose }: { urls: string[]; start: number | null; alt: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [at, setAt] = useState(0);
  return (
    <DialogPrimitive.Root open={start !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black animate-in fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-[61] outline-none animate-in fade-in-0 zoom-in-95" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <div
            // open on the tapped photo; the counter follows the swipe
            ref={(el) => {
              if (el && start !== null && el.dataset.started !== String(start)) {
                el.dataset.started = String(start);
                el.scrollLeft = start * el.clientWidth;
                setAt(start);
              }
            }}
            onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
            className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          >
            {urls.map((u, i) => (
              <div key={u} className="grid h-full w-full shrink-0 snap-center place-items-center">
                <img src={u} alt={`${alt} (${i + 1}/${urls.length})`} className="max-h-full max-w-full object-contain" />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
            <DialogPrimitive.Close aria-label={t("common.close")} className="glass pointer-events-auto grid h-11 w-11 place-items-center rounded-full text-foreground">
              <X className="h-5 w-5" strokeWidth={2.2} />
            </DialogPrimitive.Close>
            {urls.length > 1 && (
              <span className="glass rounded-full px-3 py-1.5 text-caption font-semibold tabular-nums text-foreground">
                {t("posts.photoCount", { n: at + 1, max: urls.length })}
              </span>
            )}
            <span className="w-11" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
