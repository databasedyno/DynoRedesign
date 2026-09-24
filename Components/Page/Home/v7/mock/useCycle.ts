import { RefObject, useEffect, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Loops 0..n-1 with a per-step dwell (ms). Holds the final step under reduced-motion; pauses off-screen. */
export const useCycle = (ref: RefObject<Element | null>, dwell: readonly number[]) => {
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.25 });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) {
      setI(dwell.length - 1);
      return;
    }
    if (!inView) return;
    const t = setTimeout(() => setI((v) => (v + 1) % dwell.length), dwell[i]);
    return () => clearTimeout(t);
  }, [i, reduce, inView, dwell]);
  return i;
};
