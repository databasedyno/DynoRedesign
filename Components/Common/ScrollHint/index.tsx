/**
 * ScrollHint — the ONE shared horizontal-scroll affordance (§4.2 responsive rulebook).
 *
 * Two exports:
 *  - useEdgeFades(): attach `ref` to any horizontally-scrollable element; returns
 *    { showLeft, showRight } booleans kept in sync via scroll + ResizeObserver.
 *  - <EdgeFades/>: soft gradient overlays rendered INSIDE a `position:relative`
 *    wrapper AROUND the scroller (never inside it), so users always see there is
 *    more content to the side. Pointer-events are disabled — purely visual.
 *
 * Used by: pay-links / invoices / customers / transactions tables, the
 * transactions filter chip row, the settings tab rail and the dashboard KPI row.
 */
import React from "react";
import Box from "@mui/material/Box";
import { useTheme, alpha } from "@mui/material/styles";
import useEdgeFade from "@/hooks/useEdgeFade";

export function useEdgeFades<T extends HTMLElement = HTMLDivElement>() {
  // Thin wrapper over the shared measurement hook (hooks/useEdgeFade) so
  // tables (overlay/shadow hints) and chip rows (mask fades) stay in sync
  // from ONE scroll-measurement implementation.
  const f = useEdgeFade<T>();
  return {
    ref: f.ref as React.MutableRefObject<T | null>,
    showLeft: f.overflowing && !f.atStart,
    showRight: f.overflowing && !f.atEnd,
    update: f.remeasure,
  };
}

export const EdgeFades = ({
  showLeft,
  showRight,
  width = 28,
  zIndex = 6,
  color,
}: {
  showLeft: boolean;
  showRight: boolean;
  width?: number;
  zIndex?: number;
  /** Override the fade base color (defaults to background.paper). */
  color?: string;
}) => {
  const theme = useTheme();
  const base = color || theme.palette.background.paper;
  const common = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: `${width}px`,
    pointerEvents: "none" as const,
    zIndex,
    transition: "opacity 160ms ease",
  };
  return (
    <>
      <Box
        data-testid="scroll-fade-left"
        sx={{
          ...common,
          left: 0,
          opacity: showLeft ? 1 : 0,
          background: `linear-gradient(90deg, ${base} 0%, ${alpha(base, 0)} 100%)`,
        }}
      />
      <Box
        data-testid="scroll-fade-right"
        sx={{
          ...common,
          right: 0,
          opacity: showRight ? 1 : 0,
          background: `linear-gradient(270deg, ${base} 0%, ${alpha(base, 0)} 100%)`,
        }}
      />
    </>
  );
};

export default EdgeFades;
