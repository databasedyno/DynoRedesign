import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { Icon } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import { KycInsights, useKycTones, useUsd } from "./kycInsights";

type CapState = "always" | "on" | "paused" | "later";

/** "What works right now" — a live checklist for this brand's current stage. */
const KycCapabilities: React.FC<{ k: KycInsights }> = ({ k }) => {
  const { t } = useTranslation("dashboardLayout");
  const tones = useKycTones();
  const usd = useUsd();
  const paused = k.stage === "paused";
  const verified = k.stage === "verified";

  const rows: Array<{ id: string; icon: string; label: string; desc: string; state: CapState }> = [
    { id: "settlement", icon: "wallet", label: t("kycInsights.caps.settlement", { defaultValue: "Settlement to your payout wallet" }), desc: t("kycInsights.caps.settlementDesc", { defaultValue: "Every payment that reaches your deposit address is forwarded to you." }), state: "always" },
    { id: "inflight", icon: "hourglass", label: t("kycInsights.caps.inflight", { defaultValue: "Payments already in progress" }), desc: t("kycInsights.caps.inflightDesc", { defaultValue: "Customers who already have a payment address can finish paying, and those funds settle normally." }), state: "always" },
    { id: "records", icon: "receipt", label: t("kycInsights.caps.records", { defaultValue: "Transactions, receipts & reports" }), desc: t("kycInsights.caps.recordsDesc", { defaultValue: "Your full history and downloads stay available." }), state: "always" },
    {
      id: "checkouts",
      icon: "store",
      label: t("kycInsights.caps.checkouts", { defaultValue: "New checkouts (links, store & API)" }),
      desc: paused ? t("kycInsights.caps.pausedDesc", { defaultValue: "Paused until you're verified — back on as soon as you're approved." }) : t("kycInsights.caps.checkoutsDesc", { defaultValue: "Customers can start new payments." }),
      state: paused ? "paused" : "on",
    },
    {
      id: "links",
      icon: "link",
      label: t("kycInsights.caps.links", { defaultValue: "Creating new payment links" }),
      desc: paused ? t("kycInsights.caps.pausedDesc", { defaultValue: "Paused until you're verified — back on as soon as you're approved." }) : t("kycInsights.caps.linksDesc", { defaultValue: "Create as many links as you like." }),
      state: paused ? "paused" : "on",
    },
    {
      id: "badge",
      icon: "badge-check",
      label: t("kycInsights.caps.badge", { defaultValue: "Verified badge at checkout" }),
      desc: verified ? t("kycInsights.caps.badgeOn", { defaultValue: "Shown to your customers." }) : t("kycInsights.caps.badgeLater", { defaultValue: "Unlocks when you verify — optional until it's required." }),
      state: verified ? "on" : "later",
    },
  ];

  const pill = (s: CapState) => {
    const map: Record<CapState, { text: string; color: string; bg: string; icon: string }> = {
      always: { text: t("kycInsights.caps.pillAlways", { defaultValue: "Always on" }), color: tones.positive, bg: tones.positiveGlow, icon: "shield-check" },
      on: { text: t("kycInsights.caps.pillOn", { defaultValue: "On" }), color: tones.positive, bg: tones.positiveGlow, icon: "circle-check" },
      paused: { text: t("kycInsights.caps.pillPaused", { defaultValue: "Paused" }), color: tones.negative, bg: tones.negativeGlow, icon: "circle-pause" },
      later: { text: t("kycInsights.caps.pillLater", { defaultValue: "After verification" }), color: tones.muted, bg: "transparent", icon: "lock" },
    };
    const p = map[s];
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: 999, flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: p.color, backgroundColor: p.bg, border: `1px solid ${s === "later" ? tones.border : `${p.color}40`}` }}>
        <Icon name={p.icon} size={13} />
        {p.text}
      </Box>
    );
  };

  const date = k.graceEnd ? formatDateI18n(k.graceEnd, { day: "numeric", month: "short", year: "numeric" }) : "";
  const footer =
    k.stage === "below"
      ? t("kycInsights.caps.noteBelow", { threshold: usd(k.threshold), defaultValue: "Nothing on this list changes until this brand reaches {{threshold}}." })
      : k.stage === "grace"
        ? date
          ? t("kycInsights.caps.noteGrace", { date, defaultValue: "If you haven't verified by {{date}}, only new checkouts and new payment links pause — and they switch back on the moment you're approved." })
          : t("kycInsights.caps.noteGraceNoDate", { defaultValue: "If the grace period ends before you verify, only new checkouts and new payment links pause — and they switch back on the moment you're approved." })
        : paused
          ? t("kycInsights.caps.notePaused", { defaultValue: "Verify to switch new checkouts and payment links back on — it takes effect as soon as you're approved." })
          : k.stage === "exempt"
            ? t("kycInsights.caps.noteExempt", { defaultValue: "This account is exempt, so nothing here is ever restricted by verification." })
            : t("kycInsights.caps.noteVerified", { defaultValue: "Everything is on. One verification covers every brand on your account." });

  return (
    <PanelCard
      title={t("kycInsights.caps.title", { defaultValue: "What works right now" })}
      subTitle={t("kycInsights.caps.subtitle", { defaultValue: "Live for this brand, based on its verification stage today." })}
      showHeaderBorder={false}
      sx={{ height: "100%" }}
      bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 2.5 } }}
    >
      <Box data-testid="kyc-capabilities" data-stage={k.stage}>
        <Box data-testid="kyc-settlement-assurance" sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: { xs: 1.5, md: 1.75 }, mb: 1.5, borderRadius: "14px", backgroundColor: tones.positiveGlow, border: `1px solid ${tones.positive}40` }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "grid", placeItems: "center", color: "#fff", backgroundColor: tones.positive }}>
            <Icon name="shield-check" size={21} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 800, color: tones.ink }}>
              {t("kycInsights.caps.assuranceTitle", { defaultValue: "Settlement is never held for verification" })}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: tones.ink, opacity: 0.85, mt: 0.25 }}>
              {t("kycInsights.caps.assuranceBody", { defaultValue: "Whatever your verification status, money that arrives is forwarded to your payout wallet. Verification only ever affects starting new payments — and only after the grace period." })}
            </Typography>
          </Box>
        </Box>

        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column" }}>
          {rows.map((r, i) => (
            <Box
              component="li"
              key={r.id}
              data-testid={`kyc-cap-${r.id}`}
              data-state={r.state}
              sx={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", alignItems: "center", columnGap: 1.5, py: 1.25, borderTop: i === 0 ? "none" : `1px solid ${tones.border}` }}
            >
              <Box sx={{ width: 36, height: 36, borderRadius: "10px", display: "grid", placeItems: "center", color: r.state === "paused" ? tones.negative : r.state === "later" ? tones.muted : tones.accent, backgroundColor: r.state === "paused" ? tones.negativeGlow : tones.accentGlow }}>
                <Icon name={r.icon} size={17} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: tones.ink }}>{r.label}</Typography>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.45, color: tones.muted, mt: 0.2 }}>{r.desc}</Typography>
              </Box>
              {pill(r.state)}
            </Box>
          ))}
        </Box>

        <Box data-testid="kyc-capabilities-note" sx={{ mt: 1.25, pt: 1.5, borderTop: `1px solid ${tones.border}`, display: "flex", gap: 1, alignItems: "flex-start", fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.5, color: tones.muted }}>
          <Box sx={{ display: "flex", mt: "2px", flexShrink: 0 }}>
            <Icon name="info" size={14} />
          </Box>
          <span>{footer}</span>
        </Box>
      </Box>
    </PanelCard>
  );
};

export default KycCapabilities;
