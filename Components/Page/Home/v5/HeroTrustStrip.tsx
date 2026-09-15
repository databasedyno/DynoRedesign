import React from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { FONT_TECH, useAurora } from "../v3/theme.v3";

const FACTS = [
  { id: "noncustodial", icon: "mdi:shield-lock-outline", href: "/about#about-legitimacy", key: "nonCustodial", dflt: "Non-custodial" },
  { id: "coins", icon: "mdi:hexagon-multiple-outline", href: "/fees", key: "coins", dflt: "15 coins" },
  { id: "fees", icon: "mdi:percent-outline", href: "/fees", key: "fees", dflt: "Fees from 0.5%" },
  { id: "since", icon: "mdi:calendar-check-outline", href: "/about", key: "since", dflt: "Since 2024" },
];

/** Slim static trust facts under the hero CTAs — every pill deep-links to the page that proves it. */
const HeroTrustStrip = ({ enter }: { enter?: object }) => {
  const { t } = useTranslation("landing");
  const s = useAurora();
  return (
    <Box data-testid="hero-trust-strip" sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5, justifyContent: { xs: "center", md: "flex-start" }, ...(enter || {}) }}>
      {FACTS.map((f) => (
        <Link key={f.id} href={f.href} passHref legacyBehavior>
          <Box
            component="a"
            data-testid={`hero-trust-${f.id}`}
            sx={{
              display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.4, py: 0.55, borderRadius: "999px",
              border: `1px solid ${s.line}`, background: s.dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
              color: s.ink2, textDecoration: "none", fontFamily: FONT_TECH, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              transition: "border-color 160ms ease, transform 160ms ease, color 160ms ease",
              "&:hover": { borderColor: s.lineStrong, color: s.ink, transform: "translateY(-1px)" },
            }}
          >
            <Icon icon={f.icon} width={15} />
            {t(`v5.hero.trust.${f.key}`, { defaultValue: f.dflt })}
          </Box>
        </Link>
      ))}
    </Box>
  );
};

export default HeroTrustStrip;
