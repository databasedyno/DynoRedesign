// GettingStartedChecklist — 5-step onboarding checklist for merchants who
// joined less than 30 days ago. Auto-hides for older accounts.
import {
  CheckCircleRounded,
  RadioButtonUncheckedRounded,
} from "@mui/icons-material";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { memo } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { rootReducer } from "@/utils/types";
import {
  Body,
  CardTitle,
  Eyebrow,
  MonoLabel,
  SurfaceCard,
  VOLT,
  VOLT_INK,
} from "./styled";

interface Step {
  id: string;
  title: string;
  done: boolean;
  href?: string;
}

const GettingStartedChecklist: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const companyState = useSelector((s: rootReducer) => s.companyReducer);
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const dashState = useSelector((s: rootReducer) => s.dashboardReducer);
  const userState = useSelector((s: any) => s.userReducer);
  const profile = userState?.profile;

  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const totalTx = Number(dashState?.stats?.totalTransactions ?? 0);
  const hasHandle = Boolean(profile?.handle);

  // Only show for accounts < 30 days old.
  const createdAt = profile?.createdAt ? new Date(profile.createdAt) : null;
  const ageDays = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / (24 * 3600 * 1000))
    : null;
  const isNew = ageDays != null && ageDays <= 30;

  const steps: Step[] = [
    {
      id: "company",
      title: t("stepAddCompany") || "Add business details",
      done: hasCompany,
      href: "/settings?section=company",
    },
    {
      id: "wallet",
      title: t("stepAddWallet") || "Add a settlement wallet",
      done: hasWallet,
      href: "/wallet",
    },
    {
      id: "link",
      title: t("stepCreateLink") || "Create your first payment link",
      done: totalTx > 0,
      href: "/create-pay-link",
    },
    {
      id: "handle",
      title: t("stepClaimHandle") || "Claim your @handle",
      done: hasHandle,
      href: "/profile?claim=1",
    },
    {
      id: "team",
      title: t("stepInviteTeam") || "Invite your team",
      done: false,
      href: "/settings?section=team",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  if (!isNew || allDone) return null;

  return (
    <SurfaceCard
      data-testid="aurora-getting-started"
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Box>
        <Eyebrow>{t("gettingStarted") || "Getting started"}</Eyebrow>
        <CardTitle sx={{ mt: 0.5, fontSize: 18 }}>
          {completedCount} / {steps.length}{" "}
          {t("stepsComplete") || "steps complete"}
        </CardTitle>
      </Box>

      {/* Progress bar */}
      <Box
        sx={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.06)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${(completedCount / steps.length) * 100}%`,
            background:
              "linear-gradient(90deg, #FF5B49 0%, #7C5CFF 50%, #CCFF00 100%)",
            borderRadius: 999,
            transition: "width 320ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </Box>

      {/* Step rows */}
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, i) => (
          <Box
            key={step.id}
            role={step.href ? "button" : undefined}
            tabIndex={step.href ? 0 : undefined}
            onClick={() => step.href && router.push(step.href)}
            onKeyDown={(e) => {
              if (step.href && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                router.push(step.href);
              }
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              py: 1.25,
              px: 0.5,
              minHeight: 44,
              cursor: step.href ? "pointer" : "default",
              borderRadius: 8,
              transition: "background 180ms ease",
              opacity: step.done ? 0.6 : 1,
              "&:hover": step.href
                ? {
                    background: dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
                  }
                : {},
              "&:focus-visible": {
                outline: `2px solid #FF5B49`,
                outlineOffset: 2,
              },
            }}
          >
            {step.done ? (
              <CheckCircleRounded
                sx={{ fontSize: 22, color: dark ? VOLT : VOLT_INK, flexShrink: 0 }}
              />
            ) : (
              <RadioButtonUncheckedRounded
                sx={{
                  fontSize: 22,
                  color: dark ? "rgba(255,255,255,0.35)" : "rgba(10,10,10,0.28)",
                  flexShrink: 0,
                }}
              />
            )}
            <Body
              sx={{
                flex: 1,
                fontWeight: step.done ? 500 : 600,
                textDecoration: step.done ? "line-through" : "none",
              }}
            >
              {step.title}
            </Body>
            <MonoLabel sx={{ fontSize: 10 }}>0{i + 1}</MonoLabel>
          </Box>
        ))}
      </Box>
    </SurfaceCard>
  );
};

export default memo(GettingStartedChecklist);
