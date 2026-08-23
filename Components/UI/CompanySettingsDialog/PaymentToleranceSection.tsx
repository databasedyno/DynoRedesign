import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import AdornedInputField from "@/Components/UI/AdornedInputField";
import SettingsAccordion from "@/Components/UI/SettingsAccordion";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import React from "react";
import { useTranslation } from "react-i18next";

export type PaymentToleranceSectionProps = {
  values: {
    underpayment_threshold_usd: string;
    grace_period_minutes: string;
  };
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  isMobile?: boolean;
  expanded: boolean;
  onAccordionChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
};

export default function PaymentToleranceSection({
  values,
  handleChange,
  handleBlur,
  isMobile = false,
  expanded,
  onAccordionChange,
}: PaymentToleranceSectionProps) {
  const { t: tSettings } = useTranslation("companySettings");

  return (
    <SettingsAccordion
      icon={
        <Image
          src={RoundedStackIcon}
          alt="rounded stack"
          width={16}
          height={16}
          className="themed-icon"
          draggable={false}
        />
      }
      title={tSettings("paymentTolerance")}
      subtitle={tSettings("paymentToleranceSubtitle")}
      expanded={expanded}
      onChange={onAccordionChange}
      isMobile={isMobile}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "12px" : 2.5,
        }}
      >
        <AdornedInputField
          fullWidth
          inputHeight={isMobile ? "32px" : "40px"}
          label={tSettings("paymentToleranceFields.acceptUnderpaymentsUpTo")}
          name="underpayment_threshold_usd"
          value={String(values.underpayment_threshold_usd ?? "1.00")}
          onChange={handleChange}
          onBlur={handleBlur}
          helperText={tSettings(
            "paymentToleranceFields.acceptUnderpaymentsHelper",
          )}
          startAdornment={
            <Typography
              component="span"
              variant="body2"
              sx={{
                fontFamily: "var(--font-sans)",
                color: "text.primary",
                fontWeight: 500,
                lineHeight: 1.2,
                fontSize: "13px",
              }}
            >
              $
            </Typography>
          }
          type="text"
          inputMode="decimal"
        />
        <AdornedInputField
          fullWidth
          inputHeight={isMobile ? "32px" : "40px"}
          label={tSettings("paymentToleranceFields.timeForPartialPayments")}
          name="grace_period_minutes"
          value={String(values.grace_period_minutes ?? "30")}
          onChange={handleChange}
          onBlur={handleBlur}
          helperText={tSettings(
            "paymentToleranceFields.timeForPartialPaymentsHelper",
          )}
          startAdornment={
            <Image
              src={TimeIcon}
              alt="time"
              width={isMobile ? 12 : 16}
              height={isMobile ? 12 : 16}
              className="themed-icon"
            />
          }
          endAdornment={tSettings("paymentToleranceFields.minutes")}
          type="text"
          inputMode="numeric"
        />
      </Box>
    </SettingsAccordion>
  );
}
