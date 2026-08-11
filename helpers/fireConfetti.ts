/**
 * fireConfetti — a small, brand-palette celebratory burst.
 *
 * Lazy-loads canvas-confetti (never touches the SSR bundle), honours
 * prefers-reduced-motion, and self-throttles so rapid repeat calls don't
 * stack. Used for delightful "money-in" moments (checkout success, a payment
 * settling on the dashboard, etc).
 */
let firing = false;

export async function fireConfetti(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  if (firing) return;
  firing = true;
  try {
    const mod = await import("canvas-confetti");
    const confetti = mod.default;
    // Brand aurora + success green + white.
    const colors = ["#5A6BEF", "#7C5CFF", "#4FD1FF", "#3FD98A", "#FFFFFF"];
    const fire = (particleRatio: number, opts: Record<string, unknown>) =>
      confetti({
        origin: { y: 0.7 },
        colors,
        disableForReducedMotion: true,
        zIndex: 2000,
        particleCount: Math.floor(200 * particleRatio),
        ...opts,
      });
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  } catch {
    /* confetti is non-critical — ignore load failures */
  } finally {
    setTimeout(() => {
      firing = false;
    }, 1500);
  }
}

export default fireConfetti;
