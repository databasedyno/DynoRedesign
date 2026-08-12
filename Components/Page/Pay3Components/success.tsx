import { Box, Typography, CircularProgress, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { brandFg } from "@/constants/theme";

interface SuccessProps {
  redirectUrl?: string | null;
  transactionId?: string;
}

const Success = ({ redirectUrl, transactionId }: SuccessProps) => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [countdown, setCountdown] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Auto-redirect after 3 seconds if redirectUrl is provided
  useEffect(() => {
    if (redirectUrl && transactionId) {
      setIsRedirecting(true);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Build redirect URL with transaction info
            try {
              const url = new URL(redirectUrl);
              url.searchParams.set('transaction_id', transactionId);
              url.searchParams.set('status', 'success');
              window.location.href = url.toString();
            } catch (e) {
              // If URL parsing fails, redirect with query string
              const separator = redirectUrl.includes('?') ? '&' : '?';
              window.location.href = `${redirectUrl}${separator}transaction_id=${transactionId}&status=success`;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [redirectUrl, transactionId]);

  // Legacy behavior - handle query params
  useEffect(() => {
    if (router.query && router.query.response) {
      try {
        const successRes = JSON.parse(router.query.response as string);
        if (successRes.redirect) {
          const url: any = localStorage.getItem("redirect_uri");
          console.log(url);
          if (url) {
            localStorage.removeItem("redirect_uri");
            window.location.replace(url);
          }
        }
        console.log(router.query.response);
      } catch (_e) {
        /* malformed response param — ignore instead of crashing the page */
      }
    }
  }, [router.query]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="200px"
      textAlign="center"
      p={3}
    >
      <Typography
        variant="h5"
        fontWeight={600}
        color="#13B76A"
        fontFamily="var(--font-sans)"
        mb={2}
      >
        {t('paymentSuccessful')}
      </Typography>
      
      {isRedirecting && (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress size={24} sx={{ color: brandFg(isDark) }} />
          <Typography
            variant="body1"
            color={theme.palette.text.secondary}
            fontFamily="var(--font-sans)"
          >
            Redirecting to merchant in {countdown} seconds...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Success;
