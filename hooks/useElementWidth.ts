import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Width of an element (ResizeObserver). Lists use it to pick card / condensed / full layouts by
 * CONTAINER width (blueprint §8.4) instead of the viewport, so the collapsed sidebar, the
 * labelled rail and ultra-wide caps are all accounted for. 0 until measured.
 */
export default function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(node);
    roRef.current = ro;
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  return { ref, width };
}
