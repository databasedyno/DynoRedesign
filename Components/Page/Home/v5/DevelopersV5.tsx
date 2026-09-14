import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import CodeOffRoundedIcon from "@mui/icons-material/CodeOffRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import copyToClipboard from "@/helpers/copyToClipboard";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, SecondaryBtn, Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { EASE_OUT } from "../motion/tokens";

const SANDBOX_KEY = "dpk_test_9f621db8";
const CODE: Record<"curl" | "node" | "python", string> = {
  curl: `curl -X POST https://dynopay.com/api/user/createPayment \\
  -H "x-api-key: ${SANDBOX_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 49.00, "redirect_uri": "https://store.com/thanks" }'`,
  node: `const res = await fetch("https://dynopay.com/api/user/createPayment", {
  method: "POST",
  headers: { "x-api-key": "${SANDBOX_KEY}", "Content-Type": "application/json" },
  body: JSON.stringify({ amount: 49.0, redirect_uri: "https://store.com/thanks" }),
});
const { data } = await res.json();
// data.redirect_url → send the buyer here`,
  python: `import requests

r = requests.post(
    "https://dynopay.com/api/user/createPayment",
    headers={"x-api-key": "${SANDBOX_KEY}"},
    json={"amount": 49.00, "redirect_uri": "https://store.com/thanks"},
)
print(r.json()["data"]["redirect_url"])`,
};
const RESPONSE = `HTTP/1.1 201 Created
{
  "message": "Link Generated!",
  "data": {
    "redirect_url": "https://dynopay.com/pay?d=abc123",
    "available_currencies": ["BTC", "ETH", "SOL", "USDT-TRC20", "LTC"]
  }
}`;

const DevelopersV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [lang, setLang] = useState<keyof typeof CODE>("curl");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onCopy = () => {
    copyToClipboard(CODE[lang]).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const BULLETS = [
    { Icon: WebhookRoundedIcon, text: t("v5.dev.b1") },
    { Icon: ScienceRoundedIcon, text: t("v5.dev.b2") },
    { Icon: CodeOffRoundedIcon, text: t("v5.dev.b3") },
  ];
  const panel = { background: "#0B0F19", border: "1px solid #1F2D47", borderRadius: "18px", overflow: "hidden" } as const;
  const pre = { m: 0, p: { xs: 2, md: 2.5 }, fontFamily: FONT_TECH, fontSize: { xs: 12, md: 13 }, lineHeight: 1.7, color: "#E5E7EB", whiteSpace: "pre", overflowX: "auto" } as const;

  return (
    <Section id="developers" alt testId="developers">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,0.85fr) minmax(0,1.15fr)" }, gap: { xs: 5, md: 7 }, alignItems: "start" }}>
        <Box sx={{ minWidth: 0 }}>
          <SectionHead eyebrow={t("v5.dev.eyebrow")} headline={t("v5.dev.headline")} body={t("v5.dev.body")} maxWidth={480} />
          <Stagger step={0.08} sx={{ display: "grid", gap: 1.75, mb: 4 }}>
            {BULLETS.map((b, i) => (
              <StaggerItem key={i} i={i} y={12}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "9px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent, flexShrink: 0 }}><b.Icon sx={{ fontSize: 17 }} /></Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink }}>{b.text}</Typography>
              </Box>
              </StaggerItem>
            ))}
          </Stagger>
          <Box data-testid="works-with" sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 2, borderRadius: "14px", border: `1px solid ${s.line}`, background: s.surface, mb: 4 }}>
            <LanguageRoundedIcon sx={{ fontSize: 20, color: accent }} />
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2 }}>{t("v5.dev.worksWith")}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <PrimaryBtn small href="/documentation" data-testid="dev-docs-cta" endIcon={<ArrowForwardIcon sx={{ fontSize: 17 }} />}>{t("v5.dev.ctaDocs")}</PrimaryBtn>
            <SecondaryBtn small href="/pay/demo" data-testid="dev-demo-cta">{t("v5.hero.secondary")}</SecondaryBtn>
          </Box>
        </Box>

        <Stagger step={0.12} sx={{ minWidth: 0, display: "grid" }}>
          <StaggerItem i={0} y={20}>
          <Box data-testid="code-tabs" sx={panel}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <Box role="tablist" sx={{ display: "flex", gap: 0.5 }}>
                {(Object.keys(CODE) as Array<keyof typeof CODE>).map((k) => (
                  <Box key={k} component="button" type="button" role="tab" aria-selected={lang === k} data-testid={`code-tab-${k}`} onClick={() => setLang(k)} sx={{ all: "unset", cursor: "pointer", position: "relative", px: 1.4, py: 0.7, borderRadius: "8px", fontFamily: FONT_TECH, fontSize: 12, fontWeight: 600, color: lang === k ? "#fff" : "rgba(255,255,255,0.55)", transition: "color 160ms ease", "&:hover": { color: "#fff" } }}>
                    {lang === k ? <motion.span layoutId="code-tab-pill" transition={{ type: "spring", stiffness: 520, damping: 42 }} style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(255,255,255,0.10)" }} /> : null}
                    <Box component="span" sx={{ position: "relative", zIndex: 1 }}>{k === "curl" ? "cURL" : k === "node" ? "Node" : "Python"}</Box>
                  </Box>
                ))}
              </Box>
              <Box component="button" type="button" onClick={onCopy} data-testid="code-copy" data-copied={copied} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.2, py: 0.6, borderRadius: "8px", fontFamily: FONT_TECH, fontSize: 12, color: copied ? "#A5B4FC" : "rgba(255,255,255,0.7)", transition: "color 160ms ease, background-color 160ms ease", "&:hover": { background: "rgba(255,255,255,0.06)" } }}>
                {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                {copied ? t("v5.dev.copied") : t("v5.dev.copy")}
              </Box>
            </Box>
            <AnimatePresence initial={false}>
              <Box key={lang} component={motion.pre} data-testid="code-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: EASE_OUT }} sx={pre}>{CODE[lang]}</Box>
            </AnimatePresence>
          </Box>
          </StaggerItem>
          <StaggerItem i={1} y={20}>
          <Box sx={{ ...panel, mt: 1.5, border: "1px solid rgba(129,140,248,0.28)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(99,102,241,0.08)" }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A5B4FC", fontWeight: 700 }}>{t("v5.dev.response")}</Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>~300 ms</Typography>
            </Box>
            <Box component="pre" data-testid="response-block" sx={pre}>{RESPONSE}</Box>
          </Box>
          </StaggerItem>
          <StaggerItem i={2} y={8}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 1.5, lineHeight: 1.5 }}>{t("v5.dev.snippetNote")}</Typography>
          </StaggerItem>
        </Stagger>
      </Box>
    </Section>
  );
};

export default memo(DevelopersV5);
