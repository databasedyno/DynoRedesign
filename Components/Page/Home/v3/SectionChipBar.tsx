import { FC, useEffect, useRef } from "react";
import { Box, alpha } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAurora, FONT_TECH } from "./theme.v3";
import { LANDING_SECTIONS, jumpToSection } from "./landingSections";

interface Props {
  active: string | null;
  visible: boolean;
  /** Bottom of the fixed header; the bar docks right under it (or at the top when it hides). */
  top: number;
}

/**
 * Mobile / tablet section chip bar — a frosted strip docked under the site
 * header once the hero is scrolled away. Horizontally scrollable; the active
 * chip is auto-centred. Hidden from `md` up (the rail takes over there).
 */
export const SectionChipBar: FC<Props> = ({ active, visible, top }) => {
  const { t } = useTranslation("landing");
  const s = useAurora();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !scrollerRef.current) return;
    const chip = scrollerRef.current.querySelector<HTMLElement>(`[data-section="${active}"]`);
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <Box
      component="nav"
      aria-label={t("v3.nav.aria")}
      data-testid="landing-chip-bar"
      data-visible={visible ? "true" : "false"}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        top,
        zIndex: 1500,
        display: { xs: "block", md: "none" },
        transform: visible ? "translateY(0)" : "translateY(-110%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "top 320ms cubic-bezier(0.16,1,0.3,1), transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 240ms ease",
        backgroundColor: s.dark ? "rgba(11,11,15,0.78)" : "rgba(250,250,247,0.88)",
        backdropFilter: "blur(14px) saturate(1.2)",
        WebkitBackdropFilter: "blur(14px) saturate(1.2)",
        borderBottom: `1px solid ${s.line}`,
      }}
    >
      <Box
        ref={scrollerRef}
        sx={{
          display: "flex",
          gap: 1,
          px: 2,
          py: 1.25,
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          WebkitOverflowScrolling: "touch",
        }}
      >
        {LANDING_SECTIONS.map(({ id, key }) => {
          const isActive = active === id;
          return (
            <Box
              key={id}
              component="button"
              type="button"
              data-section={id}
              data-testid={`chip-${id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={() => jumpToSection(id)}
              sx={{
                all: "unset",
                cursor: "pointer",
                flex: "0 0 auto",
                fontFamily: FONT_TECH,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 500,
                lineHeight: 1,
                px: 1.5,
                py: 1,
                borderRadius: 999,
                border: `1px solid ${isActive ? "transparent" : s.line}`,
                color: isActive ? (s.dark ? s.bg : "#FFFFFF") : s.ink2,
                background: isActive ? (s.dark ? "#FFFFFF" : s.ink) : alpha(s.ink, 0.02),
                transition: "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
                "&:focus-visible": { outline: `2px solid ${s.indigo}`, outlineOffset: 2 },
              }}
            >
              {t(`v3.nav.${key}`)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default SectionChipBar;
