import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { coinIcon, relTime, useOnchainProof } from "../v5/useLandingProof";
import { useLandingMetrics } from "../v5/useLandingMetrics";

const shortHash = (h: string): string => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);

const Cta: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
  <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: accent, "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover & svg": { transform: "translate(2px,-2px)" } }}>
    {label} <ArrowOutwardRoundedIcon sx={{ fontSize: 15 }} />
  </Typography>
);

/** §2.3-6 Proof — "Verify it yourself": real on-chain settlements + the open surfaces. Merchant stories ship hidden (no content yet). */
const ProofV6: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const proofs = useOnchainProof(4) ?? [];
  const m = useLandingMetrics();
  const accent = s.dark ? "#2BD4C4" : BRAND_ACCENT;
  const OPEN = [
    { id: "status", Icon: MonitorHeartRoundedIcon, title: t("v5.open.statusT"), desc: t("v5.open.statusD"), cta: t("v5.open.statusCta"), href: "/system-status", meta: m ? `${m.uptime_90d_pct.toFixed(2)}% · 90d` : null },
    { id: "docs", Icon: MenuBookRoundedIcon, title: t("v5.open.docsT"), desc: t("v5.open.docsD"), cta: t("v5.open.docsCta"), href: "/documentation", meta: "GET /api/docs" },
    { id: "langs", Icon: TranslateRoundedIcon, title: t("v6.proof.langsT"), desc: t("v6.proof.langsD"), cta: t("v6.proof.langsCta"), href: "/pay/demo", meta: "EN · DE · ES · FR · PT · NL" },
  ];
  return (
    <Section id="proof" alt testId="proof">
      <SectionHead eyebrow={t("v5.open.eyebrow")} headline={t("v5.open.headline")} body={t("v5.onchain.body")} />
      <Stagger step={0.06} data-testid="onchain-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: { xs: 1.75, md: 2 } }}>
        {proofs.map((p, i) => {
          const ci = coinIcon(p.symbol);
          return (
            <StaggerItem key={`${p.txHash}-${i}`} i={i} y={16}>
              <Box component="a" href={p.explorerUrl} target="_blank" rel="noopener noreferrer" data-testid={`onchain-proof-${i}`} sx={{ ...cardSx(s, { radius: 20 }), display: "flex", flexDirection: "column", height: "100%", textDecoration: "none", p: { xs: 2.5, md: 2.75 }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, flexShrink: 0 }}><Icon icon={ci.icon} width={22} height={22} color={ci.color} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15.5, color: s.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{t("v5.onchain.settledOn", { symbol: p.symbol, network: p.network })}</Typography>
                    <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, mt: 0.25 }}>{relTime(p.at, t)}</Typography>
                  </Box>
                </Box>
                <Box className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink2, background: s.bgAlt, border: `1px solid ${s.line}`, borderRadius: "8px", px: 1.25, py: 0.85, mb: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortHash(p.txHash)}</Box>
                <Box sx={{ mt: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: s.ink3 }}>
                    <VerifiedRoundedIcon sx={{ fontSize: 14, color: "#10B981" }} />
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t("v5.onchain.ownStore")}</Typography>
                  </Box>
                  <Cta label={t("v5.onchain.verify")} accent={accent} />
                </Box>
              </Box>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Stagger step={0.08} data-testid="open-tiles" sx={{ mt: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1.75, md: 2 } }}>
        {OPEN.map((tile, i) => (
          <StaggerItem key={tile.id} i={i} y={14}>
            <Box component="a" href={tile.href} data-testid={`proof-tile-${tile.id}`} sx={{ ...cardSx(s, { radius: 20 }), display: "flex", gap: 2, alignItems: "flex-start", textDecoration: "none", p: { xs: 2.5, md: 2.75 }, height: "100%", "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}>
              <Box sx={{ width: 42, height: 42, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(43,212,196,0.14)" : "rgba(15,143,134,0.09)", color: accent, flexShrink: 0 }}><tile.Icon sx={{ fontSize: 22 }} /></Box>
              <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", flex: 1 }}>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 16.5, letterSpacing: "-0.015em", color: s.ink }}>{tile.title}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, mt: 0.75, mb: 1.75 }}>{tile.desc}</Typography>
                <Box sx={{ mt: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                  <Cta label={tile.cta} accent={accent} />
                  {tile.meta ? <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.ink3, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{tile.meta}</Typography> : null}
                </Box>
              </Box>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(ProofV6);
