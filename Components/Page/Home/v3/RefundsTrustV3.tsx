import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import { FONT_BODY, FONT_HERO, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * RefundsTrustV3 — "the scary parts, handled" trust row (2026-06).
 *
 * Surfaces three trust signals the landing was silent on: crypto refunds
 * (rare among crypto PSPs), non-custodial custody, and signed webhooks.
 * Frontend-only, additive, aurora v3 tokens.
 */

interface TrustItem {
  key: string;
  icon: React.ElementType;
}

const ITEMS: TrustItem[] = [
  { key: "refunds", icon: ReplayRoundedIcon },
  { key: "custody", icon: AccountBalanceWalletRoundedIcon },
  { key: "webhooks", icon: WebhookRoundedIcon },
];

const RefundsTrustV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");

  return (
    <Box component="section" data-testid="refunds-trust" sx={{ background: s.bgAlt, py: { xs: 12, md: 20 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 640, mb: { xs: 6, md: 9 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.refunds.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>{t("v3.refunds.headline")}</HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.refunds.body")}
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
          {ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: idx * 0.08 }}
                style={{ height: "100%" }}
              >
                <Box
                  data-testid={`trust-card-${item.key}`}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "20px",
                    p: { xs: 3, md: 3.5 },
                    transition: "transform .3s ease, border-color .3s ease",
                    "&:hover": { transform: "translateY(-3px)", borderColor: s.lineStrong },
                  }}
                >
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: "13px",
                      background: s.dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)",
                      border: `1px solid ${s.dark ? "rgba(129,140,248,0.3)" : "rgba(79,70,229,0.2)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: s.dark ? "#818CF8" : BRAND_ACCENT,
                      mb: 2.5,
                    }}
                  >
                    <Icon sx={{ fontSize: 23 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 19, letterSpacing: "-0.015em", color: s.ink, mb: 1.25 }}>
                    {t(`v3.refunds.${item.key}Title`)}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>
                    {t(`v3.refunds.${item.key}Desc`)}
                  </Typography>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(RefundsTrustV3);
