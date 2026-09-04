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
 * Scroll-linked reveal that replays in BOTH directions (fades/slides in when a
 * block scrolls into view, out again when it leaves). The outer div is the
 * IntersectionObserver target and never transforms, so the animated inner
 * layer cannot flap at the viewport edge.
 *
 * SSR ships the content VISIBLE (crawlers / no-JS / hydration-safe); the client
 * takes over after mount: blocks already on screen stay put, off-screen blocks
 * are parked hidden until they scroll in. Honours prefers-reduced-motion.
 */
export const Reveal: FC<RevealProps> = ({
  children,
  delay = 0,
  y = 28,
  margin = "-12% 0px -12% 0px",
  style,
  className,
  "data-testid": testId,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { margin });
  const [mounted, setMounted] = useState(false);
  const [holdVisible, setHoldVisible] = useState(false);
  const shownOnce = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setHoldVisible(r.top < vh * 0.88 && r.bottom > vh * 0.12);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (inView) setHoldVisible(false);
  }, [inView]);

  const show = !mounted || !!reduced || inView || holdVisible;
  const hidden = { opacity: 0, y };
  const transition = show
    ? { duration: 0.7, delay, ease: REVEAL_EASE }
    : shownOnce.current
      ? { duration: 0.4, ease: "easeOut" as const }
      : { duration: 0 };
  if (show && mounted) shownOnce.current = true;

  return (
    <div ref={ref} style={style} className={className} data-testid={testId} data-reveal={show ? "in" : "out"}>
      <motion.div initial={false} animate={show ? VISIBLE : hidden} transition={transition} style={{ height: "100%" }}>
        {children}
      </motion.div>
    </div>
  );
};

export default Reveal;
