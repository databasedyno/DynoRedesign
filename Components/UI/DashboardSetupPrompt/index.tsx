import { brandFg } from "@/constants/theme";
import React from "react";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  ArrowForwardRounded,
  RocketLaunchRounded,
} from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

interface SetupStep {
  label: string;
  icon: React.ElementType;
  path: string;
  done: boolean;
}

interface DashboardSetupPromptProps {
  hasCompany: boolean;
  hasWallet: boolean;
}

const DashboardSetupPrompt: React.FC<DashboardSetupPromptProps> = ({
  hasCompany,
  hasWallet,
}) => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const router = useRouter();

  if (hasCompany && hasWallet) return null;

  const steps: SetupStep[] = [
    {
      label: "Create a Company",
      icon: BusinessRounded,
      path: "/create-pay-link",
      done: hasCompany,
    },
    {
      label: "Add a Wallet Address",
      icon: AccountBalanceWalletRounded,
      path: "/wallet",
      done: hasWallet,
    },
  ];

  const pendingSteps = steps.filter((s) => !s.done);
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <Box
      data-testid="dashboard-setup-prompt"
      sx={{
        mb: isMobile ? 2 : 2.5,
        p: isMobile ? "16px" : "20px 24px",
        borderRadius: "14px",
        border: `1px solid ${theme.palette.border.main}`,
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#FAFBFC",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            borderRadius: "10px",
            backgroundColor: theme.palette.primary.light || "#E5EDFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RocketLaunchRounded
            sx={{ fontSize: isMobile ? 18 : 22, color: brandFg(theme.palette.mode === "dark") }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontSize: isMobile ? "15px" : "17px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              color: theme.palette.text.primary,
              lineHeight: 1.3,
            }}
          >
            {t("completeYourSetup")}
          </Typography>
          <Typography
            sx={{
              fontSize: isMobile ? "12px" : "13px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              lineHeight: 1.4,
            }}
          >
            {completedCount} of {steps.length} steps done — finish setup to start accepting payments
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = step.done;
          return (
            <Box
              key={step.path}
              data-testid={`setup-step-${step.path.replace("/", "")}`}
              onClick={() => !isDone && router.push(step.path)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: isMobile ? "10px 14px" : "12px 16px",
                borderRadius: "10px",
                border: `1px solid ${isDone ? theme.palette.border.success || "#C6F0C2" : theme.palette.border.main}`,
                backgroundColor: isDone
                  ? (theme.palette.mode === "dark" ? "rgba(76,175,80,0.08)" : "#F0FAF0")
                  : theme.palette.background.paper,
                cursor: isDone ? "default" : "pointer",
                opacity: isDone ? 0.7 : 1,
                transition: "all 0.15s ease",
                ...(!isDone && {
                  "&:hover": {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.primary.light,
                  },
                }),
              }}
            >
              <Box
                sx={{
                  width: isMobile ? 32 : 36,
                  height: isMobile ? 32 : 36,
                  borderRadius: "8px",
                  backgroundColor: isDone
                    ? (theme.palette.mode === "dark" ? "rgba(76,175,80,0.15)" : "#E8F5E9")
                    : (theme.palette.primary.light || "#E5EDFF"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {isDone ? (
                  <Typography sx={{ fontSize: 16, color: "#4CAF50", fontWeight: 700 }}>✓</Typography>
                ) : (
                  <Icon sx={{ fontSize: isMobile ? 16 : 18, color: brandFg(theme.palette.mode === "dark") }} />
                )}
              </Box>
              <Typography
                sx={{
                  flex: 1,
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: isDone ? "var(--font-sans)" : "var(--font-sans)",
                  fontWeight: isDone ? 500 : 600,
                  color: isDone ? theme.palette.text.secondary : theme.palette.text.primary,
                  textDecoration: isDone ? "line-through" : "none",
                }}
              >
                {step.label}
              </Typography>
              {!isDone && (
                <ArrowForwardRounded
                  sx={{ fontSize: 18, color: brandFg(theme.palette.mode === "dark") }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default DashboardSetupPrompt;
