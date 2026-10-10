import React, { useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { Icon } from "@/styles/uiKit";
import { KycInsights, useKycTones, useUsd } from "./kycInsights";

/** Short FAQ — the questions merchants actually ask about verification and payouts. */
const KycFaq: React.FC<{ k: KycInsights }> = ({ k }) => {
  const { t } = useTranslation("dashboardLayout");
  const tones = useKycTones();
  const usd = useUsd();
  const threshold = usd(k.threshold);
  const days = k.graceDays;
  const [open, setOpen] = useState<string | null>("settlement");

  const items = [
    {
      id: "settlement",
      q: t("kycInsights.faq.q1", { defaultValue: "Can missing verification hold my settlements?" }),
      a: t("kycInsights.faq.a1", { threshold, defaultValue: "No. Settlement never checks verification status. Every payment that reaches your deposit address is forwarded to your payout wallet at every stage — under {{threshold}}, during the grace period, and even after it ends." }),
    },
    {
      id: "counts",
      q: t("kycInsights.faq.q2", { threshold, defaultValue: "What counts toward the {{threshold}}?" }),
      a: t("kycInsights.faq.a2", { defaultValue: "Successful payments for this brand, all time, in US dollars. Pending, expired and failed payments don't count." }),
    },
    {
      id: "start",
      q: t("kycInsights.faq.q3", { days, defaultValue: "When does the {{days}}-day grace period start?" }),
      a: t("kycInsights.faq.a3", { threshold, defaultValue: "Only on the day this brand's successful payments first add up to {{threshold}}. Until then, no clock is running." }),
    },
    {
      id: "end",
      q: t("kycInsights.faq.q4", { defaultValue: "What happens if the grace period ends before I verify?" }),
      a: t("kycInsights.faq.a4", { defaultValue: "New checkouts and new payment links pause until you're approved. Payments you've already received — and ones already in progress — still settle. As soon as you're approved, everything switches back on." }),
    },
    {
      id: "brands",
      q: t("kycInsights.faq.q5", { defaultValue: "Do I need to verify each brand separately?" }),
      a: t("kycInsights.faq.a5", { defaultValue: "No. Verification is for you as the account owner, so one approval covers every brand you own. Volume is counted per brand." }),
    },
    {
      id: "early",
      q: t("kycInsights.faq.q6", { threshold, defaultValue: "Can I verify before I reach {{threshold}}?" }),
      a: t("kycInsights.faq.a6", { defaultValue: "Yes. It takes about 5–10 minutes, and once you're approved the verified badge appears on your checkout." }),
    },
    {
      id: "privacy",
      q: t("kycInsights.faq.q7", { defaultValue: "Who handles my documents?" }),
      a: t("kycInsights.faq.a7", { defaultValue: "Our verification partner Veriff checks your ID and selfie. Dynopay never stores your ID images." }),
    },
  ];

  return (
    <PanelCard
      title={t("kycInsights.faq.title", { defaultValue: "Common questions" })}
      showHeaderBorder={false}
      sx={{ height: "100%" }}
      bodySx={{ px: { xs: 1, md: 1.5 }, pt: { xs: 0.5, md: 1 }, pb: { xs: 1, md: 1.5 } }}
    >
      <Box data-testid="kyc-faq" sx={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => {
          const isOpen = open === it.id;
          return (
            <Box key={it.id} data-testid={`kyc-faq-${it.id}`} data-open={isOpen ? "1" : "0"} sx={{ borderTop: i === 0 ? "none" : `1px solid ${tones.border}` }}>
              <Box
                component="button"
                type="button"
                data-testid={`kyc-faq-${it.id}-toggle`}
                data-touch-44=""
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : it.id)}
                sx={{
                  width: "100%",
                  minHeight: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  px: { xs: 1, md: 1 },
                  py: 1.25,
                  border: 0,
                  borderRadius: "10px",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 700,
                  color: tones.ink,
                  "&:hover": { backgroundColor: tones.isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.03)" },
                  "&:focus-visible": { outline: `2px solid ${tones.accent}`, outlineOffset: 2 },
                }}
              >
                <span>{it.q}</span>
                <Box component="span" sx={{ display: "flex", flexShrink: 0, color: tones.muted, transition: "transform 200ms ease", transform: isOpen ? "rotate(180deg)" : "none" }}>
                  <Icon name="chevron-down" size={16} />
                </Box>
              </Box>
              <Collapse in={isOpen}>
                <Typography data-testid={`kyc-faq-${it.id}-answer`} sx={{ px: 1, pb: 1.5, fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.6, color: tones.muted }}>
                  {it.a}
                </Typography>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </PanelCard>
  );
};

export default KycFaq;
