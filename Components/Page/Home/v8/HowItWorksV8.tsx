import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArrowLink, FONT_BODY, FONT_DISPLAY, FONT_MONO, Reveal, SectionHeadV8, SectionV8, useConsole } from "./kit";

/* ============================================================================
 * HowItWorksV8 — a compact three-step strip (the product bento above already
 * shows the UI, so this stays text-first: numbered steps separated by
 * hairlines, one pointer to the docs).
 * ========================================================================== */

const HowItWorksV8: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");

  const steps = [
    { title: t("v8.how.s1.title", { defaultValue: "Create a link or connect the API" }), desc: t("v8.how.s1.desc", { defaultValue: "Make a payment link, hosted checkout or invoice in the dashboard — or create payments from your server with one call." }) },
    { title: t("v8.how.s2.title", { defaultValue: "Your customer pays" }), desc: t("v8.how.s2.desc", { defaultValue: "They scan and send from any wallet, in the coin they already hold. You watch it confirm on-chain in real time." }) },
    { title: t("v8.how.s3.title", { defaultValue: "It settles to your wallet" }), desc: t("v8.how.s3.desc", { defaultValue: "Funds land in a wallet only you control — as the coin you were paid, or as USDT/USDC if auto-convert is on." }) },
  ];

  return (
    <SectionV8 id="how-it-works" testId="how-it-works" maxWidth={1240} sx={{ background: s.surface, borderTop: `1px solid ${s.line}`, borderBottom: `1px solid ${s.line}`, py: { xs: 7, md: 10 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.8fr) minmax(0, 1.6fr)" }, gap: { xs: 4, lg: 8 }, alignItems: "start" }}>
        <SectionHeadV8
          eyebrow={t("v8.how.eyebrow", { defaultValue: "How it works" })}
          title={t("v8.how.title", { defaultValue: "Live in three steps" })}
          lead={t("v8.how.lead", { defaultValue: "Minutes from sign-up to your first crypto payment — whether you sell online, invoice clients or take donations." })}
          maxWidth={420}
          sx={{ mb: { xs: 0, lg: 0 } }}
        />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <Box
                data-testid={`step-${i + 1}-card`}
                sx={{
                  position: "relative",
                  py: { xs: 3, md: 1 },
                  px: { xs: 0, md: i === 0 ? 0 : 3.5 },
                  pr: { md: i === 2 ? 0 : 3.5 },
                  borderTop: { xs: i === 0 ? "none" : `1px solid ${s.line}`, md: "none" },
                  borderLeft: { md: i === 0 ? "none" : `1px solid ${s.line}` },
                }}
              >
                <Typography component="span" sx={{ display: "inline-block", fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: s.accent, mb: 1.75 }}>
                  0{i + 1}
                </Typography>
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 19, md: 20 }, fontWeight: 700, letterSpacing: "-0.012em", lineHeight: 1.25, color: s.ink }}>
                  {step.title}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2, mt: 1.25 }}>{step.desc}</Typography>
              </Box>
            </Reveal>
          ))}
          <Box sx={{ gridColumn: "1 / -1", mt: { xs: 1, md: 4 } }}>
            <ArrowLink href="/documentation" testId="how-docs-link">
              {t("v8.how.cta", { defaultValue: "Developers: read the integration docs" })}
              <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
            </ArrowLink>
          </Box>
        </Box>
      </Box>
    </SectionV8>
  );
};

export default memo(HowItWorksV8);
