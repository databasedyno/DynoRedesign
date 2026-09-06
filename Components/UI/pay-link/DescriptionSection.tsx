import InputField from "@/Components/UI/AuthLayout/InputFields";
import NoteIcon from "@/assets/Icons/note-icon.svg";
import { DescriptionSectionProps } from "@/utils/types/create-pay-link";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { PaymentSettingsLabel } from "../../Page/CreatePaymentLink/styled";

const MAX_LEN = 500;

/**
 * Redesign (2026-09): "What is this payment for?" field.
 * Full-width, short by default (auto-grows), with a live character count —
 * replaces the half-width, 6-row empty box that dominated the old layout.
 */
const DescriptionSection: React.FC<DescriptionSectionProps> = ({
  tPaymentLink,
  paymentSettings,
  paymentSettingsTouched,
  paymentSettingsErrors,
  handlePaymentSettingsChange,
  handlePaymentSettingsBlur,
}) => {
  const theme = useTheme();
  const length = (paymentSettings.description || "").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <PaymentSettingsLabel>
          <Image src={NoteIcon} alt="description" draggable={false} className="themed-icon" />
          <span>
            {tPaymentLink("description")}{" "}
            <Box component="span" sx={{ color: theme.palette.text.secondary, fontWeight: 400 }}>
              ({tPaymentLink("optional")})
            </Box>
          </span>
        </PaymentSettingsLabel>
        <Typography
          aria-live="polite"
          sx={{
            fontFamily: "var(--font-mono, monospace)",
            fontVariantNumeric: "tabular-nums",
            fontSize: 11.5,
            color: length > MAX_LEN * 0.9 ? "#E11D48" : theme.palette.text.secondary,
          }}
        >
          {length}/{MAX_LEN}
        </Typography>
      </Box>
      <InputField
        value={paymentSettings.description}
        onChange={(e) => handlePaymentSettingsChange("description", e.target.value.slice(0, MAX_LEN))}
        onBlur={() => handlePaymentSettingsBlur("description")}
        placeholder={tPaymentLink("descriptionPlaceholder", {
          defaultValue: "e.g. Logo design — final payment",
        })}
        type="text"
        multiline
        minRows={2}
        maxRows={5}
        error={paymentSettingsTouched.description && Boolean(paymentSettingsErrors.description)}
        helperText={
          paymentSettingsTouched.description && paymentSettingsErrors.description
            ? paymentSettingsErrors.description
            : tPaymentLink("descriptionHelper", {
                defaultValue: "Shown to your customer at checkout and on the receipt.",
              })
        }
        maxLength={MAX_LEN}
        data-testid="pay-link-description"
        sx={{ width: "100%" }}
      />
    </Box>
  );
};

export default DescriptionSection;
