import { CSSProperties, FC, ReactNode, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, type UseInViewOptions } from "framer-motion";

export const REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  margin?: UseInViewOptions["margin"];
  style?: CSSProperties;
  className?: string;
  "data-testid"?: string;
}

const VISIBLE = { opacity: 1, y: 0 };

/**
 * Scroll reveal that plays ONCE (2026-09 landing re-imagining: sections no
 * longer fade out again on the way back up — motion is a welcome, not noise).
 * SSR ships the content VISIBLE (crawlers / no-JS / hydration-safe); after
 * mount, blocks already on screen stay put and off-screen blocks are parked
 * hidden until they scroll in. Honours prefers-reduced-motion.
 */
export const Reveal: FC<RevealProps> = ({
  children,
  delay = 0,
  y = 24,
  margin = "0px 0px -10% 0px",
  style,
  className,
  "data-testid": testId,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { margin, once: true });
  const [mounted, setMounted] = useState(false);
  const [holdVisible, setHoldVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setHoldVisible(r.top < vh * 0.9 && r.bottom > 0);
    }
    setMounted(true);
  }, []);

  const show = !mounted || !!reduced || inView || holdVisible;

  return (
    <div ref={ref} style={style} className={className} data-testid={testId} data-reveal={show ? "in" : "out"}>
      <motion.div initial={false} animate={show ? VISIBLE : { opacity: 0, y }} transition={show ? { duration: 0.25, delay, ease: REVEAL_EASE } : { duration: 0 }} style={{ height: "100%" }}>
        {children}
      </motion.div>
    </div>
  );
};

export default Reveal;
