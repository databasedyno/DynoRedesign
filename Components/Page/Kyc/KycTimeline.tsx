import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import PanelCard from "@/Components/UI/PanelCard";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { formatDateTimeI18n } from "@/utils/formatDate";
import type { KycView } from "./useKycPage";

type StepState = "done" | "current" | "upcoming" | "failed";

interface Props {
  view: KycView;
  status: string;
  latest?: { submitted_at?: string | null; reviewed_at?: string | null } | null;
}

/** Step-by-step verification timeline: where you are, what's needed next, how long it usually takes. */
const KycTimeline = ({ view, status, latest }: Props) => {
  const { t } = useTranslation("dashboardLayout");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const line = theme.palette.divider;
  const failed = view === "retry";
  const stageIdx = view === "verified" ? 3 : view === "in_review" ? 2 : status === "pending" ? 1 : 0;

  const when = (iso?: string | null) => (iso ? formatDateTimeI18n(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null);
  const steps: Array<{ id: string; title: string; body: string; wait: string; state: StepState; stamp?: string | null }> = [
    {
      id: "prepare",
      title: t("kycTimeline.prepare.title", { defaultValue: "Get your documents ready" }),
      body: t("kycTimeline.prepare.body", { defaultValue: "A government photo ID (passport, ID card or driving licence) and a device with a camera for a quick selfie." }),
      wait: t("kycTimeline.prepare.wait", { defaultValue: "2 minutes" }),
      state: stageIdx > 0 ? "done" : "current",
    },
    {
      id: "submit",
      title: t("kycTimeline.submit.title", { defaultValue: "Submit your verification" }),
      body: failed
        ? t("kycTimeline.submit.retryBody", { defaultValue: "Your last attempt didn't go through — start again with a clear, well-lit photo of the full document." })
        : t("kycTimeline.submit.body", { defaultValue: "Follow the secure Veriff flow: photograph your ID, take a selfie, done." }),
      wait: t("kycTimeline.submit.wait", { defaultValue: "5–10 minutes" }),
      state: failed ? "failed" : stageIdx > 1 ? "done" : stageIdx === 1 ? "current" : "upcoming",
      stamp: when(latest?.submitted_at),
    },
    {
      id: "review",
      title: t("kycTimeline.review.title", { defaultValue: "We review it" }),
      body: t("kycTimeline.review.body", { defaultValue: "Most checks clear automatically within minutes. If a manual look is needed you'll get an email either way — nothing else to do." }),
      wait: t("kycTimeline.review.wait", { defaultValue: "Minutes · up to 48 h" }),
      state: stageIdx > 2 ? "done" : stageIdx === 2 ? "current" : "upcoming",
    },
    {
      id: "verified",
      title: t("kycTimeline.verified.title", { defaultValue: "Verified — payouts unlocked" }),
      body: t("kycTimeline.verified.body", { defaultValue: "Full limits, live payment links and settlements to your payout addresses." }),
      wait: t("kycTimeline.verified.wait", { defaultValue: "Done" }),
      state: stageIdx === 3 ? "done" : "upcoming",
      stamp: stageIdx === 3 ? when(latest?.reviewed_at) : null,
    },
  ];

  const colour = (st: StepState) =>
    st === "done" ? (isDark ? "#4ADE80" : "#15803D") : st === "failed" ? (isDark ? "#FCA5A5" : "#B91C1C") : st === "current" ? theme.palette.primary.main : muted;
  const icon = (st: StepState) => (st === "done" ? "mdi:check-bold" : st === "failed" ? "mdi:alert" : st === "current" ? "mdi:circle-medium" : "mdi:circle-outline");

  return (
    <PanelCard title={t("kycTimeline.title", { defaultValue: "How verification works" })} showHeaderBorder={false} bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 2.5 } }}>
      <Box component="ol" data-testid="kyc-timeline" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const c = colour(s.state);
          return (
            <Box component="li" key={s.id} data-testid={`kyc-step-${s.id}`} data-state={s.state} aria-current={s.state === "current" || s.state === "failed" ? "step" : undefined} sx={{ display: "grid", gridTemplateColumns: "28px 1fr", columnGap: 1.5, position: "relative", pb: last ? 0 : 2.5 }}>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, color: s.state === "done" || s.state === "failed" ? "#fff" : c, backgroundColor: s.state === "done" || s.state === "failed" ? c : "transparent", border: `2px solid ${c}`, boxShadow: s.state === "current" ? `0 0 0 4px ${isDark ? "rgba(99,102,241,0.25)" : "rgba(79,70,229,0.14)"}` : "none" }}>
                  <Icon icon={icon(s.state)} width={s.state === "current" ? 22 : 15} />
                </Box>
                {!last && <Box sx={{ flex: 1, width: 2, mt: 0.5, borderRadius: 1, backgroundColor: s.state === "done" ? colour("done") : line }} />}
              </Box>
              <Box sx={{ minWidth: 0, pt: 0.25 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: s.state === "upcoming" ? muted : theme.palette.text.primary }}>{s.title}</Typography>
                  <Typography data-testid={`kyc-step-wait-${s.id}`} sx={{ fontSize: 11.5, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    <Icon icon="mdi:clock-outline" width={13} />
                    {s.wait}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: muted, lineHeight: 1.5, mt: 0.35 }}>{s.body}</Typography>
                {s.stamp && <Typography sx={{ fontSize: 11.5, color: muted, mt: 0.5 }}>{s.stamp}</Typography>}
                {s.state === "current" && s.id !== "review" && (
                  <Typography data-testid="kyc-step-next" sx={{ fontSize: 12.5, fontWeight: 700, color: theme.palette.primary.main, mt: 0.75 }}>
                    {t("kycTimeline.nextUp", { defaultValue: "Next up — use the button above to continue." })}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </PanelCard>
  );
};

export default KycTimeline;
