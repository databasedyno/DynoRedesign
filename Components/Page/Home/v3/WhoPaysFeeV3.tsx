import React, { memo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * WhoPaysFeeV3 — "you choose who pays the fee" differentiator (2026-06).
 *
 * A visual segmented toggle between "I pay the fee" and "Customer pays",
 * with a live worked example on a $100 payment. Dual-fee-payer is a core
 * differentiator that the landing was silent on. Frontend-only, additive.
 * The dollar figures are illustrative literals (not translated).
 */

type Mode = "merchant" | "customer";

const WhoPaysFeeV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [mode, setMode] = useState<Mode>("merchant");

  // Illustrative example — $100 payment at the 1.5% Starter rate + $1 fixed.
  const isMerchant = mode === "merchant";
  const customerPays = isMerchant ? "$100.00" : "$102.50";
  const youReceive = isMerchant ? "$97.50" : "$100.00";
  const note = isMerchant ? t("v3.whopays.merchantNote") : t("v3.whopays.customerNote");

  const TABS: { key: Mode; label: string }[] = [
    { key: "merchant", label: t("v3.whopays.tabMerchant") },
    { key: "customer", label: t("v3.whopays.tabCustomer") },
  ];

  return (
    <Box component="section" data-testid="who-pays-fee" sx={{ background: s.bgAlt, py: { xs: 12, md: 20 } }}>
      <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 5, md: 7 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.whopays.eyebrow")}</Eyebrow>
          <HeadlineL sx={{ color: s.ink, mb: 2.5 }}>{t("v3.whopays.headline")}</HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.whopays.body")}
          </Typography>
        </Box>

        {/* Segmented toggle */}
        <Box
          role="tablist"
          aria-label={t("v3.whopays.headline")}
          sx={{
            display: "inline-flex",
            p: 0.5,
            mx: "auto",
            mb: 4,
            borderRadius: "999px",
            border: `1px solid ${s.line}`,
            background: s.surface,
            position: "relative",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {TABS.map((tab) => {
            const active = mode === tab.key;
            return (
              <Box
                key={tab.key}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                data-testid={`whopays-tab-${tab.key}`}
                onClick={() => setMode(tab.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setMode(tab.key);
                }}
                sx={{
                  position: "relative",
                  cursor: "pointer",
                  px: { xs: 2.5, md: 4 },
                  py: 1.2,
                  borderRadius: "999px",
                  userSelect: "none",
                  transition: "color .25s ease",
                  color: active ? "#fff" : s.ink2,
                }}
              >
                {active && (
                  <motion.div
                    layoutId="whopays-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 999,
                      background: BRAND_ACCENT,
                      zIndex: 0,
                    }}
                  />
                )}
                <Typography
                  sx={{
                    position: "relative",
                    zIndex: 1,
                    fontFamily: FONT_BODY,
                    fontSize: { xs: 13.5, md: 15 },
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Worked example card */}
        <Box
          data-testid="whopays-example"
          sx={{
            maxWidth: 720,
            mx: "auto",
            background: s.surface,
            border: `1px solid ${s.lineStrong}`,
            borderRadius: "24px",
            p: { xs: 3, md: 5 },
          }}
        >
          <Typography
            sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink3, mb: 3 }}
          >
            {t("v3.whopays.exampleLabel")}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0, border: `1px solid ${s.line}`, borderRadius: "16px", overflow: "hidden" }}>
            <Box sx={{ p: { xs: 2.5, md: 3 }, borderRight: { xs: "none", sm: `1px solid ${s.line}` }, borderBottom: { xs: `1px solid ${s.line}`, sm: "none" } }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
                {t("v3.whopays.customerPaysLabel")}
              </Typography>
              <Typography data-testid="whopays-customer-pays" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 30, md: 40 }, letterSpacing: "-0.03em", color: s.ink, lineHeight: 1 }}>
                {customerPays}
              </Typography>
            </Box>
            <Box sx={{ p: { xs: 2.5, md: 3 }, background: s.dark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)" }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
                {t("v3.whopays.youReceiveLabel")}
              </Typography>
              <Typography data-testid="whopays-you-receive" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 30, md: 40 }, letterSpacing: "-0.03em", color: s.dark ? "#818CF8" : BRAND_ACCENT, lineHeight: 1 }}>
                {youReceive}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2, mt: 3 }}>
            {note}
          </Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3, mt: 2, lineHeight: 1.5 }}>
            {t("v3.whopays.feeFootnote")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(WhoPaysFeeV3);
