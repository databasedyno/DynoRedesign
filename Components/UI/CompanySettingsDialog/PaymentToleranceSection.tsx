import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import AdornedInputField from "@/Components/UI/AdornedInputField";
import SettingsAccordion from "@/Components/UI/SettingsAccordion";
import { Box, FormControlLabel, Radio, RadioGroup, Typography } from "@mui/material";
import Image from "next/image";
import React from "react";
import { useTranslation } from "react-i18next";

export type FeeSplitVisibility = "auto" | "always" | "never";

export type PaymentToleranceSectionProps = {
  values: {
    min_order_usd: string;
    underpayment_threshold_usd: string;
    grace_period_minutes: string;
    show_fee_split_to_customers?: FeeSplitVisibility;
  };
  onFeeSplitChange?: (value: FeeSplitVisibility) => void;
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
  onFeeSplitChange,
  isMobile = false,
  expanded,
  onAccordionChange,
}: PaymentToleranceSectionProps) {
  const { t: tSettings } = useTranslation("companySettings");
  const feeSplit: FeeSplitVisibility = values.show_fee_split_to_customers ?? "auto";
  const FEE_SPLIT_OPTIONS: Array<{ value: FeeSplitVisibility; label: string; hint: string }> = [
    { value: "auto", label: tSettings("feeSplit.auto", { defaultValue: "Only when the customer pays the fee" }), hint: tSettings("feeSplit.autoHint", { defaultValue: "Recommended. Buyers see the fee they are charged; when you absorb it, they just see the price." }) },
    { value: "always", label: tSettings("feeSplit.always", { defaultValue: "Always" }), hint: tSettings("feeSplit.alwaysHint", { defaultValue: "Every checkout, success screen and receipt shows what you receive and what Dynopay keeps." }) },
    { value: "never", label: tSettings("feeSplit.never", { defaultValue: "Never" }), hint: tSettings("feeSplit.neverHint", { defaultValue: "Buyers only ever see the total they pay — like a card checkout." }) },
  ];

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
          label={tSettings("paymentToleranceFields.minOrderAmount", { defaultValue: "Minimum order amount" })}
          name="min_order_usd"
          testId="settings-min-order-input"
          value={String(values.min_order_usd ?? "")}
          onChange={handleChange}
          onBlur={handleBlur}
          helperText={tSettings("paymentToleranceFields.minOrderHelper", { defaultValue: "Lowest amount a customer can pay you. Leave blank to use the automatic per-coin network minimum — you can only raise it." })}
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

        {/* B12 — who gets to see the merchant / Dynopay fee split */}
        <Box data-testid="fee-split-visibility">
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? 13 : 14, fontWeight: 600, color: "text.primary" }}>
            {tSettings("feeSplit.label", { defaultValue: "Show the fee breakdown to customers" })}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "text.secondary", mt: 0.25, mb: 1 }}>
            {tSettings("feeSplit.desc", { defaultValue: "Controls the “Merchant receives / Dynopay fee” rows on your checkout, its success screen and the buyer's receipt." })}
          </Typography>
          <RadioGroup
            value={feeSplit}
            onChange={(e) => onFeeSplitChange?.(e.target.value as FeeSplitVisibility)}
            name="show_fee_split_to_customers"
          >
            {FEE_SPLIT_OPTIONS.map((o) => (
              <FormControlLabel
                key={o.value}
                value={o.value}
                data-testid={`fee-split-option-${o.value}`}
                control={<Radio size="small" />}
                sx={{ alignItems: "flex-start", ml: 0, mr: 0, mb: 0.5, "& .MuiRadio-root": { pt: "3px" } }}
                label={
                  <Box>
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "text.primary" }}>{o.label}</Typography>
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>{o.hint}</Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </Box>
      </Box>
    </SettingsAccordion>
  );
}
