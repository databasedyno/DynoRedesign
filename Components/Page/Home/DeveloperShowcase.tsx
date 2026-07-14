import React, { memo, useCallback, useState } from "react";
import { Box, Typography, Snackbar } from "@mui/material";
import { ArrowForward, CheckCircle, ContentCopy } from "@mui/icons-material";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

/**
 * DeveloperShowcase — dedicated developer section.
 * Mirrors CrowdfundingShowcase / CreatorShowcase layout: mock IDE / terminal
 * on one side, narrative + feature bullets + CTA on the other.
 *
 * Lead promise (per user brief): "Integrate in ~10 minutes." + "15+ chains,
 * one API."
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const DEV_ACCENT = "#7CB1FF";

// The cURL snippet shown in the mock. Kept identical to /documentation
// "Try it live" and the TryItNow snippet so what devs see here matches
// what they'll actually copy-paste in the playground further down.
const CURL_LINES: { text: string; tone: "cmd" | "dim" | "key" | "str" | "num" | "punct" | "brace" }[] = [
  { text: '$ curl -X POST "https://dynopay.com/api/public/sandbox/payment-links" \\', tone: "cmd" },
  { text: '    -H "Authorization: Bearer dyno_sk_sandbox_demo_9f621db8" \\', tone: "dim" },
  { text: '    -H "Content-Type: application/json" \\', tone: "dim" },
  { text: "    -d '{", tone: "punct" },
  { text: '      "amount": 49.99,', tone: "key" },
  { text: '      "currency": "USD",', tone: "key" },
  { text: '      "description": "Pro Plan - Monthly"', tone: "key" },
  { text: "    }'", tone: "punct" },
];

// The fake response, printed after a short delay to mimic a real call.
const RESPONSE_LINES: { text: string; tone: "brace" | "key" | "str" | "num" | "punct" | "dim" }[] = [
  { text: "{", tone: "brace" },
  { text: '  "id": "plink_sandbox_2727324c61ebfb8b",', tone: "key" },
  { text: '  "status": "awaiting_payment",', tone: "key" },
  { text: '  "checkout_url": "https://dynopay.com/pay/...",', tone: "key" },
  { text: '  "supported_chains": ["USDT-TRC20", "USDT-ERC20", ...]', tone: "key" },
  { text: "}", tone: "brace" },
];

const IdeWindow: React.FC<{ reduced: boolean; onCopy: () => void }> = ({ reduced, onCopy }) => {
  const toneColor: Record<string, string> = {
    cmd: "#E4E4E7",
    dim: "rgba(255,255,255,0.42)",
    key: "#8BC5FF",
    str: "#B7E4C7",
    num: "#F9C572",
    punct: "rgba(255,255,255,0.6)",
    brace: "#CCFF00",
  };

  return (
    <Box
      data-testid="developer-mock-ide"
      sx={{
        width: "100%",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        backgroundColor: "rgba(8,8,10,0.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 40px 90px -40px rgba(0,0,0,0.75), 0 0 60px rgba(124,177,255,0.06)",
        position: "relative",
      }}
    >
      {/* window chrome */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.25,
          borderBottom: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <Box sx={{ display: "flex", gap: 0.6 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: c }} />
          ))}
        </Box>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: FONT_TECH }}>
          POST /api/public/sandbox/payment-links
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            component="button"
            type="button"
            onClick={onCopy}
            data-testid="developer-mock-copy"
            aria-label="Copy request"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.35,
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontFamily: FONT_TECH,
              fontSize: 10.5,
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
              "&:hover": {
                color: DEV_ACCENT,
                borderColor: "rgba(124,177,255,0.5)",
                background: "rgba(124,177,255,0.08)",
              },
            }}
          >
            <ContentCopy sx={{ fontSize: 11 }} />
            COPY
          </Box>
        </Box>
      </Box>

      {/* request body */}
      <Box sx={{ px: { xs: 2, sm: 2.75 }, py: { xs: 2, sm: 2.25 } }}>
        {CURL_LINES.map((l, i) => (
          <motion.div
            key={i}
            initial={reduced ? { opacity: 1 } : { opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.28, delay: reduced ? 0 : 0.05 + i * 0.06, ease: EASE }}
          >
            <Typography
              component="pre"
              sx={{
                m: 0,
                py: 0.28,
                fontSize: { xs: 11, sm: 12.5 },
                lineHeight: 1.55,
                color: toneColor[l.tone] ?? toneColor.cmd,
                fontFamily: FONT_TECH,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {l.text}
            </Typography>
          </motion.div>
        ))}
      </Box>

      {/* response separator */}
      <Box
        sx={{
          px: 2.75,
          py: 0.9,
          borderTop: "1px solid rgba(255,255,255,0.09)",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(124,177,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22C55E" }} />
        <Typography sx={{ fontSize: 10.5, color: "#22C55E", fontFamily: FONT_TECH, letterSpacing: "0.14em" }}>
          201 CREATED
        </Typography>
        <Typography sx={{ ml: "auto", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT_TECH, letterSpacing: "0.08em" }}>
          ~180 ms
        </Typography>
      </Box>

      {/* response body */}
      <Box sx={{ px: { xs: 2, sm: 2.75 }, py: { xs: 1.5, sm: 1.75 } }}>
        {RESPONSE_LINES.map((l, i) => (
          <motion.div
            key={`resp-${i}`}
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.35, delay: reduced ? 0 : 0.7 + i * 0.06, ease: EASE }}
          >
            <Typography
              component="pre"
              sx={{
                m: 0,
                py: 0.28,
                fontSize: { xs: 11, sm: 12.5 },
                lineHeight: 1.55,
                color: toneColor[l.tone] ?? toneColor.cmd,
                fontFamily: FONT_TECH,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {l.text}
            </Typography>
          </motion.div>
        ))}
      </Box>

      {/* footer strip */}
      <Box
        sx={{
          px: 2.75,
          py: 1.1,
          borderTop: "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: FONT_TECH, letterSpacing: "0.06em" }}>
          IDEMPOTENT · SANDBOX · NO SIGNUP
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: DEV_ACCENT, fontFamily: FONT_TECH, letterSpacing: "0.06em" }}>
          15+ CHAINS · ONE API
        </Typography>
      </Box>
    </Box>
  );
};

const DeveloperShowcase: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;
  const [snack, setSnack] = useState(false);

  const copyCurl = useCallback(async () => {
    const text = CURL_LINES.map((l) => l.text).join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* silent — non-blocking */
    }
    setSnack(true);
  }, []);

  const bullets: string[] = [
    t("developerShowcase.feature1", {
      defaultValue: "REST + webhooks · idempotency keys · signed with HMAC-SHA256",
    }),
    t("developerShowcase.feature2", {
      defaultValue: "TypeScript / Node SDK · Python examples · OpenAPI spec",
    }),
    t("developerShowcase.feature3", {
      defaultValue: "Sandbox key is public — no signup to play, no CC to test",
    }),
    t("developerShowcase.feature4", {
      defaultValue: "Drop-in checkout, Elements widgets, Buy Buttons — pick your surface",
    }),
  ];

  return (
    <Box
      component="section"
      id="developer-showcase"
      aria-labelledby="developer-heading"
      data-testid="developer-showcase"
      sx={{ px: { xs: 3, md: 6 }, py: { xs: 6, md: 10 } }}
    >
      <Box
        sx={{
          maxWidth: 1400,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 0.95fr" },
          gap: { xs: 5, lg: 8 },
          alignItems: "center",
        }}
      >
        {/* ═════ LEFT — mock IDE ═════ */}
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <IdeWindow reduced={reduced} onCopy={copyCurl} />
          <Typography
            sx={{
              fontFamily: FONT_TECH,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: s.faint,
              mt: 1.5,
              textAlign: "center",
            }}
          >
            {t("developerShowcase.mockCaption", {
              defaultValue: "// PUBLIC SANDBOX · TRY WITHOUT AN ACCOUNT",
            })}
          </Typography>
        </motion.div>

        {/* ═════ RIGHT — narrative ═════ */}
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_TECH,
              fontSize: 12,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: DEV_ACCENT,
              mb: 2,
            }}
          >
            [ {t("developerShowcase.eyebrow", { defaultValue: "For developers" })} ]
          </Typography>
          <Typography
            id="developer-heading"
            component="h2"
            sx={{
              fontFamily: FONT_HERO,
              fontWeight: 700,
              fontSize: { xs: 28, md: 40 },
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: s.txt,
              mb: 2,
            }}
          >
            {t("developerShowcase.title", { defaultValue: "Integrate in ~10 minutes." })}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_HERO,
              fontWeight: 300,
              fontSize: { xs: 20, md: 26 },
              letterSpacing: "-0.015em",
              lineHeight: 1.25,
              color: s.sub,
              mb: 2.5,
            }}
          >
            {t("developerShowcase.titleTail", {
              defaultValue: "15+ chains. One API. No smart contracts.",
            })}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_BODY,
              fontSize: { xs: 15, md: 16.5 },
              color: s.sub,
              lineHeight: 1.6,
              mb: 3.5,
              maxWidth: 540,
            }}
          >
            {t("developerShowcase.subtitle", {
              defaultValue:
                "Ship a checkout in an afternoon. REST + webhooks, idempotent everywhere, sandbox key you can copy right now — the same primitives you already know from Stripe, but for on-chain money.",
            })}
          </Typography>

          <Box sx={{ mb: 4 }}>
            {bullets.map((b, i) => (
              <motion.div
                key={b}
                initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, mb: 1.5 }}>
                  <CheckCircle sx={{ fontSize: 18, color: DEV_ACCENT, mt: "2px", flexShrink: 0 }} />
                  <Typography
                    sx={{
                      fontFamily: FONT_BODY,
                      fontSize: 14.5,
                      color: s.txt,
                      lineHeight: 1.5,
                    }}
                  >
                    {b}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Box
              component="button"
              type="button"
              onClick={() => router.push("/documentation")}
              data-testid="developer-showcase-cta"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3,
                py: 1.5,
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                backgroundColor: DEV_ACCENT,
                color: "#0A0A0A",
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 15,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "translate(-2px,-2px)",
                  boxShadow: "4px 4px 0 rgba(124,177,255,0.45)",
                },
              }}
            >
              {t("developerShowcase.cta", { defaultValue: "Read the docs" })}
              <ArrowForward sx={{ fontSize: 17 }} />
            </Box>
            <Box
              component="a"
              href="#try-it-now"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                document.getElementById("try-it-now")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              data-testid="developer-showcase-cta-secondary"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                fontFamily: FONT_TECH,
                fontSize: 13,
                letterSpacing: "0.06em",
                color: s.sub,
                textDecoration: "none",
                px: 1,
                py: 1.5,
                cursor: "pointer",
                transition: "color 0.2s ease",
                "&:hover": { color: DEV_ACCENT },
              }}
            >
              {t("developerShowcase.ctaSecondary", { defaultValue: "Try it live" })} ↓
            </Box>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={snack}
        autoHideDuration={1600}
        onClose={() => setSnack(false)}
        message={t("developerShowcase.copied", { defaultValue: "cURL copied" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
};

export default memo(DeveloperShowcase);
