import React, { useEffect, useState } from "react";
import { Box, useTheme } from "@mui/material";

/**
 * Compact title bar (§8.3): once the page's large title scrolls out of view a
 * slim bar with the title slides in at the top of the scroll area. Zero layout
 * height (sticky 0-height anchor), so nothing jumps when it appears.
 */
const CompactTitleBar: React.FC<{
  title: string;
  watch: React.RefObject<HTMLElement>;
  root: React.RefObject<HTMLElement>;
  /** The content column's phone gutter in px (the bar bleeds edge-to-edge by exactly this much). */
  phoneGutter?: number;
}> = ({ title, watch, root, phoneGutter = 16 }) => {
  const theme = useTheme();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = watch.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), { root: root.current, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watch, root, title]);
  const isDark = theme.palette.mode === "dark";
  return (
    <Box aria-hidden={!shown} sx={{ position: "sticky", top: 0, height: 0, zIndex: 20, "&&": { maxWidth: "none" } }}>
      <Box
        data-testid="compact-title-bar"
        data-shown={shown ? "true" : "false"}
        sx={{
          position: "absolute",
          top: 0,
          left: { xs: -phoneGutter, md: -32 },
          right: { xs: -phoneGutter, md: -32 },
          height: { xs: 44, md: 48 },
          display: "flex",
          alignItems: "center",
          px: { xs: 2, md: 4 },
          backgroundColor: theme.palette.secondary.main,
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.08)"}`,
          boxShadow: "0 10px 14px -14px rgba(10,10,15,0.35)",
          transform: shown ? "translateY(0)" : "translateY(-100%)",
          opacity: shown ? 1 : 0,
          pointerEvents: shown ? "auto" : "none",
          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Box
          component="span"
          onClick={() => root.current?.scrollTo({ top: 0, behavior: "smooth" })}
          sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontSize: 16, fontWeight: 700, color: theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
        >
          {title}
        </Box>
      </Box>
    </Box>
  );
};

export default CompactTitleBar;
