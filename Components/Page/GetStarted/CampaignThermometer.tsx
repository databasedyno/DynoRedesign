import React, { useEffect, useMemo, useState } from "react";
import { Box, keyframes, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { formatPreviewAmount } from "./CheckoutPreview";

interface Props {
  /** Parsed goal amount (0 / NaN → no goal set yet). */
  goalAmount: number;
  currency: string;
  /** Parsed, positive suggested amounts. */
  presets: number[];
}

const shimmer = keyframes`
  0%   { transform: translateX(-100%); opacity: 0; }
  40%  { opacity: 0.85; }
  100% { transform: translateX(420%); opacity: 0; }
`;

/**
 * Fundraiser track — a live goal-progress "thermometer" the fundraiser can
 * preview inside the wizard (3b). It reflects the goal/currency as typed and,
 * tapping any suggested amount, animates the bar to visualise the momentum one
 * gift creates ("a $50 gift = 1% of your goal"). No money is involved — it is a
 * preview of how the public campaign bar will behave.
 */
const CampaignThermometer: React.FC<Props> = ({ goalAmount, currency, presets }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const glow = isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow;
  const success = "#10B981";

  const hasGoal = Number.isFinite(goalAmount) && goalAmount > 0;
  const fmt = (n: number) => formatPreviewAmount(String(n), currency) || `${n}`;

  const [simRaised, setSimRaised] = useState(0);
  // Reset the simulation whenever the goal changes so stale % never lingers.
  useEffect(() => { setSimRaised(0); }, [goalAmount, currency]);

  const percentRaw = hasGoal ? (simRaised / goalAmount) * 100 : 0;
  const reached = percentRaw >= 100;
  const target = Math.min(100, Math.max(0, percentRaw));

  const [barValue, setBarValue] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setBarValue(target), 80);
    return () => clearTimeout(id);
  }, [target]);

  const activePreset = useMemo(
    () => presets.find((p) => Math.abs(p - simRaised) < 0.001) ?? null,
    [presets, simRaised],
  );

  const fillGradient = reached
    ? `linear-gradient(90deg, #34D399 0%, ${success} 100%)`
    : `linear-gradient(90deg, ${indigo} 0%, #8B5CF6 100%)`;

  return (
    <Box
      data-testid="gs-campaign-thermometer"
      data-has-goal={hasGoal ? "true" : "false"}
      sx={{ p: 2, borderRadius: "16px", border: `1px solid ${border}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box sx={{ color: indigo, display: "flex" }}><Icon name="target" size={16} /></Box>
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: ink }}>
          {t("gs.campaignPreviewTitle", { defaultValue: "Your goal thermometer" })}
        </Box>
      </Box>

      {!hasGoal ? (
        <Box data-testid="gs-thermometer-nogoal" sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.5 }}>
          {t("gs.campaignPreviewHint", { defaultValue: "Add a goal above to preview your thermometer." })}
          <Box sx={{ mt: 0.5, color: theme.palette.text.disabled }}>
            {t("gs.campaignPreviewNoGoal", { defaultValue: "No goal — supporters can give any amount" })}
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Box data-testid="gs-thermometer-raised" sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 26, sm: 30 }, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: ink }}>
                {fmt(simRaised)}
              </Box>
              <Box sx={{ mt: 0.75, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
                {t("gs.campaignPreviewRaisedOf", { goal: fmt(goalAmount), defaultValue: "raised of {{goal}}" })}
              </Box>
            </Box>
            <Box
              data-testid="gs-thermometer-percent"
              sx={{ px: 1.25, py: 0.5, borderRadius: 999, fontFamily: MONO, fontWeight: 800, fontSize: 12.5, lineHeight: 1, display: "inline-flex", alignItems: "center", gap: 0.5, color: reached ? "#FFFFFF" : indigo, backgroundColor: reached ? success : glow }}
            >
              {reached && <Icon name="trophy" size={13} />}
              {Math.round(percentRaw)}% {t("gs.campaignPreviewFunded", { defaultValue: "funded" })}
            </Box>
          </Box>

          <Box sx={{ position: "relative", mt: 1.5, height: 12, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", overflow: "hidden" }} data-testid="gs-thermometer-track">
            <Box
              data-testid="gs-thermometer-fill"
              sx={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${barValue}%`, background: fillGradient, borderRadius: 999, transition: "width 760ms cubic-bezier(0.16,1,0.3,1)", overflow: "hidden" }}
            >
              {!reached && barValue > 3 && (
                <Box aria-hidden sx={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "30%", background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)", animation: `${shimmer} 2.4s ease-in-out infinite` }} />
              )}
            </Box>
          </Box>

          {presets.length > 0 && (
            <>
              <Box sx={{ mt: 1.5, fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
                {t("gs.campaignPreviewTapHint", { defaultValue: "Tap a suggested amount to picture the momentum" })}
              </Box>
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                {presets.map((p, i) => {
                  const active = activePreset === p;
                  return (
                    <Box
                      key={`${p}-${i}`}
                      component="button"
                      type="button"
                      data-testid={`gs-thermometer-preset-${i + 1}`}
                      data-active={active ? "true" : "false"}
                      onClick={() => setSimRaised(active ? 0 : p)}
                      sx={{ minHeight: 34, px: 1.5, borderRadius: 999, cursor: "pointer", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: active ? "#FFFFFF" : ink, border: `1px solid ${active ? indigo : border}`, backgroundColor: active ? indigo : "transparent", transition: "background-color 160ms ease, color 160ms ease" }}
                    >
                      {fmt(p)}
                    </Box>
                  );
                })}
                {simRaised > 0 && (
                  <Box
                    component="button"
                    type="button"
                    data-testid="gs-thermometer-reset"
                    onClick={() => setSimRaised(0)}
                    sx={{ minHeight: 34, px: 1.25, borderRadius: 999, cursor: "pointer", border: 0, background: "transparent", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: muted, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                  >
                    {t("gs.campaignPreviewReset", { defaultValue: "Reset preview" })}
                  </Box>
                )}
              </Box>
              {simRaised > 0 && (
                <Box data-testid="gs-thermometer-impact" sx={{ mt: 1.25, fontFamily: "var(--font-sans)", fontSize: 12.5, color: reached ? success : indigo, fontWeight: 600 }}>
                  {t("gs.campaignPreviewGiftImpact", { amount: fmt(simRaised), percent: Math.max(1, Math.round(percentRaw)), defaultValue: "A {{amount}} gift moves you {{percent}}% toward your goal" })}
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default CampaignThermometer;
