import type { KeyboardEvent } from "react";

/** Makes a clickable row/card keyboard-operable: focusable, announced as a button, Enter/Space activate. */
export const rowKeyProps = (onActivate: () => void, label?: string) => ({
  role: "button" as const,
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
