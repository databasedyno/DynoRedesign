import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  dataTestId?: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  dataTestId = "onboarding-step-indicator",
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("companyDialog");

  return (
    <Box
      data-testid={dataTestId}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 1 : 1.25,
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <Box
            key={step}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 0.5 : 0.75,
            }}
          >
            {/* Step dot / number */}
            <Box
              data-testid={`step-indicator-${step}`}
              sx={{
                width: isMobile ? 22 : 24,
                height: isMobile ? 22 : 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  isCompleted || isActive
                    ? theme.palette.primary.main
                    : theme.palette.divider,
                transition: "all 0.3s ease",
              }}
            >
              {isCompleted ? (
                <svg
                  width={isMobile ? 10 : 12}
                  height={isMobile ? 10 : 12}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <Typography
                  sx={{
                    fontSize: isMobile ? "10px" : "11px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 700,
                    color: isActive ? "#fff" : theme.palette.text.disabled,
                    lineHeight: 1,
                  }}
                >
                  {step}
                </Typography>
              )}
            </Box>

            {/* Step label */}
            <Typography
              sx={{
                fontSize: isMobile ? "11px" : "12px",
                fontFamily: "var(--font-sans)",
                fontWeight: isActive ? 600 : 500,
                color: isActive || isCompleted
                  ? theme.palette.text.primary
                  : theme.palette.text.disabled,
                lineHeight: 1,
                transition: "color 0.3s ease",
              }}
            >
              {step === 1
                ? t("createModal.stepBrand", { defaultValue: "Brand" })
                : t("createModal.stepWallet", { defaultValue: "Wallet" })}
            </Typography>

            {/* Connector line (between steps, not after last) */}
            {step < totalSteps && (
              <Box
                sx={{
                  width: isMobile ? 20 : 28,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: isCompleted
                    ? theme.palette.primary.main
                    : theme.palette.divider,
                  transition: "background-color 0.3s ease",
                  mx: 0.25,
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default StepIndicator;
