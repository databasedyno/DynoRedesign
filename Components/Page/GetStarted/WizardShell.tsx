import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { GRAIN_URL } from "@/constants/creatorTheme";
import ProgressRing from "./ProgressRing";
import { stepDesc, stepIcon, stepLabel } from "./stepMeta";
import type { SetupProgress, SetupStepKey } from "./useSetupProgress";
import { SETUP_STEPS } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  current: SetupStepKey;
  onSelect: (step: SetupStepKey) => void;
  onLater: () => void;
  children: React.ReactNode;
}

const HERO = "var(--font-hero), var(--font-sans)";
const MONO = "var(--font-tech), var(--font-mono, monospace)";
const GOLD = "#FFD100";
const AQUA = "#2BD4C4";

export const wizardGlass = (dark: boolean) => ({
  position: "relative" as const,
  overflow: "hidden",
  borderRadius: "24px",
  border: `1px solid ${dark ? "rgba(255,255,255,0.09)" : "rgba(18,18,20,0.06)"}`,
  background: dark
    ? "linear-gradient(180deg, rgba(24,24,31,0.86) 0%, rgba(18,18,22,0.82) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.86) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: dark
    ? "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)"
    : "0 20px 50px rgba(139,94,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
});

/** Page chrome for /get-started: editorial header + glass step rail (desktop) / gradient stepper (phone) + glass content card. */
const WizardShell: React.FC<Props> = ({ progress, current, onSelect, onLater, children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { steps, doneCount, total, firstIncomplete, track } = progress;
  // I: per-track eyebrow — "Getting started · Creator".
  const trackLabel =
    track === "developers" ? t("gs.trackDeveloper", { defaultValue: "Developer" })
      : track === "creators" ? t("gs.trackCreator", { defaultValue: "Creator" })
        : track === "fundraisers" ? t("gs.trackFundraiser", { defaultValue: "Fundraiser" })
          : "";

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const accentText = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const border = isDark ? "rgba(255,255,255,0.09)" : "rgba(18,18,20,0.08)";

  const currentIndex = SETUP_STEPS.indexOf(current);
  const firstIncompleteIndex = SETUP_STEPS.indexOf(firstIncomplete);
  // "Secure your account" gates the money steps: payouts and beyond stay locked until a second factor is enrolled.
  const secureDone = steps[0]?.done ?? false;
  const isReachable = (i: number) =>
    (i < 2 || secureDone) && (steps[i].done || i <= firstIncompleteIndex || i <= currentIndex);

  const rise = (delayMs: number) => ({
    animation: `gsRise 520ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`,
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
  });

  return (
    <Box
      data-testid="gs-wizard"
      data-step={current}
      sx={{
        position: "relative",
        maxWidth: 1180,
        mx: "auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2, md: 3 },
        "@keyframes gsRise": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "none" },
        },
      }}
    >
      {/* Ambient accent glow behind the wizard */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: { xs: "-24px -16px auto -16px", md: "-48px -40px auto -40px" },
          height: 520,
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(55% 60% at 18% 0%, rgba(255,209,0,${isDark ? 0.16 : 0.2}) 0%, transparent 70%), radial-gradient(40% 50% at 92% 30%, rgba(43,212,196,${isDark ? 0.1 : 0.12}) 0%, transparent 70%)`,
          maskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
        }}
      />

      {/* Header */}
      <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, ...rise(0) }}>
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accentText,
              "&::before": { content: '""', width: 6, height: 6, borderRadius: "50%", backgroundColor: GOLD, boxShadow: `0 0 10px ${GOLD}` },
            }}
          >
            {t("gs.eyebrow", { defaultValue: "Getting started" })}{trackLabel ? ` · ${trackLabel}` : ""}
          </Box>
          <Box
            component="h1"
            data-testid="gs-wizard-title"
            sx={{
              m: 0,
              mt: 1,
              fontFamily: HERO,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              fontSize: { xs: 26, md: 34 },
              lineHeight: 1.1,
              color: ink,
            }}
          >
            {t("gs.wizardTitle", { defaultValue: "Set up Dynopay" })}
          </Box>
          <Box sx={{ mt: 1, fontFamily: "var(--font-sans)", fontSize: { xs: 13.5, md: 15 }, color: secondary, lineHeight: 1.55, maxWidth: 560 }}>
            {t("gs.wizardSubtitle", { defaultValue: "Five short steps. Leave anytime — you'll pick up right where you left off." })}
          </Box>
        </Box>
        <Box
          component="button"
          type="button"
          data-testid="gs-do-later"
          onClick={onLater}
          sx={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            minHeight: 44,
            px: 2,
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 600,
            color: secondary,
            transition: "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
              borderColor: isDark ? "rgba(255,209,0,0.4)" : "rgba(139,94,0,0.35)",
              transform: "translateY(-1px)",
            },
            "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
          }}
        >
          {t("gs.doLater", { defaultValue: "Do this later" })}
          <Icon name="x" size={15} />
        </Box>
      </Box>

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "300px minmax(0, 1fr)" },
          gap: { xs: 2, md: 3 },
          alignItems: "start",
        }}
      >
        {/* Desktop rail */}
        <Box
          data-testid="gs-rail"
          sx={{ ...wizardGlass(isDark), display: { xs: "none", md: "block" }, position: "sticky", top: 16, p: 2.5, ...rise(80) }}
        >
          <Box aria-hidden sx={{ position: "absolute", top: -90, right: -70, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,209,0,${isDark ? 0.16 : 0.14}) 0%, transparent 70%)`, pointerEvents: "none" }} />
          <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 2, pb: 2.5, mb: 1.5, borderBottom: `1px solid ${border}` }}>
            <ProgressRing
              value={doneCount}
              total={total}
              size={68}
              stroke={6}
              testId="gs-rail-ring"
              label={t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
            />
            <Box>
              <Box sx={{ fontFamily: HERO, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: ink }}>
                {t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
              </Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, mt: 0.375, lineHeight: 1.4 }}>
                {t("gs.railHint", { defaultValue: "Progress is saved as you go" })}
              </Box>
            </Box>
          </Box>
          <Box component="ol" sx={{ position: "relative", listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
            {steps.map((s, i) => {
              const active = s.key === current;
              const reachable = isReachable(i);
              return (
                <Box
                  component="li"
                  key={s.key}
                  data-testid={`gs-rail-step-${s.key}`}
                  data-active={active}
                  data-done={s.done}
                  role="button"
                  tabIndex={reachable ? 0 : -1}
                  aria-disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  onClick={() => reachable && onSelect(s.key)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (reachable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelect(s.key);
                    }
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.25,
                    py: 1.125,
                    borderRadius: "14px",
                    border: `1px solid ${active ? (isDark ? "rgba(255,209,0,0.35)" : "rgba(139,94,0,0.28)") : "transparent"}`,
                    cursor: reachable ? "pointer" : "default",
                    opacity: reachable ? 1 : 0.5,
                    outline: "none",
                    backgroundColor: active
                      ? isDark ? "rgba(255,209,0,0.10)" : "rgba(255,209,0,0.16)"
                      : "transparent",
                    boxShadow: active ? (isDark ? "0 10px 26px -18px rgba(255,209,0,0.8)" : "0 10px 26px -18px rgba(139,94,0,0.6)") : "none",
                    transition: "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
                    ...(reachable && {
                      "&:hover, &:focus-visible": {
                        backgroundColor: active
                          ? isDark ? "rgba(255,209,0,0.12)" : "rgba(255,209,0,0.2)"
                          : isDark ? "rgba(255,255,255,0.05)" : "rgba(18,18,20,0.035)",
                        transform: "translateX(2px)",
                      },
                      "&:focus-visible": { boxShadow: `0 0 0 2px ${GOLD}` },
                    }),
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "10px",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      color: s.done ? "#0A0A0D" : active ? "#121214" : muted,
                      background: s.done
                        ? `linear-gradient(135deg, ${AQUA} 0%, ${positive} 100%)`
                        : active
                          ? `linear-gradient(135deg, ${GOLD} 0%, #FFE566 100%)`
                          : isDark ? "rgba(255,255,255,0.06)" : "rgba(18,18,20,0.05)",
                      boxShadow: active ? "0 8px 18px -8px rgba(255,209,0,0.9)" : "none",
                    }}
                  >
                    {s.done ? <Icon name="check" size={16} /> : String(i + 1).padStart(2, "0")}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? ink : s.done ? muted : ink, letterSpacing: "-0.005em" }}>
                      {stepLabel(t, s.key, track)}
                    </Box>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted, lineHeight: 1.35, mt: 0.125 }}>
                      {s.done ? t("gs.stepDone", { defaultValue: "Done" }) : stepDesc(t, s.key, track)}
                    </Box>
                  </Box>
                  {!s.done && !active && <Box sx={{ ml: "auto", color: muted, display: "flex", opacity: 0.6 }}><Icon name={stepIcon(s.key, track)} size={15} /></Box>}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Phone stepper */}
          <Box data-testid="gs-stepper" sx={{ display: { xs: "block", md: "none" }, ...rise(60) }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25, gap: 1 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Box sx={{ px: 1, py: 0.375, borderRadius: 999, background: `linear-gradient(90deg, ${GOLD} 0%, #FFE566 100%)`, color: "#121214", fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", flexShrink: 0 }}>
                  {t("gs.stepOf", { n: currentIndex + 1, total, defaultValue: "Step {{n}} of {{total}}" })}
                </Box>
                <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {stepLabel(t, current, track)}
                </Box>
              </Box>
              <Box sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: muted, flexShrink: 0 }}>
                {t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 0.75 }}>
              {steps.map((s, i) => {
                const reachable = isReachable(i);
                const active = s.key === current;
                return (
                  <Box
                    key={s.key}
                    component="button"
                    type="button"
                    data-testid={`gs-stepper-${s.key}`}
                    aria-label={stepLabel(t, s.key, track)}
                    aria-current={active ? "step" : undefined}
                    disabled={!reachable}
                    onClick={() => onSelect(s.key)}
                    sx={{
                      height: 6,
                      p: 0,
                      border: 0,
                      borderRadius: 999,
                      cursor: reachable ? "pointer" : "default",
                      background: s.done
                        ? `linear-gradient(90deg, ${AQUA} 0%, ${positive} 100%)`
                        : active
                          ? `linear-gradient(90deg, ${GOLD} 0%, #FFE566 100%)`
                          : isDark ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.10)",
                      boxShadow: active ? `0 0 12px ${GOLD}99` : "none",
                      transition: "background-color 200ms ease, box-shadow 200ms ease",
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <Box data-testid="gs-step-card" sx={{ ...wizardGlass(isDark), p: { xs: 2.5, md: 4.5 }, ...rise(140) }}>
            <Box aria-hidden sx={{ position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)", width: 520, height: 300, borderRadius: "50%", background: `radial-gradient(ellipse at center, rgba(255,209,0,${isDark ? 0.14 : 0.12}) 0%, transparent 70%)`, pointerEvents: "none" }} />
            <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, opacity: isDark ? 0.05 : 0.035, mixBlendMode: "overlay", pointerEvents: "none" }} />
            <Box sx={{ position: "relative" }}>{children}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default WizardShell;
