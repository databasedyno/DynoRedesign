import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { SurfaceCard, CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import ProgressRing from "./ProgressRing";
import { STEP_ICON, stepDesc, stepLabel } from "./stepMeta";
import type { SetupProgress, SetupStepKey } from "./useSetupProgress";
import { SETUP_STEPS } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  current: SetupStepKey;
  onSelect: (step: SetupStepKey) => void;
  onLater: () => void;
  children: React.ReactNode;
}

/** Page chrome for /get-started: title + "Do this later", step rail (desktop) / stepper (phone), content card. */
const WizardShell: React.FC<Props> = ({ progress, current, onSelect, onLater, children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { steps, doneCount, total, firstIncomplete } = progress;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  const currentIndex = SETUP_STEPS.indexOf(current);
  const firstIncompleteIndex = SETUP_STEPS.indexOf(firstIncomplete);
  const isReachable = (i: number) => steps[i].done || i <= firstIncompleteIndex || i <= currentIndex;

  return (
    <Box
      data-testid="gs-wizard"
      data-step={current}
      sx={{
        maxWidth: 1180,
        mx: "auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2, md: 3 },
        "@keyframes gsRise": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "none" },
        },
        "& > *": { animation: "gsRise 280ms cubic-bezier(0.2, 0.7, 0.2, 1) both" },
        "@media (prefers-reduced-motion: reduce)": { "& > *": { animation: "none" } },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="h1"
            data-testid="gs-wizard-title"
            sx={{
              m: 0,
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontSize: { xs: 24, md: 30 },
              lineHeight: 1.15,
              color: ink,
            }}
          >
            {t("gs.wizardTitle", { defaultValue: "Set up Dynopay" })}
          </Box>
          <Box sx={{ mt: 0.75, fontFamily: "var(--font-sans)", fontSize: { xs: 13.5, md: 15 }, color: secondary, lineHeight: 1.5 }}>
            {t("gs.wizardSubtitle", { defaultValue: "Four short steps. Leave anytime — you'll pick up right where you left off." })}
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
            minHeight: 40,
            px: 1.75,
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: "transparent",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 600,
            color: secondary,
            transition: "background-color 160ms ease, border-color 160ms ease",
            "&:hover, &:focus-visible": {
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)",
              outline: "none",
            },
            "&:focus-visible": { boxShadow: `0 0 0 2px ${indigo}` },
          }}
        >
          {t("gs.doLater", { defaultValue: "Do this later" })}
          <Icon name="x" size={15} />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" },
          gap: { xs: 2, md: 3 },
          alignItems: "start",
        }}
      >
        {/* Desktop rail */}
        <SurfaceCard
          data-testid="gs-rail"
          sx={{ display: { xs: "none", md: "block" }, position: "sticky", top: 0, p: 2.5 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, pb: 2.5, mb: 1.5, borderBottom: `1px solid ${border}` }}>
            <ProgressRing
              value={doneCount}
              total={total}
              size={64}
              stroke={6}
              testId="gs-rail-ring"
              label={t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
            />
            <Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
                {t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
              </Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, mt: 0.25 }}>
                {t("gs.railHint", { defaultValue: "Progress is saved as you go" })}
              </Box>
            </Box>
          </Box>
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
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
                    gap: 1.25,
                    px: 1.25,
                    py: 1,
                    borderRadius: "12px",
                    cursor: reachable ? "pointer" : "default",
                    opacity: reachable ? 1 : 0.55,
                    outline: "none",
                    backgroundColor: active
                      ? isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow
                      : "transparent",
                    transition: "background-color 160ms ease",
                    ...(reachable && {
                      "&:hover, &:focus-visible": {
                        backgroundColor: active
                          ? isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow
                          : isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)",
                      },
                      "&:focus-visible": { boxShadow: `0 0 0 2px ${indigo}` },
                    }),
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: s.done ? "#FFFFFF" : active ? indigo : muted,
                      backgroundColor: s.done
                        ? positive
                        : isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)",
                    }}
                  >
                    <Icon name={s.done ? "check" : STEP_ICON[s.key]} size={15} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? ink : s.done ? muted : ink }}>
                      {stepLabel(t, s.key)}
                    </Box>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted, lineHeight: 1.3 }}>
                      {s.done ? t("gs.stepDone", { defaultValue: "Done" }) : stepDesc(t, s.key)}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </SurfaceCard>

        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Phone stepper */}
          <Box data-testid="gs-stepper" sx={{ display: { xs: "block", md: "none" } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: ink }}>
                {t("gs.stepOf", { n: currentIndex + 1, total, defaultValue: "Step {{n}} of {{total}}" })}
                <Box component="span" sx={{ color: muted, fontWeight: 500 }}> · {stepLabel(t, current)}</Box>
              </Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: muted }}>
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
                    aria-label={stepLabel(t, s.key)}
                    aria-current={active ? "step" : undefined}
                    disabled={!reachable}
                    onClick={() => onSelect(s.key)}
                    sx={{
                      height: 6,
                      p: 0,
                      border: 0,
                      borderRadius: 999,
                      cursor: reachable ? "pointer" : "default",
                      backgroundColor: s.done ? positive : active ? indigo : isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.10)",
                      transition: "background-color 200ms ease",
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <SurfaceCard data-testid="gs-step-card" sx={{ p: { xs: 2.5, md: 4 } }}>
            {children}
          </SurfaceCard>
        </Box>
      </Box>
    </Box>
  );
};

export default WizardShell;
