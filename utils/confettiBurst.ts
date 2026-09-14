/**
 * confettiBurst — shared celebration burst for the public money surfaces.
 *
 * Used when:
 *   • a supporter's tip/payment is CONFIRMED (InlineTipCheckout)
 *   • a crowdfunding campaign is viewed in its GOAL-REACHED state (GoalProgressBar)
 *
 * Design notes:
 *   • canvas-confetti is dynamically imported so it never lands in the SSR or
 *     initial JS bundle (it's ~6KB, loaded only at the celebratory moment).
 *   • Respects prefers-reduced-motion (skips entirely).
 *   • Debounced — repeated triggers within ~1.2s collapse into one burst.
 *   • NEVER throws: a confetti failure must not break a payment flow.
 */

let firing = false

export interface ConfettiBurstOptions {
  /** Normalized viewport origin (0..1). Default: slightly above center. */
  origin?: { x: number; y: number }
  colors?: string[]
}

// Brand palette: aurora indigo → violet + periwinkle, with emerald + gold accents.
const BRAND_COLORS = ['#6366F1', '#7C3AED', '#A5B4FC', '#34D399', '#FCD34D']

export async function fireConfettiBurst(opts?: ConfettiBurstOptions): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
  } catch { /* matchMedia unavailable — continue */ }
  if (firing) return
  firing = true

  try {
    const confetti = (await import('canvas-confetti')).default
    const colors = opts?.colors || BRAND_COLORS
    const origin = opts?.origin || { x: 0.5, y: 0.4 }
    const base = { colors, zIndex: 2000, disableForReducedMotion: true }

    // Center pop + two staggered side fans = a brief, premium "moment"
    confetti({ ...base, particleCount: 80, spread: 70, startVelocity: 42, origin })
    window.setTimeout(() => {
      confetti({ ...base, particleCount: 45, spread: 100, scalar: 0.9, origin: { x: Math.max(0, origin.x - 0.14), y: origin.y } })
    }, 180)
    window.setTimeout(() => {
      confetti({ ...base, particleCount: 45, spread: 100, scalar: 0.9, origin: { x: Math.min(1, origin.x + 0.14), y: origin.y } })
    }, 320)
  } catch {
    /* confetti is decorative — swallow every failure */
  } finally {
    window.setTimeout(() => { firing = false }, 1200)
  }
}

export default fireConfettiBurst
