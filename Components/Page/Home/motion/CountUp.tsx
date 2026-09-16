import { FC, useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface Props {
  /** null while the metric is still loading → renders `placeholder`. */
  to: number | null;
  render: (n: number) => string;
  duration?: number;
  placeholder?: string;
  /** Count-up start value (defaults to 40% of `to`). Never 0, never negative. */
  from?: number;
}

type State = "pending" | "static" | "running" | "done";

/**
 * Live number. The REAL value is in the server HTML and on first paint (crawlers
 * and no-JS visitors read it too). Only a number that scrolls INTO view later
 * counts up (`from` → `to`); anything already on screen at mount stays put, so a
 * zero/negative placeholder is never visible. Reduced motion = no animation.
 */
export const CountUp: FC<Props> = ({ to, render, duration = 1.1, placeholder = "—", from }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const reduced = useReducedMotion();
  const [n, setN] = useState<number | null>(to);
  const [state, setState] = useState<State>(to == null ? "pending" : "static");
  const visibleAtMount = useRef<boolean | null>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (visibleAtMount.current != null || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    visibleAtMount.current = r.top < window.innerHeight && r.bottom > 0;
  }, []);

  // Value arrives (or changes) before any animation ran → show it as-is.
  useEffect(() => {
    if (to == null || animated.current) return;
    setN(to);
    setState(visibleAtMount.current ? "done" : "static");
  }, [to]);

  useEffect(() => {
    if (to == null || !inView || animated.current) return;
    animated.current = true;
    if (visibleAtMount.current !== false || reduced) {
      setN(to);
      setState("done");
      return;
    }
    const start = Math.max(0, from ?? to * 0.4);
    const t0 = performance.now();
    let raf = 0;
    setState("running");
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / (duration * 1000)));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(start + (to - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setState("done");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, inView, reduced, duration, from]);

  return (
    <span ref={ref} data-countup={to == null ? "pending" : state}>
      {to == null ? placeholder : render(n ?? to)}
    </span>
  );
};
