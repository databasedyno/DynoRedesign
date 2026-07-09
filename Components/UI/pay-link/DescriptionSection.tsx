import InputField from "@/Components/UI/AuthLayout/InputFields";
import NoteIcon from "@/assets/Icons/note-icon.svg";
import { DescriptionSectionProps } from "@/utils/types/create-pay-link";
import { Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React from "react";
import { PaymentSettingsLabel } from "../../Page/CreatePaymentLink/styled";

const DescriptionSection: React.FC<DescriptionSectionProps> = ({
  isMobile,
  tPaymentLink,
  paymentSettings,
  paymentSettingsTouched,
  paymentSettingsErrors,
  handlePaymentSettingsChange,
  handlePaymentSettingsBlur,
}) => {
  const theme = useTheme();
  return (
    <InputField
      label={
        <PaymentSettingsLabel>
          <Image src={NoteIcon} alt="note" draggable={false} className="themed-icon" />
          <span>{tPaymentLink("description")}</span>
          <Typography
            component="span"
            sx={{
              fontSize: "12px",
              color: theme.palette.text.secondary,
              fontFamily: "var(--font-sans)",
              fontWeight: 400,
              ml: 0.5,
            }}
          >
            ({tPaymentLink("optional") || "Optional"})
          </Typography>
        </PaymentSettingsLabel>
      }
      value={paymentSettings.description}
      onChange={(e) => handlePaymentSettingsChange("description", e.target.value)}
      onBlur={() => handlePaymentSettingsBlur("description")}
      error={
        paymentSettingsTouched.description &&
        Boolean(paymentSettingsErrors.description)
      }
      helperText={
        paymentSettingsTouched.description && paymentSettingsErrors.description
          ? paymentSettingsErrors.description
          : undefined
      }
      maxLength={500}
      sx={{ width: "100%" }}
      multiline={true}
      minRows={isMobile ? 4 : 9}
    />
  );
};

export default DescriptionSection;
