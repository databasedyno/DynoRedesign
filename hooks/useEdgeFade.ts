import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useEdgeFade — swipe/scroll affordance for horizontal scrollers.
 *
 * Returns a `ref` to attach to the scroll container and a ready-to-spread
 * `maskImage`/`WebkitMaskImage` that softly fades ONLY the edge(s) that have
 * more content off-screen (fade-right when there's more to the right, fade-left
 * once scrolled). The mask collapses to `none` when the content fits, so it is
 * safe to apply unconditionally (it self-disables on wide/desktop layouts).
 *
 * Recomputes on scroll, container resize (ResizeObserver) and window resize.
 */
export interface EdgeFadeResult<T extends HTMLElement> {
  ref: React.RefObject<T>;
  maskImage: string;
  WebkitMaskImage: string;
  atStart: boolean;
  atEnd: boolean;
  overflowing: boolean;
  remeasure: () => void;
}

export default function useEdgeFade<T extends HTMLElement = HTMLDivElement>(
  fadePx = 28,
): EdgeFadeResult<T> {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState({ atStart: true, atEnd: true, overflowing: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth - clientWidth > 1;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 1;
    setState((prev) =>
      prev.atStart === atStart && prev.atEnd === atEnd && prev.overflowing === overflowing
        ? prev
        : { atStart, atEnd, overflowing },
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const fadeLeft = state.overflowing && !state.atStart;
  const fadeRight = state.overflowing && !state.atEnd;

  let maskImage = "none";
  if (fadeLeft || fadeRight) {
    const stops: string[] = [];
    stops.push(`${fadeLeft ? "transparent" : "#000"} 0`);
    if (fadeLeft) stops.push(`#000 ${fadePx}px`);
    if (fadeRight) stops.push(`#000 calc(100% - ${fadePx}px)`);
    stops.push(`${fadeRight ? "transparent" : "#000"} 100%`);
    maskImage = `linear-gradient(to right, ${stops.join(", ")})`;
  }

  return {
    ref: ref as React.RefObject<T>,
    maskImage,
    WebkitMaskImage: maskImage,
    atStart: state.atStart,
    atEnd: state.atEnd,
    overflowing: state.overflowing,
    remeasure: measure,
  };
}
