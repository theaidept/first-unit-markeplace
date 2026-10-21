import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal rail. Loops a duplicated strip so 2–15 items keep sliding
 * without running off the end. Arrows nudge one card and never scroll past the seam.
 */
export function SlideRail({ children, label = "items", autoplay = true, speed = 32, gap = 18, className = "" }) {
  const scroller = useRef(null);
  const hover = useRef(false);
  const holdUntil = useRef(0);
  const tween = useRef(0);
  const [ready, setReady] = useState(false);

  const items = Children.toArray(children).filter(Boolean);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const looping = autoplay && !reduce && items.length > 1;

  const stamp = (list, prefix) => list.map((child, i) => {
    if (!isValidElement(child)) return child;
    const extra = prefix === "b" && i === 0 ? { "data-loop-start": "true" } : {};
    return cloneElement(child, { key: `${prefix}-${i}`, ...extra });
  });
  // Three copies so a short row (4 categories, 5 stories) is still wider than the
  // viewport and can loop. A full set of 10–15 items slides the same way.
  const rendered = looping
    ? [...stamp(items, "a"), ...stamp(items, "b"), ...stamp(items, "c")]
    : stamp(items, "a");

  const halfLeft = () => {
    const el = scroller.current;
    if (!el) return 0;
    const mark = el.querySelector("[data-loop-start]");
    return mark ? mark.offsetLeft : el.scrollWidth / 2;
  };

  const cardStep = () => {
    const el = scroller.current;
    if (!el) return 240;
    const card = el.querySelector(".slide-track > *");
    const track = el.querySelector(".slide-track");
    const styles = track ? getComputedStyle(track) : null;
    const g = parseFloat(styles?.columnGap || styles?.gap || "") || gap;
    return (card?.getBoundingClientRect().width || 220) + g;
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    setReady(true);
    const wrap = () => {
      if (!looping) return;
      const mark = el.querySelector("[data-loop-start]");
      const half = mark ? mark.offsetLeft : el.scrollWidth / 2;
      if (half > 8 && el.scrollLeft >= half) el.scrollLeft -= half;
    };
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const held = hover.current || performance.now() < holdUntil.current || document.hidden;
      if (looping && !held) {
        el.scrollLeft += speed * dt;
        wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    if (looping) raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => wrap());
    ro.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [looping, speed, items.length]);

  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    holdUntil.current = performance.now() + 2200;
    const step = cardStep();
    const half = looping ? halfLeft() : 0;
    let pos = el.scrollLeft;
    // Hop one full loop when sliding left from the start. The duplicate strip
    // looks identical, so the hop is invisible and the next move stays smooth.
    if (looping && dir < 0 && pos < step && half > 8) {
      pos += half;
      el.scrollLeft = pos;
    }
    let next = pos + dir * step;
    if (!looping) {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      next = Math.max(0, Math.min(max, next));
    } else if (next < 0 && half > 8) {
      next += half;
    }
    const from = pos;
    const to = Math.max(0, next);
    if (reduce) {
      el.scrollLeft = to;
      return;
    }
    const start = performance.now();
    const id = ++tween.current;
    const run = (now) => {
      if (tween.current !== id) return;
      const node = scroller.current;
      if (!node) return;
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      node.scrollLeft = from + (to - from) * eased;
      if (t < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };

  return (
    <div
      className={`slide-rail ${className}`}
      onMouseEnter={() => { hover.current = true; }}
      onMouseLeave={() => { hover.current = false; }}
    >
      <button
        type="button"
        className="slide-arrow prev"
        aria-label={`Slide ${label} left`}
        disabled={!ready || items.length < 2}
        onClick={() => nudge(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="slide-viewport" ref={scroller}>
        <div className="slide-track" style={{ gap }}>{rendered}</div>
      </div>
      <button
        type="button"
        className="slide-arrow next"
        aria-label={`Slide ${label} right`}
        disabled={!ready || items.length < 2}
        onClick={() => nudge(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
