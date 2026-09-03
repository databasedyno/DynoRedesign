import { brandFg } from "@/constants/theme";
import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
  Snackbar,
} from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import CopyIcon from "@/assets/Icons/CopyIcon";
import UnderPaymentIcon from "@/assets/Icons/UnderPaymentIcon";
import { Icon } from "@iconify/react";
import { useTranslation } from 'react-i18next';
import { formatWithSeparators, formatCryptoAmount } from "@/utils/currencyFormat";
import copyToClipboard from "@/helpers/copyToClipboard";
import { toFixedStr } from "@/utils/money";

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
  // New props for consistency
  redirectUrl?: string | null;
  merchantName?: string;
  email?: string;
  // Currency display props
  displayCurrency?: string;
  transferRate?: number;
}

// Helper function to format amounts correctly for crypto vs fiat
const formatAmount = (amount: number, currency: string): string => {
  return formatCryptoAmount(amount, currency);
};

const UnderPayment = ({
  paidAmount,
  expectedAmount,
  remainingAmount,
  currency,
  onPayRemaining,
  transactionId = "",
  paidAmountUsd,
  expectedAmountUsd,
  remainingAmountUsd,
  baseCurrency = "USD",
  graceMinutes = 30,
  redirectUrl,
  merchantName,
  email,
  displayCurrency,
  transferRate = 1,
}: UnderPaymentProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  
  // Use displayCurrency if provided, otherwise fall back to baseCurrency
  const showCurrency = displayCurrency || baseCurrency;
  
  // Convert USD amounts to display currency
  const convertedPaidAmount = (paidAmountUsd || 0) * transferRate;
  const convertedExpectedAmount = (expectedAmountUsd || 0) * transferRate;
  const convertedRemainingAmount = (remainingAmountUsd || 0) * transferRate;
  const { t } = useTranslation('common');
  const [copySnackbar, setCopySnackbar] = useState(false);
  
  const progressPercent = expectedAmount > 0 
    ? Math.min((paidAmount / expectedAmount) * 100, 100) 
    : 0;

  const handleCopyTransactionId = useCallback(async () => {
    if (transactionId) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await copyToClipboard(transactionId);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = transactionId;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setCopySnackbar(true);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = transactionId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySnackbar(true);
      }
    }
  }, [transactionId]);

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor={isDark ? theme.palette.background.default : "#F8FAFC"}
        px={2}
        minHeight={"calc(100vh - 340px)"}
      >
        <Paper
          elevation={3}
          data-testid="underpayment-card"
          sx={{
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            width: "100%",
            maxWidth: 500,
            textAlign: "center",
            margin: 0,
            border: `1px solid ${isDark ? theme.palette.divider : '#E9ECF2'}`,
            boxShadow: isDark 
              ? "0px 45px 64px 0px rgba(0,0,0,0.3)" 
              : "0px 45px 64px 0px #0D03230F",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box display="flex" justifyContent="center" mb={2}>
            <UnderPaymentIcon />
          </Box>

          <Typography
            variant="h6"
            fontWeight={500}
            fontSize={{ xs: 20, sm: 25 }}
            gutterBottom
            fontFamily="var(--font-sans)"
            color={theme.palette.text.primary}
          >
            {t('underpayment.title')}
          </Typography>

          <Typography
            variant="body2"
            color={isDark ? theme.palette.text.secondary : "#515151"}
            mb={3}
            fontFamily="var(--font-sans)"
          >
            {t('underpayment.subtitle')}
          </Typography>

          {/* Progress Bar */}
          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography
                variant="caption"
                color={isDark ? theme.palette.text.secondary : "#515151"}
                fontFamily="var(--font-sans)"
                fontWeight={500}
              >
                {t('underpayment.paymentProgress')}
              </Typography>
              <Typography
                variant="caption"
                color="#10B981"
                fontFamily="var(--font-sans)"
                fontWeight={600}
              >
                {t('underpayment.complete', { percent: toFixedStr(progressPercent, 1) })}
              </Typography>
            </Box>
            <Box
              sx={{
                width: '100%',
                height: 10,
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                borderRadius: 5,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  bgcolor: '#10B981',
                  borderRadius: 5,
                  transition: 'width 0.5s ease-in-out',
                }}
              />
            </Box>
          </Box>

          {/* Grace Period Warning */}
          <Box 
            bgcolor={isDark ? 'rgba(254, 243, 199, 0.1)' : "#FEF3C7"}
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
              {t('underpayment.graceWarning', { minutes: graceMinutes })}
            </Typography>
          </Box>

          {/* Transaction ID Box */}
          {transactionId && (
            <Box
              sx={{
                border: `1px solid ${isDark ? theme.palette.divider : '#E9ECF2'}`,
                borderRadius: '10px',
                p: 2,
                mb: 2,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
              }}
            >
              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Box textAlign='left'>
                  <Typography
                    fontSize={10}
                    fontWeight={600}
                    color={isDark ? theme.palette.text.secondary : '#666'}
                    
                    letterSpacing={0.5}
                  >
                    {t('success.transactionId')}
                  </Typography>
                  <Typography
                    fontWeight={500}
                    fontSize={13}
                    color={theme.palette.text.primary}
                    
                  >
                    #{transactionId}
                  </Typography>
                </Box>
                <Tooltip title={t('common.copy')}>
                  <IconButton
                    size='small'
                    onClick={handleCopyTransactionId}
                    data-testid="copy-transaction-btn"
                    sx={{
                      bgcolor: isDark ? '#2a2a4a' : '#E9ECF2',
                      p: 0.75,
                      borderRadius: '6px',
                      '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}

          <Box
            border={`1px solid ${isDark ? theme.palette.divider : '#E2E8F0'}`}
            borderRadius={2}
            px={2}
            mb={2}
            bgcolor={isDark ? 'rgba(255,255,255,0.02)' : 'transparent'}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={2}
            >
              <Typography
                variant="subtitle2"
                fontWeight={400}
                fontSize={16}
                color={isDark ? theme.palette.text.secondary : "#515151"}
                fontFamily="var(--font-sans)"
                sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
              >
                {t('underpayment.paid')}
              </Typography>

              <Box textAlign="right">
                <Typography
                  variant="subtitle2"
                  fontWeight={400}
                  color={isDark ? theme.palette.text.secondary : "#515151"}
                  fontSize={16}
                  fontFamily="var(--font-sans)"
                  sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
                >
                  {formatAmount(paidAmount, currency)} {currency}
                </Typography>
                {paidAmountUsd !== undefined && (
                  <Typography
                    variant="caption"
                    color={isDark ? theme.palette.text.secondary : "#737373"}
                    fontFamily="var(--font-sans)"
                    fontSize={12}
                  >
                    ≈ {formatWithSeparators(convertedPaidAmount, showCurrency)} {showCurrency}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={2}
            >
              <Typography
                variant="subtitle2"
                fontWeight={500}
                fontSize={20}
                color={theme.palette.text.primary}
                fontFamily="var(--font-sans)"
                sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
              >
                {t('checkout.toPay')}
              </Typography>

              <Box textAlign="right">
                <Typography
                  variant="subtitle2"
                  fontWeight={500}
                  color={theme.palette.text.primary}
                  fontSize={20}
                  fontFamily="var(--font-sans)"
                  sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
                >
                  {formatAmount(remainingAmount, currency)} {currency}
                </Typography>
                {remainingAmountUsd !== undefined && (
                  <Typography
                    variant="caption"
                    color={isDark ? theme.palette.text.secondary : "#737373"}
                    fontFamily="var(--font-sans)"
                    fontSize={12}
                  >
                    ≈ {formatWithSeparators(convertedRemainingAmount, showCurrency)} {showCurrency}
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.divider : undefined }} />

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
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5",
                    borderColor: "#10B981",
                  },
                }}
              >
                {t('underpayment.payRemainingCrypto')}
              </Button>
            </Box>
          </Box>

          {/* Security badge */}
          <Box 
            display='flex' 
            alignItems='center' 
            justifyContent='center' 
            gap={0.5}
            mt={2}
          >
            <Icon icon="mdi:lock" width={14} color={brandFg(theme.palette.mode === "dark")} />
            <Typography
              fontSize={12}
              
              color={brandFg(theme.palette.mode === "dark")}
              fontWeight={500}
            >
              {t('checkout.securePayment')}
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message={t('checkout.copied')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default UnderPayment;
