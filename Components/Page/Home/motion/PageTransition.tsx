import { FC, ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { EASE_OUT } from "./tokens";

/**
 * Marketing-shell route transition: each new page fades/slides in (Nuxt-style
 * `page` transition on hostinger.com). Enter-only by design — no exit phase, so
 * the footer never collapses and Next's scroll-to-top stays untouched. The very
 * first paint (SSR/hydration) is never animated (LCP-safe).
 */
export const PageTransition: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  const route = router.asPath.split(/[?#]/)[0];
  return (
    <motion.div
      key={route}
      data-testid="page-transition"
      data-route={route}
      initial={first.current ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      {children}
    </motion.div>
  );
};
