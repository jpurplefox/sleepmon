import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export interface SwipePagerItem {
  /** Stable identity of the slide, so the pager can follow it when the order changes. */
  key: string;
  /** Accessible name of the button that shows this slide. */
  label: string;
  icon: ReactNode;
}

// Index of the slide whose left edge sits closest to the track's own left edge.
function activeSlide(track: HTMLElement): number {
  const left = track.getBoundingClientRect().left;
  let best = 0;
  let bestDistance = Infinity;
  Array.from(track.children).forEach((child, i) => {
    const distance = Math.abs(child.getBoundingClientRect().left - left);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

// Scrolls the track so its `index`-th slide starts at the track's left edge.
function scrollToSlide(track: HTMLElement, index: number) {
  const slide = track.children[index];
  if (!slide) return;
  const offset = slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
  track.scrollTo({ left: track.scrollLeft + offset, behavior: "smooth" });
}

/**
 * The slide picker for a horizontally swiped track (one slide per screen): one button
 * per slide, the visible one marked current. It follows the track's scroll, so a
 * swipe and a tap stay in sync, and keeps the right slide in view as the list
 * changes: a new slide is brought into view, and a reorder follows the slide that
 * was showing. Only shown where the track actually swipes (CSS); where it doesn't
 * (a wide grid) the scrolling is a no-op.
 */
export function SwipePager({
  track,
  items,
  label,
  hidden = false,
}: {
  track: RefObject<HTMLElement>;
  items: SwipePagerItem[];
  label: string;
  hidden?: boolean;
}) {
  const [active, setActive] = useState(0);
  const keys = items.map((item) => item.key);
  const keysRef = useRef(keys);
  // The slide on screen, by key: an index would point elsewhere after a reorder.
  const shownRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // A handful of slides: measuring on every scroll event is cheap.
    const onScroll = () => {
      const index = activeSlide(el);
      setActive(index);
      shownRef.current = keysRef.current[index];
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [track]);

  const signature = keys.join("\n");
  useLayoutEffect(() => {
    const prev = keysRef.current;
    keysRef.current = keys;
    const el = track.current;
    if (!el || prev.join("\n") === signature) return;
    const target = keys.find((key) => !prev.includes(key)) ?? shownRef.current;
    const index = target === undefined ? -1 : keys.indexOf(target);
    if (index >= 0) {
      setActive(index);
      scrollToSlide(el, index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, signature]);

  return (
    <nav className="swipe-pager" aria-label={label} hidden={hidden}>
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          className={"swipe-pager__item" + (i === active ? " swipe-pager__item--active" : "")}
          aria-label={item.label}
          aria-current={i === active ? "true" : undefined}
          onClick={() => track.current && scrollToSlide(track.current, i)}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
