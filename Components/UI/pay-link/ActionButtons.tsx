import CustomButton from "@/Components/UI/Buttons";
import { ActionButtonsProps } from "@/utils/types/create-pay-link";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";

const ActionButtons: React.FC<ActionButtonsProps> = ({
  hasPaymentLinkData,
  disabled,
  tPaymentLink,
  handleCreatePaymentLink,
  paymentSettingsErrors,
  paymentSettings,
  isCreating,
  requireAmount = true,
  extraDisabled = false,
  linkKind,
  blockers,
}) => {
  const router = useRouter();
  const theme = useTheme();

  // Create button label is context-aware: a donation campaign should not read
  // "Create Payment Link". Edit mode keeps the neutral "Save Changes".
  const createLabelKey =
    linkKind === "donation" ? "createDonation" : "createPaymentLink";
  const primaryLabel = isCreating
    ? tPaymentLink("creating") || "Creating..."
    : tPaymentLink(hasPaymentLinkData ? "saveChanges" : createLabelKey);

  // Prefer the caller-provided, human-readable blocker list. Fall back to the
  // legacy boolean checks so the button can never be enabled with invalid data
  // even if a caller forgets to pass `blockers`.
  const reasons: string[] = Array.isArray(blockers) ? blockers.filter(Boolean) : [];
  const hasReasons = reasons.length > 0;

  const fallbackDisabled =
    extraDisabled ||
    Boolean(paymentSettingsErrors.value) ||
    Boolean(paymentSettingsErrors.currency) ||
    Boolean(paymentSettingsErrors.description) ||
    (requireAmount &&
      (!paymentSettings.value || paymentSettings.value.trim() === "")) ||
    !paymentSettings.currency ||
    !paymentSettings.acceptedCryptoCurrency ||
    paymentSettings.acceptedCryptoCurrency.length === 0;

  const primaryDisabled = Boolean(isCreating) || (hasReasons ? true : fallbackDisabled);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: "14px", md: "24px" },
        }}
      >
        {hasPaymentLinkData && (
          <CustomButton
            label={disabled ? tPaymentLink("back") : tPaymentLink("cancel")}
            variant={disabled ? "primary" : "outlined"}
            size="medium"
            fullWidth={true}
            onClick={() => router.back()}
            sx={{
              [theme.breakpoints.down("md")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
        )}
        {!disabled && (
          <CustomButton
            label={primaryLabel}
            variant="primary"
            size="medium"
            fullWidth={true}
            onClick={handleCreatePaymentLink}
            disabled={primaryDisabled}
            sx={{
              [theme.breakpoints.down("md")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
        )}
      </Box>

      {/* Inline "why is this disabled?" hint — only when the button is blocked
          for a fixable reason (not while actively creating). */}
      {!disabled && !isCreating && hasReasons && (
        <Box
          data-testid="create-link-blockers"
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            px: 1.25,
            py: 1,
            borderRadius: "10px",
            border: `1px solid ${theme.palette.warning.main}40`,
            backgroundColor: `${theme.palette.warning.main}14`,
          }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 14, lineHeight: "18px", mt: "1px" }}
            aria-hidden
          >
            &#9888;&#65039;
          </Typography>
          <Typography
            sx={{
              fontSize: 12.5,
              lineHeight: "18px",
              color: theme.palette.text.secondary,
              fontFamily: "var(--font-sans)",
            }}
          >
            {tPaymentLink("blockerIntro", {
              defaultValue: "Before you can continue, please:",
            })}{" "}
            {reasons.map((r, i) => (
              <React.Fragment key={i}>
                <Box
                  component="span"
                  sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
                >
                  {r}
                </Box>
                {i < reasons.length - 1 ? "  \u00B7  " : ""}
              </React.Fragment>
            ))}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ActionButtons;
