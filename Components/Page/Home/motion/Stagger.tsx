import { CSSProperties, FC, ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { Box, BoxProps } from "@mui/material";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE_OUT, REVEAL_MARGIN } from "./tokens";

interface Ctx {
  show: boolean;
  step: number;
  base: number;
}
const StaggerCtx = createContext<Ctx>({ show: true, step: 0.07, base: 0 });

interface StaggerProps {
  children: ReactNode;
  /** Seconds between consecutive items (Hostinger uses ~0.05–0.1). */
  step?: number;
  base?: number;
  sx?: BoxProps["sx"];
  component?: BoxProps["component"];
  role?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

/**
 * Scroll-triggered cascade: `<StaggerItem i>` children enter one after another
 * (Hostinger's `.anim-in { --d: n }`). Plays ONCE. SSR ships everything visible;
 * after mount, blocks already on screen stay put and off-screen blocks park hidden
 * until they scroll in. Honours prefers-reduced-motion.
 */
export const Stagger: FC<StaggerProps> = ({ children, step = 0.07, base = 0, sx, component, role, "aria-label": ariaLabel, "data-testid": testId }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { margin: REVEAL_MARGIN, once: true });
  const [mounted, setMounted] = useState(false);
  const [holdVisible, setHoldVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setHoldVisible(r.top < window.innerHeight * 0.9 && r.bottom > 0);
    }
    setMounted(true);
  }, []);

  const show = !mounted || !!reduced || inView || holdVisible;

  return (
    <Box ref={ref} component={component} role={role} aria-label={ariaLabel} sx={sx} data-testid={testId} data-stagger={show ? "in" : "out"}>
      <StaggerCtx.Provider value={{ show, step, base }}>{children}</StaggerCtx.Provider>
    </Box>
  );
};

interface ItemProps {
  i: number;
  children: ReactNode;
  y?: number;
  style?: CSSProperties;
  className?: string;
}

/** One cascading child. `display:grid` keeps the wrapped card stretching like a bare grid/flex item would. */
export const StaggerItem: FC<ItemProps> = ({ i, children, y = 18, style, className }) => {
  const { show, step, base } = useContext(StaggerCtx);
  return (
    <motion.div
      className={className}
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={show ? { duration: 0.5, delay: base + i * step, ease: EASE_OUT } : { duration: 0 }}
      style={{ display: "grid", minWidth: 0, ...style }}
    >
      {children}
    </motion.div>
  );
};
