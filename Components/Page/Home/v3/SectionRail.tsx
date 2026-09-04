import { FC } from "react";
import { Box, alpha } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAurora, FONT_TECH } from "./theme.v3";
import { LANDING_SECTIONS, jumpToSection } from "./landingSections";

interface Props {
  active: string | null;
  visible: boolean;
}

/**
 * Desktop section rail — slim dot navigator fixed on the right edge. Labels
 * slide in on hover; the active dot stretches into an indigo pill and keeps
 * its label. Hidden below `md` (the chip bar takes over there).
 */
export const SectionRail: FC<Props> = ({ active, visible }) => {
  const { t } = useTranslation("landing");
  const s = useAurora();
  const accent = s.dark ? "#818CF8" : s.indigo;

  return (
    <Box
      component="nav"
      aria-label={t("v3.nav.aria")}
      data-testid="landing-section-rail"
      data-visible={visible ? "true" : "false"}
      sx={{
        position: "fixed",
        right: { md: 18, lg: 26 },
        top: "50%",
        transform: visible ? "translateY(-50%)" : "translate(12px, -50%)",
        zIndex: 1200,
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1.25,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 280ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1)",
        "&:hover .rail-label": { opacity: 1, transform: "translateX(0)" },
      }}
    >
      {LANDING_SECTIONS.map(({ id, key }) => {
        const isActive = active === id;
        return (
          <Box
            key={id}
            component="button"
            type="button"
            onClick={() => jumpToSection(id)}
            aria-label={t(`v3.nav.${key}`)}
            aria-current={isActive ? "location" : undefined}
            data-testid={`rail-dot-${id}`}
            sx={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              py: 0.25,
              "&:focus-visible .rail-dot": { outline: `2px solid ${accent}`, outlineOffset: 3 },
              "&:hover .rail-dot": { background: isActive ? accent : alpha(s.ink, 0.6) },
            }}
          >
            <Box
              className="rail-label"
              sx={{
                fontFamily: FONT_TECH,
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: isActive ? accent : s.ink2,
                opacity: isActive ? 1 : 0,
                transform: isActive ? "translateX(0)" : "translateX(6px)",
                transition: "opacity 200ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1), color 200ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {t(`v3.nav.${key}`)}
            </Box>
            <Box
              className="rail-dot"
              sx={{
                width: 8,
                height: isActive ? 26 : 8,
                borderRadius: 999,
                background: isActive ? accent : alpha(s.ink, 0.22),
                transition: "height 320ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease",
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default SectionRail;
