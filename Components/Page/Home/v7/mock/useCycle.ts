import { RefObject, useEffect, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Loops 0..n-1 with a per-step dwell (ms); `loops` counts completed cycles. Holds the final step under reduced-motion; pauses off-screen. */
export const useCycle = (ref: RefObject<Element | null>, dwell: readonly number[]) => {
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.25 });
  const [state, setState] = useState({ step: 0, loops: 0 });
  useEffect(() => {
    if (reduce) {
      setState((s) => ({ ...s, step: dwell.length - 1 }));
      return;
    }
    if (!inView) return;
    const t = setTimeout(
      () => setState(({ step, loops }) => (step + 1 < dwell.length ? { step: step + 1, loops } : { step: 0, loops: loops + 1 })),
      dwell[state.step],
    );
    return () => clearTimeout(t);
  }, [state.step, reduce, inView, dwell]);
  return state;
};
