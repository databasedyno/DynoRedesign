import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import OverPaymentIcon from "@/assets/Icons/OverPaymentIcon";
import { brandFg } from "@/constants/theme";
import {
  AmountPanel,
  AmountRow,
  OutcomeCard,
  TxIdBox,
  useOutcomeTheme,
} from "@/Components/UI/PaymentOutcome";

interface OverPaymentProps {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  onGoToWebsite: () => void;
  transactionId?: string;
  paidAmountUsd?: number;
  expectedAmountUsd?: number;
  excessAmountUsd?: number;
  baseCurrency?: string;
  redirectUrl?: string | null;
  merchantName?: string;
  email?: string;
  displayCurrency?: string;
  transferRate?: number;
}

const OverPayment = ({
  paidAmount,
  expectedAmount,
  excessAmount,
  currency,
  onGoToWebsite,
  transactionId = "",
  paidAmountUsd,
  expectedAmountUsd,
  excessAmountUsd,
  baseCurrency = "USD",
  redirectUrl,
  merchantName,
  email,
  displayCurrency,
  transferRate = 1,
}: OverPaymentProps) => {
  const { theme, isDark } = useOutcomeTheme();
  const { t } = useTranslation("common");
  const [countdown, setCountdown] = useState(5);
  const showCurrency = displayCurrency || baseCurrency;
  const muted = isDark ? theme.palette.text.secondary : "#515151";
  const autoRedirect = !!(redirectUrl && transactionId);

  const handleRedirect = useCallback(() => {
    if (redirectUrl && transactionId) {
      try {
        const url = new URL(redirectUrl);
        url.searchParams.set("transaction_id", transactionId);
        url.searchParams.set("status", "success");
        window.location.href = url.toString();
      } catch {
        const separator = redirectUrl.includes("?") ? "&" : "?";
        window.location.href = `${redirectUrl}${separator}transaction_id=${transactionId}&status=success`;
      }
    } else {
      onGoToWebsite();
    }
  }, [redirectUrl, transactionId, onGoToWebsite]);

  const redirectRef = useRef(handleRedirect);
  redirectRef.current = handleRedirect;

  useEffect(() => {
    if (!autoRedirect) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          redirectRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRedirect]);

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
        label={t("overpayment.totalDue")}
        amount={expectedAmount}
        currency={currency}
        fiatUsd={expectedAmountUsd}
        rate={transferRate}
        fiatCurrency={showCurrency}
        py={0}
      />
      <AmountRow
        label={t("overpayment.excess")}
        amount={excessAmount}
        currency={currency}
        fiatUsd={excessAmountUsd}
        rate={transferRate}
        fiatCurrency={showCurrency}
        emphasis
      />
    </>
  );

  return (
    <OutcomeCard
      testId="overpayment-card"
      icon={<OverPaymentIcon />}
      title={t("overpayment.title")}
      subtitle={t("overpayment.subtitle")}
    >
      <TxIdBox transactionId={transactionId} />

      <AmountPanel rows={rows}>
        <Box
          mt={1}
          mb={2}
          borderRadius={2}
          display="flex"
          alignItems="center"
          bgcolor={isDark ? "rgba(18, 183, 106, 0.1)" : "#F5F8FF"}
          gap={1}
          px={2}
          py={1.5}
        >
          <DoneIcon sx={{ fontSize: 17, color: "#12B76A" }} />
          <Typography
            fontSize={13}
            color={muted}
            fontFamily="var(--font-sans)"
            textAlign="left"
            fontWeight={500}
          >
            {t("overpayment.refundNotice")}
          </Typography>
        </Box>

        {email && (
          <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={2}>
            <Icon icon="mdi:email-check" width={16} color="#12B76A" />
            <Typography fontSize={13} color={isDark ? theme.palette.text.secondary : "#666"}>
              {t("success.confirmationSent", { email })}
            </Typography>
          </Box>
        )}

        {autoRedirect && (
          <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
            <CircularProgress size={16} sx={{ color: brandFg(isDark) }} />
            <Typography fontSize={13} color={muted}>
              {merchantName
                ? t("success.redirectingTo", { merchant: merchantName })
                : t("success.redirectingIn", { seconds: countdown })}
            </Typography>
          </Box>
        )}

        <Box display="flex" gap={2} mb={2}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleRedirect}
            data-testid="return-btn"
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              textTransform: "none",
              borderRadius: 30,
              py: 1.75,
              fontSize: "15px",
              fontWeight: 600,
              "&:hover": {
                backgroundColor:
                  (theme.palette.primary as any).hover || theme.palette.primary.dark,
              },
            }}
            endIcon={<Icon icon="mdi:arrow-right" width={18} />}
          >
            {merchantName
              ? t("success.returnTo", { merchant: merchantName })
              : redirectUrl
                ? t("success.returnTo", { merchant: "Merchant" })
                : t("success.done")}
          </Button>
        </Box>

        {redirectUrl && (
          <Typography
            fontSize={12}
            color={isDark ? theme.palette.text.secondary : "#888"}
            sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            onClick={handleRedirect}
          >
            {t("success.clickIfNotRedirected")}
          </Typography>
        )}
      </AmountPanel>
    </OutcomeCard>
  );
};

export default OverPayment;
