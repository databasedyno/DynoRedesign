import React from "react";
import { Box, Button, Typography } from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import UnderPaymentIcon from "@/assets/Icons/UnderPaymentIcon";
import { toFixedStr } from "@/utils/money";
import {
  AmountPanel,
  AmountRow,
  OutcomeCard,
  TxIdBox,
  useOutcomeTheme,
} from "@/Components/UI/PaymentOutcome";

interface UnderPaymentProps {
  paidAmount: number;
  expectedAmount: number;
  remainingAmount: number;
  currency: string;
  onPayRemaining: (method: "bank" | "crypto") => void;
  transactionId?: string;
  paidAmountUsd?: number;
  expectedAmountUsd?: number;
  remainingAmountUsd?: number;
  baseCurrency?: string;
  graceMinutes?: number;
  redirectUrl?: string | null;
  merchantName?: string;
  email?: string;
  displayCurrency?: string;
  transferRate?: number;
}

const UnderPayment = ({
  paidAmount,
  expectedAmount,
  remainingAmount,
  currency,
  onPayRemaining,
  transactionId = "",
  paidAmountUsd,
  remainingAmountUsd,
  baseCurrency = "USD",
  graceMinutes = 30,
  displayCurrency,
  transferRate = 1,
}: UnderPaymentProps) => {
  const { theme, isDark } = useOutcomeTheme();
  const { t } = useTranslation("common");
  const showCurrency = displayCurrency || baseCurrency;
  const progressPercent =
    expectedAmount > 0 ? Math.min((paidAmount / expectedAmount) * 100, 100) : 0;

  const rows = (
    <>
      <AmountRow
        label={t("underpayment.paid")}
        amount={paidAmount}
        currency={currency}
        fiatUsd={paidAmountUsd}
        rate={transferRate}
        fiatCurrency={showCurrency}
      />
      <AmountRow
        label={t("checkout.toPay")}
        amount={remainingAmount}
        currency={currency}
        fiatUsd={remainingAmountUsd}
        rate={transferRate}
        fiatCurrency={showCurrency}
        emphasis
      />
    </>
  );

  return (
    <OutcomeCard
      testId="underpayment-card"
      icon={<UnderPaymentIcon />}
      title={t("underpayment.title")}
      subtitle={t("underpayment.subtitle")}
    >
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography
            variant="caption"
            color={isDark ? theme.palette.text.secondary : "#515151"}
            fontFamily="var(--font-sans)"
            fontWeight={500}
          >
            {t("underpayment.paymentProgress")}
          </Typography>
          <Typography variant="caption" color="#10B981" fontFamily="var(--font-sans)" fontWeight={600}>
            {t("underpayment.complete", { percent: toFixedStr(progressPercent, 1) })}
          </Typography>
        </Box>
        <Box
          sx={{
            width: "100%",
            height: 10,
            bgcolor: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${progressPercent}%`,
              height: "100%",
              bgcolor: "#10B981",
              borderRadius: 5,
              transition: "width 0.5s ease-in-out",
            }}
          />
        </Box>
      </Box>

      <Box
        bgcolor={isDark ? "rgba(254, 243, 199, 0.1)" : "#FEF3C7"}
        borderRadius={2}
        p={2}
        mb={2}
        display="flex"
        alignItems="center"
        gap={1}
      >
        <Icon icon="mdi:clock-outline" width={18} color="#92400E" />
        <Typography
          variant="body2"
          color="#92400E"
          fontFamily="var(--font-sans)"
          fontWeight={500}
          fontSize={13}
        >
          {t("underpayment.graceWarning", { minutes: graceMinutes })}
        </Typography>
      </Box>

      <TxIdBox transactionId={transactionId} />

      <AmountPanel rows={rows}>
        <Box display="flex" gap={2} mb={2}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CurrencyBitcoinIcon />}
            onClick={() => onPayRemaining("crypto")}
            data-testid="pay-remaining-btn"
            sx={{
              borderColor: "#10B981",
              color: "#10B981",
              textTransform: "none",
              borderRadius: 30,
              fontWeight: 500,
              py: { xs: 1.5, sm: 2 },
              fontSize: { xs: "14px", sm: "16px" },
              minHeight: { xs: 48, sm: 56 },
              "&:hover": {
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5",
                borderColor: "#10B981",
              },
            }}
          >
            {t("underpayment.payRemainingCrypto")}
          </Button>
        </Box>
      </AmountPanel>
    </OutcomeCard>
  );
};

export default UnderPayment;
