import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora, VOLT } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

const CURL = `curl https://api.dynopay.com/v1/payments \\
  -H "Authorization: Bearer sk_test_..." \\
  -d '{"amount": 25.00, "currency": "USD", "settle_to": "USDC"}'`;

const RESPONSE = `HTTP/1.1 201 Created
{
  "id": "pay_01HZ...",
  "amount": 25.00,
  "currency": "USD",
  "checkout_url": "https://checkout.dynopay.com/pay_01HZ...",
  "status": "pending"
}`;

const TryItNowV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(CURL).catch(() => {});
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <Box
      component="section"
      id="try-it-now"
      sx={{
        background: "#0A0A0A",
        position: "relative",
        overflow: "hidden",
        py: { xs: 12, md: 20 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          display: "none",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 85%)",
          pointerEvents: "none",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "20%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "#4F46E5",
          filter: "blur(140px)",
          opacity: 0.07,
          pointerEvents: "none",
        }}
      />

      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 720, mb: { xs: 5, md: 8 } }}>
          <Eyebrow sx={{ mb: 2, color: "#4F46E5" }}>{t("v3.tryit.eyebrow")}</Eyebrow>
          <HeadlineL sx={{ color: "#F5F5F5" }}>
            {t("v3.tryit.headline1")}
            <br />
            {t("v3.tryit.headline2")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.68)", mt: 2.5, fontSize: 17, lineHeight: 1.6 }}>
            {t("v3.tryit.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {/* Request panel */}
          <Box
            sx={{
              background: "#0E0E13",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "20px",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2.5,
                py: 1.5,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} />
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: "rgba(255,255,255,0.5)", ml: 1.5, letterSpacing: "0.1em" }}>
                  ~/dynopay — zsh
                </Typography>
              </Box>
              <Button
                onClick={onCopy}
                startIcon={copied ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                sx={{
                  color: copied ? VOLT : "rgba(255,255,255,0.7)",
                  fontFamily: FONT_TECH,
                  fontSize: 12,
                  textTransform: "none",
                  minWidth: 0,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: "8px",
                  "&:hover": { background: "rgba(255,255,255,0.06)" },
                }}
              >
                {copied ? t("v3.tryit.copiedBtn") : t("v3.tryit.copyBtn")}
              </Button>
            </Box>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: { xs: 2.5, md: 3 },
                fontFamily: FONT_TECH,
                fontSize: { xs: 12.5, md: 13.5 },
                lineHeight: 1.7,
                color: "#F5F5F5",
                whiteSpace: "pre",
                overflow: "auto",
              }}
            >
              <Box component="span" sx={{ color: "#CCFF00" }}>curl</Box>
              <Box component="span" sx={{ color: "#F5F5F5" }}>{" https://api.dynopay.com/v1/payments \\\n  "}</Box>
              <Box component="span" sx={{ color: "#7CB1FF" }}>-H</Box>
              <Box component="span" sx={{ color: "#F5F5F5" }}>{" "}</Box>
              <Box component="span" sx={{ color: "#FF9E80" }}>{"\"Authorization: Bearer sk_test_...\""}</Box>
              <Box component="span" sx={{ color: "#F5F5F5" }}>{" \\\n  "}</Box>
              <Box component="span" sx={{ color: "#7CB1FF" }}>-d</Box>
              <Box component="span" sx={{ color: "#F5F5F5" }}>{" "}</Box>
              <Box component="span" sx={{ color: "#FF9E80" }}>{"'{\"amount\": 25.00, \"currency\": \"USD\", \"settle_to\": \"USDC\"}'"}</Box>
            </Box>
          </Box>

          {/* Response panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Box
              sx={{
                background: "#0E0E13",
                border: "1px solid rgba(204,255,0,0.24)",
                borderRadius: "20px",
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 30px 60px -30px rgba(204,255,0,0.35)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 2.5,
                  py: 1.5,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(204,255,0,0.05)",
                }}
              >
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: VOLT, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
                  {t("v3.tryit.responseHeader")}
                </Typography>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  312ms
                </Typography>
              </Box>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: { xs: 2.5, md: 3 },
                  fontFamily: FONT_TECH,
                  fontSize: { xs: 12.5, md: 13.5 },
                  lineHeight: 1.7,
                  color: "#F5F5F5",
                  whiteSpace: "pre",
                  overflow: "auto",
                }}
              >
                {RESPONSE}
              </Box>
            </Box>
          </motion.div>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", mt: 4, gap: 2 }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {t("v3.tryit.footBullets")}
          </Typography>
          <Button
            href="/documentation"
            sx={{
              color: "#4F46E5",
              fontFamily: FONT_BODY,
              fontSize: 14.5,
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "999px",
              border: "1px solid rgba(79, 70, 229,0.4)",
              px: 2.5,
              py: 1,
              "&:hover": { background: "rgba(79, 70, 229,0.08)", borderColor: "#4F46E5" },
            }}
          >
            {t("v3.tryit.readDocs")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TryItNowV3);
