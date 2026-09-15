import type { KeyboardEvent } from "react";

/** Makes a clickable row/card keyboard-operable: focusable, Enter/Space activate.
 *  No role="button": rows usually contain their own buttons/links (WCAG nested-interactive). */
export const rowKeyProps = (onActivate: () => void, label?: string) => ({
  tabIndex: 0,
  "aria-label": label,
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  },
});
