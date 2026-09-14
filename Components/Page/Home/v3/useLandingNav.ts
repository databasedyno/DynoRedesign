import { useEffect, useState } from "react";

interface LandingNavState {
  active: string | null;
  pastHero: boolean;
  /** Bottom edge of the fixed site header (0 while it is auto-hidden). */
  headerBottom: number;
}

/**
 * Scroll-spy for the landing navigators. The active section is the last one
 * whose top has crossed the upper 40% of the viewport. rAF-throttled, passive.
 */
export function useLandingNav(ids: readonly string[]): LandingNavState {
  const [state, setState] = useState<LandingNavState>({ active: null, pastHero: false, headerBottom: 0 });

  useEffect(() => {
    let ticking = false;
    const header = document.querySelector<HTMLElement>("header");

    const compute = () => {
      ticking = false;
      const probe = window.innerHeight * 0.4;
      // Last section whose top crossed the probe; while the navigators are
      // shown but nothing has crossed yet, the first section is "up next".
      let active: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) active = id;
      }
      const pastHero = window.scrollY > window.innerHeight * 0.7;
      if (!active && pastHero) active = ids[0] ?? null;
      const headerBottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
      setState((prev) =>
        prev.active === active && prev.pastHero === pastHero && prev.headerBottom === headerBottom
          ? prev
          : { active, pastHero, headerBottom },
      );
    };
    const schedule = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    header?.addEventListener("transitionend", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      header?.removeEventListener("transitionend", schedule);
    };
  }, [ids]);

  return state;
}
