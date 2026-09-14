import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { coinIcon, relTime, useOnchainProof } from "./useLandingProof";

const shortHash = (h: string): string => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);

/** "Verify on-chain" — a few REAL settlements from our own store, each opening on a public explorer. */
const OnchainProofV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const proofs = useOnchainProof(4);
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const list = proofs && proofs.length ? proofs : [];

  return (
    <Section id="onchain" testId="onchain-proof">
      <SectionHead eyebrow={t("v5.onchain.eyebrow")} headline={t("v5.onchain.headline")} body={t("v5.onchain.body")} />
      <Stagger step={0.06} data-testid="onchain-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: { xs: 1.75, md: 2 } }}>
        {list.map((p, i) => {
          const ci = coinIcon(p.symbol);
          return (
            <StaggerItem key={`${p.txHash}-${i}`} i={i} y={16}>
              <Box
                component="a"
                href={p.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`onchain-proof-${i}`}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  textDecoration: "none",
                  borderRadius: "18px",
                  background: s.surface,
                  border: `1px solid ${s.line}`,
                  p: { xs: 2.5, md: 2.75 },
                  transition: "transform 200ms cubic-bezier(.16,1,.3,1), border-color 200ms ease, box-shadow 200ms ease",
                  "&:hover": { transform: "translateY(-3px)", borderColor: `${BRAND_ACCENT}66`, boxShadow: `0 24px 48px -30px ${BRAND_ACCENT}66` },
                  "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, flexShrink: 0 }}>
                    <Icon icon={ci.icon} width={22} height={22} color={ci.color} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15.5, color: s.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
                      {t("v5.onchain.settledOn", { symbol: p.symbol, network: p.network })}
                    </Typography>
                    <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, mt: 0.25 }}>
                      {relTime(p.at, t)}
                    </Typography>
                  </Box>
                </Box>
                <Box className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink2, background: s.bgAlt, border: `1px solid ${s.line}`, borderRadius: "8px", px: 1.25, py: 0.85, mb: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shortHash(p.txHash)}
                </Box>
                <Box sx={{ mt: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: s.ink3 }}>
                    <VerifiedRoundedIcon sx={{ fontSize: 14, color: "#10B981" }} />
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t("v5.onchain.ownStore")}</Typography>
                  </Box>
                  <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: accent, "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover &  svg": { transform: "translate(2px, -2px)" } }}>
                    {t("v5.onchain.verify")} <ArrowOutwardRoundedIcon sx={{ fontSize: 15 }} />
                  </Typography>
                </Box>
              </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
};

export default memo(OnchainProofV5);
