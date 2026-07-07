import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Typography,
  useTheme,
  Tooltip,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import CopyIcon from "@/assets/Icons/CopyIcon";
import OverPaymentIcon from "@/assets/Icons/OverPaymentIcon";
import DoneIcon from "@mui/icons-material/Done";
import { Icon } from "@iconify/react";
import { useTranslation } from 'react-i18next';
import { formatWithSeparators, formatCryptoAmount } from "@/utils/currencyFormat";

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  const [copySnackbar, setCopySnackbar] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);
  
  // Use displayCurrency if provided, otherwise fall back to baseCurrency
  const showCurrency = displayCurrency || baseCurrency;
  
  // Convert USD amounts to display currency
  const convertedPaidAmount = (paidAmountUsd || 0) * transferRate;
  const convertedExpectedAmount = (expectedAmountUsd || 0) * transferRate;
  const convertedExcessAmount = (excessAmountUsd || 0) * transferRate;

  // Auto-redirect if redirectUrl is provided
  useEffect(() => {
    if (redirectUrl && transactionId) {
      setIsAutoRedirecting(true);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleRedirect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [redirectUrl, transactionId]);

  const handleRedirect = useCallback(() => {
    if (redirectUrl && transactionId) {
      try {
        const url = new URL(redirectUrl);
        url.searchParams.set('transaction_id', transactionId);
        url.searchParams.set('status', 'success');
        window.location.href = url.toString();
      } catch (e) {
        const separator = redirectUrl.includes('?') ? '&' : '?';
        window.location.href = `${redirectUrl}${separator}transaction_id=${transactionId}&status=success`;
      }
    } else {
      onGoToWebsite();
    }
  }, [redirectUrl, transactionId, onGoToWebsite]);

  const handleCopyTransactionId = useCallback(async () => {
    if (transactionId) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(transactionId);
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
          data-testid="overpayment-card"
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
            <OverPaymentIcon />
          </Box>

          <Typography
            variant="h6"
            fontWeight={500}
            fontSize={{ xs: 20, sm: 25 }}
            gutterBottom
            fontFamily="Space Grotesk"
            color={theme.palette.text.primary}
          >
            {t('overpayment.title')}
          </Typography>

          <Typography
            variant="body2"
            color={isDark ? theme.palette.text.secondary : "#515151"}
            mb={3}
            fontFamily="Space Grotesk"
          >
            {t('overpayment.subtitle')}
          </Typography>

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
                fontFamily="Space Grotesk"
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
                  fontFamily="Space Grotesk"
                  sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
                >
                  {formatAmount(paidAmount, currency)} {currency}
                </Typography>
                {paidAmountUsd !== undefined && (
                  <Typography
                    variant="caption"
                    color={isDark ? theme.palette.text.secondary : "#737373"}
                    fontFamily="Space Grotesk"
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
            >
              <Typography
                variant="subtitle2"
                fontWeight={400}
                fontSize={16}
                color={isDark ? theme.palette.text.secondary : "#515151"}
                fontFamily="Space Grotesk"
                sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
              >
                {t('overpayment.totalDue')}
              </Typography>

              <Box textAlign="right">
                <Typography
                  variant="subtitle2"
                  fontWeight={400}
                  color={isDark ? theme.palette.text.secondary : "#515151"}
                  fontSize={16}
                  fontFamily="Space Grotesk"
                  sx={{ fontSize: { xs: "12px", sm: "14px", md: "16px" } }}
                >
                  {formatAmount(expectedAmount, currency)} {currency}
                </Typography>
                {expectedAmountUsd !== undefined && (
                  <Typography
                    variant="caption"
                    color={isDark ? theme.palette.text.secondary : "#737373"}
                    fontFamily="Space Grotesk"
                    fontSize={12}
                  >
                    ≈ {formatWithSeparators(convertedExpectedAmount, showCurrency)} {showCurrency}
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
                fontFamily="Space Grotesk"
                sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
              >
                {t('overpayment.excess')}
              </Typography>

              <Box textAlign="right">
                <Typography
                  variant="subtitle2"
                  fontWeight={500}
                  color={theme.palette.text.primary}
                  fontSize={20}
                  fontFamily="Space Grotesk"
                  sx={{ fontSize: { xs: "14px", sm: "16px", md: "20px" } }}
                >
                  {formatAmount(excessAmount, currency)} {currency}
                </Typography>
                {excessAmountUsd !== undefined && (
                  <Typography
                    variant="caption"
                    color={isDark ? theme.palette.text.secondary : "#737373"}
                    fontFamily="Space Grotesk"
                    fontSize={12}
                  >
                    ≈ {formatWithSeparators(convertedExcessAmount, showCurrency)} {showCurrency}
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.divider : undefined }} />

            {/* Refund Notice */}
            <Box
              mt={1}
              mb={2}
              borderRadius={2}
              display="flex"
              alignItems="center"
              bgcolor={isDark ? 'rgba(18, 183, 106, 0.1)' : "#F5F8FF"}
              gap={1}
              px={2}
              py={1.5}
            >
              <DoneIcon sx={{ fontSize: 17, color: "#12B76A" }} />
              <Typography
                fontSize={13}
                color={isDark ? theme.palette.text.secondary : "#515151"}
                fontFamily="Space Grotesk"
                textAlign="left"
                fontWeight={500}
              >
                {t('overpayment.refundNotice')}
              </Typography>
            </Box>

            {/* Email confirmation notice */}
            {email && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={0.5} 
                mb={2}
              >
                <Icon icon="mdi:email-check" width={16} color="#12B76A" />
                <Typography
                  fontSize={13}
                  
                  color={isDark ? theme.palette.text.secondary : '#666'}
                >
                  {t('success.confirmationSent', { email })}
                </Typography>
              </Box>
            )}

            {/* Redirect countdown */}
            {isAutoRedirecting && redirectUrl && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={1} 
                mb={2}
              >
                <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
                <Typography
                  fontSize={13}
                  
                  color={isDark ? theme.palette.text.secondary : '#515151'}
                >
                  {merchantName 
                    ? t('success.redirectingTo', { merchant: merchantName })
                    : t('success.redirectingIn', { seconds: countdown })
                  }
                </Typography>
              </Box>
            )}

            {/* CTA Button */}
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
                  fontSize: '15px',
                  fontWeight: 600,
                  "&:hover": {
                    backgroundColor: (theme.palette.primary as any).hover || theme.palette.primary.dark,
                  },
                }}
                endIcon={<Icon icon="mdi:arrow-right" width={18} />}
              >
                {merchantName 
                  ? t('success.returnTo', { merchant: merchantName })
                  : redirectUrl 
                    ? t('success.returnTo', { merchant: 'Merchant' })
                    : t('success.done')
                }
              </Button>
            </Box>

            {redirectUrl && (
              <Typography
                fontSize={12}
                color={isDark ? theme.palette.text.secondary : '#888'}
                
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={handleRedirect}
              >
                {t('success.clickIfNotRedirected')}
              </Typography>
            )}
          </Box>

          {/* Security badge */}
          <Box 
            display='flex' 
            alignItems='center' 
            justifyContent='center' 
            gap={0.5}
            mt={2}
          >
            <Icon icon="mdi:lock" width={14} color={theme.palette.primary.main} />
            <Typography
              fontSize={12}
              
              color={theme.palette.primary.main}
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

export default OverPayment;
