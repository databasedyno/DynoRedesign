/**
 * LinkTypeSelector — "Payment Link" vs "Donation / Crowdfunding" cards shown
 * at the top of the create-pay-link page. Locked (informational) in edit mode.
 */
import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";

export type LinkKind = "standard" | "donation";

interface LinkTypeSelectorProps {
  value: LinkKind;
  onChange: (v: LinkKind) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const LinkTypeSelector = ({ value, onChange, disabled, isMobile }: LinkTypeSelectorProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const green = "#10B981";

  const options: Array<{
    kind: LinkKind;
    icon: string;
    label: string;
    hint: string;
    accent: string;
  }> = [
    {
      kind: "standard",
      icon: "mdi:link-variant",
      label: t("linkTypeStandard", { defaultValue: "Payment link" }),
      hint: t("linkTypeStandardHint", { defaultValue: "Request a fixed amount for a product, invoice or service." }),
      accent: theme.palette.primary.main,
    },
    {
      kind: "donation",
      icon: "mdi:hand-heart-outline",
      label: t("linkTypeDonation", { defaultValue: "Donation / Crowdfunding" }),
      hint: t("linkTypeDonationHint", { defaultValue: "Collect contributions toward a goal — donors choose the amount." }),
      accent: green,
    },
  ];

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
      gap={1.5}
      mb={2}
      data-testid="link-type-selector"
    >
      {options.map((o) => {
        const active = value === o.kind;
        return (
          <Box
            key={o.kind}
            role="button"
            tabIndex={disabled ? -1 : 0}
            data-testid={`link-type-${o.kind}`}
            aria-pressed={active}
            onClick={() => !disabled && onChange(o.kind)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(o.kind);
              }
            }}
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              p: isMobile ? "12px 14px" : "14px 16px",
              borderRadius: "12px",
              cursor: disabled ? "default" : "pointer",
              userSelect: "none",
              border: `1.5px solid ${active ? o.accent : theme.palette.border.main}`,
              backgroundColor: active
                ? isDark
                  ? `${o.accent}1F`
                  : `${o.accent}0D`
                : "transparent",
              opacity: disabled && !active ? 0.45 : 1,
              transition: "all 140ms ease",
              "&:hover": disabled ? {} : { borderColor: o.accent },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active
                  ? o.accent
                  : isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.05)",
                color: active ? "#fff" : theme.palette.text.secondary,
                transition: "all 140ms ease",
              }}
            >
              <Icon icon={o.icon} width={20} />
            </Box>
            <Box flex={1} minWidth={0}>
              <Typography
                fontSize={14}
                fontWeight={700}
                color={theme.palette.text.primary}
                fontFamily="var(--font-sans)"
                lineHeight={1.3}
              >
                {o.label}
              </Typography>
              <Typography
                fontSize={12}
                color={theme.palette.text.secondary}
                fontFamily="var(--font-sans)"
                lineHeight={1.45}
                mt={0.25}
              >
                {o.hint}
              </Typography>
            </Box>
            {active && (
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  color: o.accent,
                  display: "flex",
                }}
              >
                <Icon icon="mdi:check-circle" width={18} />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default LinkTypeSelector;
