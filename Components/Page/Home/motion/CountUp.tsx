import { FC, useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface Props {
  /** null while the metric is still loading → renders `placeholder`. */
  to: number | null;
  render: (n: number) => string;
  duration?: number;
  placeholder?: string;
}

/** Counts 0 → `to` the first time it is on screen (Hostinger "5M+ creators"). Final value at once under reduced motion. */
export const CountUp: FC<Props> = ({ to, render, duration = 1.3, placeholder = "—" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const reduced = useReducedMotion();
  const [n, setN] = useState<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (to == null || !inView || started.current) return;
    started.current = true;
    if (reduced) {
      setN(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, inView, reduced, duration]);

  const done = to != null && n != null && n >= to;
  return (
    <span ref={ref} data-countup={to == null ? "pending" : done ? "done" : "running"}>
      {to == null ? placeholder : render(n ?? 0)}
    </span>
  );
};
