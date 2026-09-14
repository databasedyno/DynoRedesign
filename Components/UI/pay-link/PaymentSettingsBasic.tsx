import ClientIcon from "@/assets/Icons/Client-icon.svg";
import CurrencyIcon from "@/assets/Icons/Crypto-select.svg";
import HourglassIcon from "@/assets/Icons/hourglass-icon.svg";
import PaymentIcon from "@/assets/Icons/payment-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomRadio from "@/Components/UI/RadioGroup";
import { PaymentSettingsBasicProps } from "@/utils/types/create-pay-link";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import React from "react";
import {
  FieldGrid,
  FormSectionHeader,
  FormSectionRoot,
  OptionCard,
  PaymentSettingsLabel,
} from "../../Page/CreatePaymentLink/styled";
import CurrencySelector from "../CurrencySelector";
import ExpireSelector from "./ExpireSelector";

/**
 * Redesign (2026-09): the amount / details block of the create form.
 *
 * Previously rendered as a 48%-wide column inside a half-width flex child, so
 * every field was ~a quarter of the card and helper text wrapped onto 3 lines.
 * Now two full-width, numbered sections:
 *   02 How much?  — Amount + Currency on one row
 *   03 Details    — Client name + Expiry grid, fee payer as two option cards
 * All props, handlers and field semantics are unchanged.
 */
const PaymentSettingsBasic: React.FC<PaymentSettingsBasicProps> = ({
  tPaymentLink,
  paymentSettings,
  paymentSettingsTouched,
  paymentSettingsErrors,
  blockchainFees,
  disable,
  handlePaymentSettingsChange,
  handlePaymentSettingsBlur,
  handleCurrencySelect,
  handleExpireSelect,
  handleBlockchainFeesChange,
}) => {
  const feeOptions: Array<{ value: "customer" | "company"; title: string; sub: string }> = [
    {
      value: "customer",
      title: tPaymentLink("feePayerCustomerTitle", { defaultValue: "Customer pays" }),
      sub: tPaymentLink("customerFeesAdded"),
    },
    {
      value: "company",
      title: tPaymentLink("feePayerCompanyTitle", { defaultValue: "I pay" }),
      sub: tPaymentLink("companyPaysFees"),
    },
  ];

  return (
    <>
      {/* ── 02 · How much? ── */}
      <FormSectionRoot data-testid="pay-link-section-amount">
        <FormSectionHeader>
          <span className="step">02</span>
          <Box sx={{ minWidth: 0 }}>
            <Typography className="title">
              {tPaymentLink("sectionAmountTitle", { defaultValue: "How much?" })}
            </Typography>
            <Typography className="subtitle">
              {tPaymentLink("sectionAmountSub", {
                defaultValue: "Set the price in your currency — the crypto amount is calculated live at checkout.",
              })}
            </Typography>
          </Box>
        </FormSectionHeader>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1.6fr) minmax(0, 1fr)" },
            gap: { xs: 1.5, md: 2.5 },
            alignItems: "start",
          }}
        >
          <InputField
            label={
              <PaymentSettingsLabel>
                <Image
                  src={RoundedStackIcon}
                  alt="value"
                  draggable={false}
                  style={{
                    filter: `brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)`,
                  }}
                />
                <span>{tPaymentLink("value")}</span>
              </PaymentSettingsLabel>
            }
            value={paymentSettings.value}
            onChange={(e) => handlePaymentSettingsChange("value", e.target.value)}
            onBlur={() => handlePaymentSettingsBlur("value")}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            error={paymentSettingsTouched.value && Boolean(paymentSettingsErrors.value)}
            helperText={
              paymentSettingsTouched.value && paymentSettingsErrors.value
                ? paymentSettingsErrors.value
                : tPaymentLink("valueHelper")
            }
            sx={{ width: "100%" }}
          />

          <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
            <PaymentSettingsLabel>
              <Image src={CurrencyIcon} alt="currency" draggable={false} className="themed-icon" />
              <span>{tPaymentLink("currency")}</span>
            </PaymentSettingsLabel>
            <CurrencySelector
              fullWidth
              name="base_currency"
              value={paymentSettings.currency || "USD"}
              onChange={(value) => handleCurrencySelect(value)}
              required
              error={paymentSettingsTouched.currency && Boolean(paymentSettingsErrors.currency)}
              helperText={
                paymentSettingsTouched.currency && paymentSettingsErrors.currency
                  ? paymentSettingsErrors.currency
                  : undefined
              }
            />
          </Box>
        </Box>
      </FormSectionRoot>

      {/* ── 03 · Details ── */}
      <FormSectionRoot data-testid="pay-link-section-details">
        <FormSectionHeader>
          <span className="step">03</span>
          <Box sx={{ minWidth: 0 }}>
            <Typography className="title">
              {tPaymentLink("sectionDetailsTitle", { defaultValue: "Details" })}
            </Typography>
            <Typography className="subtitle">
              {tPaymentLink("sectionDetailsSub", {
                defaultValue: "Who it's for, how long the link stays open, and who covers network fees.",
              })}
            </Typography>
          </Box>
        </FormSectionHeader>

        <FieldGrid>
          <InputField
            label={
              <PaymentSettingsLabel>
                <Image src={ClientIcon} alt="clientName" draggable={false} className="themed-icon" />
                <span>{tPaymentLink("clientName")}</span>
              </PaymentSettingsLabel>
            }
            value={paymentSettings.clientName}
            onChange={(e) => handlePaymentSettingsChange("clientName", e.target.value)}
            type="text"
            inputMode="text"
            helperText={tPaymentLink("clientNameHelper")}
            sx={{ width: "100%" }}
          />

          <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
            <PaymentSettingsLabel>
              <Image src={HourglassIcon} alt="expire" draggable={false} className="themed-icon" />
              <span>{tPaymentLink("expire")}</span>
            </PaymentSettingsLabel>
            <ExpireSelector
              tPaymentLink={tPaymentLink}
              value={paymentSettings.expire}
              onChange={(val) => handleExpireSelect(val)}
              required
              helperText={
                paymentSettings.expire === "no" || paymentSettings.expire === "No"
                  ? tPaymentLink("expiryRecommendation")
                  : undefined
              }
            />
          </Box>
        </FieldGrid>

        <Box>
          <PaymentSettingsLabel>
            <Image src={PaymentIcon} alt="blockchain fees" draggable={false} className="themed-icon" />
            <span>{tPaymentLink("blockchainFeesPaidBy")}</span>
          </PaymentSettingsLabel>
          <Box
            role="radiogroup"
            aria-label={tPaymentLink("blockchainFeesPaidBy")}
            sx={{
              mt: 1,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: { xs: 1, md: 1.5 },
            }}
          >
            {feeOptions.map((opt) => {
              const selected = blockchainFees === opt.value;
              return (
                <OptionCard
                  key={opt.value}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={disable ? -1 : 0}
                  selected={selected}
                  disabled={disable}
                  data-testid={`fee-payer-${opt.value}`}
                  onClick={() => !disable && handleBlockchainFeesChange(opt.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (disable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleBlockchainFeesChange(opt.value);
                    }
                  }}
                >
                  <CustomRadio checked={selected} tabIndex={-1} value={opt.value} sx={{ p: 0, mt: "1px" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography className="opt-title">{opt.title}</Typography>
                    <Typography className="opt-sub">{opt.sub}</Typography>
                  </Box>
                </OptionCard>
              );
            })}
          </Box>
        </Box>
      </FormSectionRoot>
    </>
  );
};

export default PaymentSettingsBasic;
