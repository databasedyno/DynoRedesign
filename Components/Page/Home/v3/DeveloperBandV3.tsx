import React, { memo } from "react";
import { Box, Typography, Button } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * DeveloperBandV3 — developer credibility (2026-08).
 *
 * Shows real proof instead of just linking to docs: a representative REST
 * request that returns a hosted checkout URL, plus callouts for capabilities
 * that exist today (sandbox/test keys, real-time webhooks, hosted checkout,
 * non-custodial). The snippet is a simplified illustration; the CTA points to
 * the full API reference at /documentation and the live demo at /pay/demo.
 */

// Simplified illustrative request (not translated). See /documentation for the
// full, authoritative API reference. Mirrors the real userless checkout call.
const CODE = `curl -X POST https://api.dynopay.com/api/user/createPayment \\
  -H "x-api-key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 49.00,
    "redirect_uri": "https://store.com/thanks"
  }'

# -> 200 OK
# {
#   "message": "Link Generated!",
#   "data": {
#     "redirect_url": "https://checkout.dynopay.com/pay?d=abc123",
#     "available_currencies": ["BTC", "ETH", "USDT-TRC20", "LTC"]
#   }
# }`;

const DeveloperBandV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;

  const CALLOUTS = [
    { icon: ScienceRoundedIcon, title: t("v3.developer.k1t"), desc: t("v3.developer.k1d") },
    { icon: BoltRoundedIcon, title: t("v3.developer.k2t"), desc: t("v3.developer.k2d") },
    { icon: ShoppingCartCheckoutRoundedIcon, title: t("v3.developer.k3t"), desc: t("v3.developer.k3d") },
    { icon: LockRoundedIcon, title: t("v3.developer.k4t"), desc: t("v3.developer.k4d") },
  ];

  return (
    <Box component="section" data-testid="developer-band" sx={{ background: s.bg, py: { xs: 10, md: 18 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 5, md: 7 },
            alignItems: "center",
          }}
        >
          {/* Left: copy + callouts + CTAs */}
          <Box>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.developer.eyebrow")}</Eyebrow>
            <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
              {t("v3.developer.headline")}
            </HeadlineL>
            <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6, mb: 4, maxWidth: 460 }}>
              {t("v3.developer.body")}
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 2.5, md: 3 }, mb: 4.5 }}>
              {CALLOUTS.map((c, i) => {
                const Icon = c.icon;
                return (
                  <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)",
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: accent }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15.5, color: s.ink, mb: 0.4 }}>
                        {c.title}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: s.ink2 }}>
                        {c.desc}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <Button
                href="/documentation"
                endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: "999px",
                  px: 3.5,
                  py: 1.4,
                  fontFamily: FONT_BODY,
                  fontSize: 15.5,
                  fontWeight: 600,
                  textTransform: "none",
                  color: "#FFFFFF",
                  background: BRAND_ACCENT,
                  boxShadow: "0 12px 32px -12px rgba(79, 70, 229,0.6)",
                  "&:hover": { background: "#4338CA" },
                }}
              >
                {t("v3.developer.ctaDocs")}
              </Button>
              <Button
                href="/pay/demo"
                sx={{
                  borderRadius: "999px",
                  px: 3,
                  py: 1.35,
                  fontFamily: FONT_BODY,
                  fontSize: 15,
                  fontWeight: 500,
                  textTransform: "none",
                  color: s.ink,
                  border: `1px solid ${s.lineStrong}`,
                  "&:hover": { background: s.bgAlt, borderColor: s.ink3 },
                }}
              >
                {t("v3.developer.ctaDemo")}
              </Button>
            </Box>
          </Box>

          {/* Right: terminal-style code card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Box
              sx={{
                background: s.dark ? "#17171F" : "#0B0B0F",
                border: s.dark ? "1px solid rgba(129,140,248,0.22)" : "1px solid rgba(255,255,255,0.10)",
                borderRadius: "18px",
                overflow: "hidden",
                boxShadow: s.dark
                  ? "0 30px 60px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(129,140,248,0.10)"
                  : "0 30px 60px -30px rgba(0,0,0,0.5)",
              }}
            >
              {/* terminal chrome */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F56" }} />
                <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#FFBD2E" }} />
                <Box sx={{ width: 11, height: 11, borderRadius: "50%", background: "#27C93F" }} />
                <Typography sx={{ ml: 1.5, fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
                  {t("v3.developer.terminalLabel")}
                </Typography>
              </Box>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: { xs: 2.5, md: 3 },
                  fontFamily: FONT_TECH,
                  fontSize: { xs: 12, md: 13.5 },
                  lineHeight: 1.75,
                  color: "#E5E7EB",
                  whiteSpace: "pre",
                  overflowX: "auto",
                }}
              >
                {CODE}
              </Box>
            </Box>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 1.5, lineHeight: 1.5, textAlign: { xs: "left", md: "right" } }}>
              {t("v3.developer.snippetNote")}
            </Typography>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(DeveloperBandV3);
