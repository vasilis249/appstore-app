import { useRef, useState } from "react";
import { Heart } from "lucide-react";

/**
 * Swipeable photo carousel (scroll-snap) with dots. Double-tap calls onDoubleTap
 * (used for "like") and shows the heart burst, like Instagram.
 */
export function MediaCarousel({
  urls,
  onDoubleTap,
  alt = "",
}: {
  urls: string[];
  onDoubleTap?: () => void;
  alt?: string;
}) {
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  function onTap() {
    const now = Date.now();
    if (now - lastTap.current < 300 && onDoubleTap) {
      onDoubleTap();
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  }

  return (
    <div className="relative bg-muted">
      <div
        ref={scroller}
        onClick={onTap}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
        }}
        className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((u, i) => (
          <img
            key={u}
            src={u}
            alt={alt}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            className="h-full w-full shrink-0 snap-center select-none object-cover"
          />
        ))}
      </div>
      {burst > 0 && (
        <Heart
          key={burst}
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-[like-burst_700ms_ease-out_forwards] fill-white text-white drop-shadow-lg"
        />
      )}
      {urls.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            {index + 1}/{urls.length}
          </span>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {urls.map((u, i) => (
              <span
                key={u}
                className={`h-1.5 w-1.5 rounded-full transition ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
