import React from "react";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { SurfaceCard, Eyebrow, PrimaryCTA, CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { trackOnboarding } from "@/utils/trackOnboarding";
import ProgressRing from "./ProgressRing";
import { STEP_ICON, STEP_TRACK_KEY, stepDesc, stepLabel } from "./stepMeta";
import type { SetupProgress, SetupStepKey } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
}

/**
 * GettingStartedHero — the new-merchant dashboard headline (plan 1.19).
 * Progress ring + the four setup steps derived from real data, with ONE
 * primary CTA that resumes the guided wizard at the first unfinished step.
 */
const GettingStartedHero: React.FC<Props> = ({ progress }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const { steps, doneCount, total, firstIncomplete, hasLink, hasPayment } = progress;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  const almost = doneCount === total - 1 && hasLink;
  // A4: every step done (link shared) but no money yet — celebrate the setup, wait for the payment.
  const allDone = doneCount === total && !hasPayment;
  const title = allDone
    ? t("gs.heroTitleAllDone", { defaultValue: "You're all set — waiting for your first payment" })
    : almost
      ? t("gs.heroTitleAlmost", { defaultValue: "Almost there — share your link" })
      : t("gs.heroTitle", { defaultValue: "Let's get you paid" });
  const subtitle = allDone
    ? t("gs.heroSubtitleAllDone", {
        defaultValue: "Your link is out there. The moment someone pays, this dashboard fills in with real numbers.",
      })
    : almost
      ? t("gs.heroSubtitleAlmost", {
          defaultValue:
            "Everything is set. Share your payment link and your dashboard fills in the moment the first payment lands.",
        })
      : t("gs.heroSubtitle", {
          defaultValue: "A few quick steps and your first crypto payment can land in your own wallet.",
        });
  const cta =
    doneCount === 0
      ? t("gs.ctaStart", { defaultValue: "Start setup" })
      : allDone
        ? t("gs.ctaShareAgain", { defaultValue: "Share it again" })
        : almost
          ? t("gs.ctaShare", { defaultValue: "Share your link" })
          : t("gs.ctaContinue", { defaultValue: "Continue setup" });

  const go = (step: SetupStepKey) => {
    trackOnboarding({ event_type: "step_clicked", step_key: STEP_TRACK_KEY[step], metadata: { surface: "dashboard_hero" } });
    router.push({ pathname: "/get-started", query: { step } });
  };

  return (
    <SurfaceCard data-testid="gs-hero" data-done={doneCount} sx={{ p: { xs: 2.5, md: 3.5 }, overflow: "hidden" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 260px" },
          gap: { xs: 2.5, md: 4 },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Eyebrow>{t("gs.heroEyebrow", { defaultValue: "Getting started" })}</Eyebrow>
              <Box
                component="h2"
                data-testid="gs-hero-title"
                sx={{
                  m: 0,
                  mt: 1,
                  fontFamily: "var(--font-sans)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontSize: { xs: 24, md: 30 },
                  lineHeight: 1.15,
                  color: ink,
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  mt: 1,
                  maxWidth: 560,
                  fontFamily: "var(--font-sans)",
                  fontSize: { xs: 14, md: 15 },
                  lineHeight: 1.55,
                  color: secondary,
                }}
              >
                {subtitle}
              </Box>
            </Box>
            <Box sx={{ display: { xs: "block", md: "none" } }}>
              <ProgressRing
                value={doneCount}
                total={total}
                size={64}
                stroke={6}
                testId="gs-hero-ring-mobile"
                label={t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
              />
            </Box>
          </Box>

          <Box
            component="ol"
            data-testid="gs-hero-steps"
            sx={{ listStyle: "none", m: 0, p: 0, mt: { xs: 2.5, md: 3 }, display: "grid", gap: 0.5 }}
          >
            {steps.map((s, i) => {
              const isNext = s.key === firstIncomplete && !s.done;
              const waiting = s.key === "share" && !hasPayment && hasLink;
              return (
                <Box
                  component="li"
                  key={s.key}
                  data-testid={`gs-hero-step-${s.key}`}
                  data-done={s.done}
                  data-next={isNext}
                  role="button"
                  tabIndex={0}
                  onClick={() => go(s.key)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      go(s.key);
                    }
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.25,
                    py: 1,
                    mx: -1.25,
                    borderRadius: "12px",
                    cursor: "pointer",
                    outline: "none",
                    border: `1px solid ${isNext ? indigo : "transparent"}`,
                    backgroundColor: isNext
                      ? isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow
                      : "transparent",
                    transition: "background-color 160ms ease, border-color 160ms ease",
                    "&:hover, &:focus-visible": {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)",
                    },
                    "&:focus-visible": { boxShadow: `0 0 0 2px ${indigo}` },
                  }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: s.done ? "#FFFFFF" : isNext ? indigo : muted,
                      backgroundColor: s.done
                        ? positive
                        : isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)",
                      transition: "background-color 200ms ease",
                    }}
                  >
                    <Icon name={s.done ? "check" : STEP_ICON[s.key]} size={16} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 14,
                        fontWeight: s.done ? 500 : 600,
                        color: s.done ? muted : ink,
                        textDecoration: s.done ? "line-through" : "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Box component="span" sx={{ color: muted, fontWeight: 500, mr: 0.75 }}>{i + 1}.</Box>
                      {stepLabel(t, s.key)}
                    </Box>
                    {(!s.done || waiting) && (
                      <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.35 }}>
                        {waiting
                          ? s.done
                            ? t("gs.stepSharedPending", { defaultValue: "Shared — waiting for your first payment" })
                            : t("gs.stepPending", { defaultValue: "Waiting for your first payment" })
                          : stepDesc(t, s.key)}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ color: isNext ? indigo : muted, display: "flex", flexShrink: 0 }}>
                    <Icon name="chevron-right" size={16} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
            pt: { md: 1 },
            pl: { md: 3 },
            borderLeft: { md: `1px solid ${border}` },
          }}
        >
          <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", alignItems: "center", gap: 1 }}>
            <ProgressRing
              value={doneCount}
              total={total}
              size={112}
              stroke={9}
              testId="gs-hero-ring"
              label={t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
            />
            <Box data-testid="gs-hero-progress-label" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: muted }}>
              {t("gs.progressLabel", { done: doneCount, total, defaultValue: "{{done}} of {{total}} done" })}
            </Box>
          </Box>
          <PrimaryCTA
            data-testid="gs-hero-cta"
            onClick={() => go(firstIncomplete)}
            endIcon={<Icon name="arrow-right" size={18} />}
            sx={{ height: 48, fontSize: 15 }}
          >
            {cta}
          </PrimaryCTA>
        </Box>
      </Box>
    </SurfaceCard>
  );
};

export default GettingStartedHero;
