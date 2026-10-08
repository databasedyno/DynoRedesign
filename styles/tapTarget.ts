/**
 * Layout-neutral target sizing — UX audit S18 / blueprint §8.10 "Targets".
 *
 *   fine pointer (mouse / trackpad)  ≥ 24 px   (WCAG 2.2 · 2.5.8)
 *   coarse pointer (touch)           ≥ 44 px   (Apple HIG / Material)
 *
 * The control's OWN box grows (that is what hit-testing and the layout audit measure — an
 * `::after` slop is clipped by `overflow:hidden` ancestors) and an equal negative margin
 * gives the space back, so nothing around the control moves. Use for text links, text
 * buttons and tiny icon buttons that have no visible background/border at rest.
 *
 * All values are px strings on purpose: numeric padding/margin in `sx` is multiplied by
 * `theme.spacing`.
 */
export const TAP_FINE = 24;
export const TAP_COARSE = 44;

const grow = (natural: number, target: number) => Math.max(0, Math.ceil((target - natural) / 2));
const px = (n: number) => `${n}px`;

/**
 * Grow vertically only — text links / text buttons whose width already clears the target.
 * @param natural current rendered height in px (incl. its own vertical padding)
 * @param padY    the element's existing vertical padding in px (kept)
 */
export const tapY = (natural: number, padY = 0) => {
  const f = grow(natural, TAP_FINE);
  const c = grow(natural, TAP_COARSE);
  return {
    paddingTop: px(padY + f),
    paddingBottom: px(padY + f),
    marginTop: px(-f),
    marginBottom: px(-f),
    "@media (pointer: coarse)": {
      paddingTop: px(padY + c),
      paddingBottom: px(padY + c),
      marginTop: px(-c),
      marginBottom: px(-c),
    },
  };
};

/**
 * Grow on both axes — tiny icon buttons / ⓘ hints.
 * @param natural current rendered square size in px (incl. its own padding)
 * @param pad     the element's existing padding in px (kept)
 * @param marginX extra horizontal margin the element already had (e.g. `ml: 0.5` → 4)
 */
export const tapXY = (natural: number, pad = 0, marginX: { left?: number; right?: number } = {}) => {
  const f = grow(natural, TAP_FINE);
  const c = grow(natural, TAP_COARSE);
  const l = marginX.left ?? 0;
  const r = marginX.right ?? 0;
  return {
    padding: px(pad + f),
    margin: `${px(-f)} ${px(r - f)} ${px(-f)} ${px(l - f)}`,
    "@media (pointer: coarse)": {
      padding: px(pad + c),
      margin: `${px(-c)} ${px(r - c)} ${px(-c)} ${px(l - c)}`,
    },
  };
};
