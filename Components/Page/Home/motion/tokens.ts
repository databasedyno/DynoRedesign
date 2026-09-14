import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* Landing motion tokens (2026-09, modelled on hostinger.com's live CSS):
 * ease-out-quint entrances 300–500ms, 8–24px offsets, stagger via index delay. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_SNAP: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const REVEAL_MARGIN = "0px 0px -10% 0px";
export const REDUCED_MQ = "@media (prefers-reduced-motion: reduce)";

/** true once mounted on the client AND the visitor has not asked for reduced motion. */
export const useMotionOK = (): boolean => {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && !reduced;
};
