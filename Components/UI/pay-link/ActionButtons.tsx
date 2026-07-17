import CustomButton from "@/Components/UI/Buttons";
import { ActionButtonsProps } from "@/utils/types/create-pay-link";
import { useTheme } from "@mui/material";
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

  return (
    <>
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
          disabled={
            isCreating ||
            extraDisabled ||
            Boolean(paymentSettingsErrors.value) ||
            Boolean(paymentSettingsErrors.currency) ||
            Boolean(paymentSettingsErrors.description) ||
            (requireAmount &&
              (!paymentSettings.value || paymentSettings.value.trim() === "")) ||
            !paymentSettings.currency ||
            !paymentSettings.acceptedCryptoCurrency ||
            paymentSettings.acceptedCryptoCurrency.length === 0
          }
          sx={{
            [theme.breakpoints.down("md")]: {
              height: "32px",
              fontSize: "13px",
            },
          }}
        />
      )}
    </>
  );
};

export default ActionButtons;
