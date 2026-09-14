import { brandFg } from "@/constants/theme";
import React, { useState, useCallback } from "react";
import {
  ArrowForwardRounded,
  CheckRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  LockRounded,
} from "@mui/icons-material";
import { Box, Collapse, IconButton, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { trackOnboarding } from "@/utils/trackOnboarding";

export interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  done: boolean;
  onClick: () => void;
}

interface OnboardingChecklistProps {
  steps: ChecklistStep[];
}

const COLLAPSE_KEY = "onboarding_checklist_collapsed";

/**
 * Persistent, resumable onboarding checklist (non-blocking).
 * Progress is derived from real account data, so it always reflects
 * the true state and survives reloads / new sessions.
 */
const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ steps }) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("dashboardLayout");

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      }
      trackOnboarding({ event_type: next ? "collapsed" : "expanded" });
      return next;
    });
  }, []);

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextStep = steps.find((s) => !s.done);
  const firstIncompleteIndex = steps.findIndex((s) => !s.done);

  return (
    <Box
      data-testid="onboarding-checklist"
      sx={{
        mb: isMobile ? 2 : 2.5,
        p: isMobile ? "18px 18px" : "22px 24px",
        borderRadius: "12px",
        border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: "none",
      }}
    >
      {/* Header — logo-quiet, no tinted icon square (Coinbase-clean) */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? "16px" : "18px",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              color: theme.palette.text.primary,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
            }}
          >
            {completed === total ? t("obAllSet") : t("obFinishSetup")}
          </Typography>
          <Typography
            sx={{
              mt: 0.5,
              fontSize: isMobile ? "12px" : "13px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              lineHeight: 1.4,
            }}
          >
            {t("obProgress", { completed, total })}
          </Typography>
        </Box>
        <IconButton
          data-testid="onboarding-checklist-toggle"
          size="small"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("obExpandChecklist") : t("obCollapseChecklist")}
          sx={{
            color: theme.palette.text.secondary,
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(15,15,20,0.05)",
            },
          }}
        >
          {collapsed ? <ExpandMoreRounded /> : <ExpandLessRounded />}
        </IconButton>
      </Box>

      {/* Progress bar — thinner, softer */}
      <Box
        sx={{
          mt: 1.75,
          height: 4,
          borderRadius: 999,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.06)"
              : "rgba(15,15,20,0.06)",
          overflow: "hidden",
        }}
      >
        <Box
          data-testid="onboarding-progress-bar"
          sx={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: theme.palette.primary.main,
            transition: "width 0.4s ease",
          }}
        />
      </Box>

      {/* Steps */}
      <Collapse in={!collapsed} timeout={250}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1.75 }}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = step.done;
            const isNext = !isDone && step.key === nextStep?.key;
            const isLocked =
              !isDone &&
              firstIncompleteIndex !== -1 &&
              idx > firstIncompleteIndex;
            return (
              <Box
                key={step.key}
                data-testid={`onboarding-step-${step.key}`}
                onClick={() => !isDone && step.onClick()}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: isMobile ? "10px 12px" : "12px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${
                    isNext
                      ? theme.palette.primary.main
                      : theme.palette.border?.main || theme.palette.divider
                  }`,
                  backgroundColor: theme.palette.background.paper,
                  cursor: isDone ? "default" : "pointer",
                  opacity: 1,
                  transition: "all 0.15s ease",
                  ...(!isDone &&
                    !isLocked && {
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }),
                }}
              >
                <Box
                  sx={{
                    width: isMobile ? 26 : 28,
                    height: isMobile ? 26 : 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isDone ? (
                    <CheckRounded
                      sx={{
                        fontSize: 20,
                        color:
                          theme.palette.mode === "dark" ? "#34D399" : "#047857",
                      }}
                    />
                  ) : isLocked ? (
                    <LockRounded
                      sx={{
                        fontSize: isMobile ? 16 : 18,
                        color: theme.palette.text.secondary,
                      }}
                    />
                  ) : (
                    <Icon
                      sx={{
                        fontSize: isMobile ? 18 : 20,
                        color: brandFg(theme.palette.mode === "dark"),
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: isMobile ? "13px" : "14px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: isDone || isLocked ? 500 : 600,
                      color: isDone
                        ? theme.palette.text.secondary
                        : isLocked
                          ? theme.palette.text.secondary
                          : theme.palette.text.primary,
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                  >
                    {step.label}
                  </Typography>
                  {!isDone && (
                    <Typography
                      sx={{
                        fontSize: isMobile ? "11px" : "12px",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                        lineHeight: 1.3,
                      }}
                    >
                      {isLocked
                        ? t("obLockedStep")
                        : step.description}
                    </Typography>
                  )}
                </Box>
                {isNext && (
                  <ArrowForwardRounded
                    sx={{ fontSize: 18, color: brandFg(theme.palette.mode === "dark") }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default OnboardingChecklist;
