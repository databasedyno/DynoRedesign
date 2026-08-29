import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { COIN_COLOR } from "@/helpers/assetColor";
import {
  BG0, BG1, BG2, BLUE, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, FONT_MONO,
  GREEN, INK0, INK2, INK3, LINE, LINE2, ORANGE, PURPLE,
} from "./theme.v4";
import { DisplayL, EyebrowV4, LeadV4, ShellV4 } from "./styled.v4";

const KeyChip: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
    <CheckRounded sx={{ fontSize: 15, color: GREEN }} />
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, color: INK2, letterSpacing: "0.02em" }}>{label}</Typography>
  </Box>
);

const Panel: React.FC<{ children: React.ReactNode; testid: string }> = ({ children, testid }) => (
  <Box data-testid={testid} sx={{
    borderRadius: "18px", border: `1px solid ${LINE}`, background: BG1, p: { xs: 3, md: 4 },
    minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "center",
    transition: "border-color .25s ease", "&:hover": { borderColor: LINE2 },
  }}>
    {children}
  </Box>
);

const CheckoutVisual: React.FC = () => (
  <Panel testid="pillar-visual-checkout">
    <Box sx={{ borderRadius: "14px", border: `1px solid ${LINE2}`, background: BG2, p: 2.5, maxWidth: 340, mx: "auto", width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: INK0 }}>Atlas Supply</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: INK3, display: "flex", alignItems: "center", gap: 0.5 }}>
          <LockRoundedIcon sx={{ fontSize: 9 }} /> dynopay.com/pay
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: INK0, mb: 1.75, letterSpacing: "-0.02em" }}>$120.00</Typography>
      <Box sx={{ display: "flex", gap: 0.75, mb: 2 }}>
        {["BTC", "ETH", "USDC"].map((c, i) => (
          <Box key={c} sx={{
            flex: 1, textAlign: "center", py: 0.7, borderRadius: "8px",
            border: `1px solid ${i === 2 ? BLUE_BRIGHT : LINE}`,
            background: i === 2 ? "rgba(0,82,255,0.12)" : "transparent",
          }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: i === 2 ? INK0 : INK3 }}>{c}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ borderRadius: "9px", py: 1.1, textAlign: "center", background: BLUE, color: "#fff", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13.5 }}>
        Pay $120.00
      </Box>
    </Box>
  </Panel>
);

const ConvertVisual: React.FC<{ label: string; sub: string }> = ({ label, sub }) => (
  <Panel testid="pillar-visual-convert">
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: { xs: 1.5, md: 2.5 }, mb: 3 }}>
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 1.25, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(247,147,26,0.1)", border: `1px solid rgba(247,147,26,0.4)`,
          fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: ORANGE,
        }}>BTC</Box>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: INK3 }}>0.00184 BTC</Typography>
      </Box>
      <Box sx={{ position: "relative", flex: "0 0 auto", width: { xs: 60, md: 110 }, height: 2, background: `linear-gradient(90deg, ${ORANGE}, ${BLUE_BRIGHT})`, borderRadius: 2, overflow: "visible" }}>
        <EastRoundedIcon sx={{ position: "absolute", right: -10, top: -11, fontSize: 24, color: BLUE_BRIGHT }} />
      </Box>
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 1.25, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(39,117,202,0.12)", border: `1px solid ${COIN_COLOR.USDC}66`,
          fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: "#5C9CE6",
        }}>USDC</Box>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: INK3 }}>120.00 USDC</Typography>
      </Box>
    </Box>
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontFamily: FONT_MONO, fontSize: 11, color: GREEN, border: "1px solid rgba(0,211,149,0.3)", background: "rgba(0,211,149,0.07)", borderRadius: 999, px: 1.75, py: 0.6 }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: INK3, mt: 1.5 }}>{sub}</Typography>
    </Box>
  </Panel>
);

const CODE_LINES: Array<Array<[string, string]>> = [
  [["POST", "#00D395"], [" /v1/charges", "#EDEFF3"]],
  [["{", "#5E6675"]],
  [['  "amount"', "#7FA7FF"], [": ", "#5E6675"], ['"49.00"', "#F7B955"], [",", "#5E6675"]],
  [['  "currency"', "#7FA7FF"], [": ", "#5E6675"], ['"USD"', "#F7B955"], [",", "#5E6675"]],
  [['  "settle_to"', "#7FA7FF"], [": ", "#5E6675"], ['"USDC"', "#F7B955"]],
  [["}", "#5E6675"]],
  [["", ""]],
  [["→ 201 Created", "#00D395"], ["  ·  webhook: charge.confirmed", "#5E6675"]],
];

const ApiVisual: React.FC = () => (
  <Panel testid="pillar-visual-api">
    <Box sx={{ borderRadius: "14px", border: `1px solid ${LINE2}`, background: "#07080C", overflow: "hidden", maxWidth: 430, width: "100%", mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 2, py: 1.25, borderBottom: `1px solid ${LINE}` }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.85 }} />
        ))}
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: INK3, ml: 1 }}>create-charge.sh</Typography>
      </Box>
      <Box sx={{ p: 2.5 }}>
        {CODE_LINES.map((line, i) => (
          <Typography key={i} component="div" sx={{ fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre" }}>
            {line.map(([txt, color], j) => (
              <Box key={j} component="span" sx={{ color: color || INK2 }}>{txt || " "}</Box>
            ))}
          </Typography>
        ))}
      </Box>
    </Box>
  </Panel>
);

const PILLARS = [
  { key: "p1", accent: BLUE_BRIGHT, visual: "checkout" },
  { key: "p2", accent: GREEN, visual: "convert" },
  { key: "p3", accent: PURPLE, visual: "api" },
] as const;

const ProductPillarsV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" sx={{ background: BG0 }}>
      <ShellV4 sx={{ py: { xs: 10, md: 15 } }}>
        <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.pillars.eyebrow")}</EyebrowV4>
        <DisplayL component="h2" sx={{ mb: { xs: 7, md: 10 }, maxWidth: 720 }}>
          {t("v4.pillars.title")}
        </DisplayL>

        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 7, md: 11 } }}>
          {PILLARS.map((p, i) => (
            <Box key={p.key} data-testid={`pillar-${p.visual}`} sx={{
              display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.1fr" },
              gap: { xs: 4, md: 9 }, alignItems: "center",
              direction: { md: i % 2 === 1 ? "rtl" : "ltr" },
            }}>
              <Box sx={{ direction: "ltr" }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: p.accent, mb: 2 }}>
                  {t(`v4.pillars.${p.key}e`)}
                </Typography>
                <Typography component="h3" sx={{
                  fontFamily: FONT_DISPLAY, fontWeight: 600, color: INK0,
                  fontSize: { xs: 26, md: 36 }, letterSpacing: "-0.02em", lineHeight: 1.12, mb: 2.25,
                }}>
                  {t(`v4.pillars.${p.key}t`)}
                </Typography>
                <LeadV4 sx={{ mb: 3.25, maxWidth: 460, fontSize: 16 }}>{t(`v4.pillars.${p.key}d`)}</LeadV4>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: p.key === "p3" ? 3.25 : 0 }}>
                  <KeyChip label={t(`v4.pillars.${p.key}k1`)} />
                  <KeyChip label={t(`v4.pillars.${p.key}k2`)} />
                  <KeyChip label={t(`v4.pillars.${p.key}k3`)} />
                </Box>
                {p.key === "p3" && (
                  <Link href="/documentation" passHref legacyBehavior>
                    <Typography component="a" data-testid="pillar-api-docs-link" sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.75, textDecoration: "none",
                      fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14.5, color: BLUE_BRIGHT,
                      transition: "gap .2s ease", "&:hover": { gap: 1.25 },
                    }}>
                      {t("v4.pillars.p3cta")} <ArrowForwardRounded sx={{ fontSize: 16 }} />
                    </Typography>
                  </Link>
                )}
              </Box>
              <Box sx={{ direction: "ltr" }}>
                {p.visual === "checkout" && <CheckoutVisual />}
                {p.visual === "convert" && <ConvertVisual label={t("v4.pillars.convertBadge")} sub={t("v4.pillars.convertSub")} />}
                {p.visual === "api" && <ApiVisual />}
              </Box>
            </Box>
          ))}
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(ProductPillarsV4);
