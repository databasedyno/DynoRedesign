import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { Box, Typography, Button, CircularProgress, useTheme } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BrandLogo from "@/Components/Layout/BrandLogo";
import { useTranslation } from "react-i18next";

const Success = () => {
  const { t } = useTranslation("common");
  const router = useRouter();
  const theme = useTheme();
  const [paymentData, setPaymentData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (router.query) {
      // Handle JSON response in query
      if (router.query.response) {
        try {
          const parsed = JSON.parse(router.query.response as string);
          setPaymentData(parsed);
        } catch (e) {
          console.error("Failed to parse payment response:", e);
        }
      }
      // Handle individual query params (from redirect URL)
      if (router.query.transaction_id || router.query.status) {
        setPaymentData({
          transaction_id: router.query.transaction_id,
          status: router.query.status,
          payment_type: router.query.payment_type,
        });
      }
    }
  }, [router.query]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.palette.mode === "dark" ? "#0a0a0a" : "#f5f7fa",
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: theme.palette.background.paper,
          borderRadius: "12px",
          p: 5,
          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.08)"}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <Box sx={{ mb: 2 }}>
          <BrandLogo redirect={false} />
        </Box>

        <CheckCircleOutlineIcon
          sx={{ fontSize: 72, color: "#22c55e", mb: 2 }}
        />

        <Typography
          variant="h5"
          sx={{ fontFamily: "var(--font-hero)", fontWeight: 600, mb: 1, color: "text.primary" }}
        >
          {t("paymentSuccessful")}
        </Typography>

        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            color: "text.secondary",
            mb: 3,
            fontSize: 15,
          }}
        >
          {t("paymentProcessedSuccessfully")}
        </Typography>

        {Boolean(paymentData?.transaction_id) && (
          <Box
            sx={{
              background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(10,10,10,0.04)",
              border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
              borderRadius: 2,
              p: 2,
              mb: 3,
            }}
          >
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "text.secondary",
                mb: 0.5,
              }}
            >
              {t("transactionIdLabel")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-tech)",
                fontSize: 13.5,
                wordBreak: "break-all",
              }}
            >
              {String(paymentData?.transaction_id ?? "")}
            </Typography>
          </Box>
        )}

        <Box
          data-testid="payment-success-next"
          sx={{
            textAlign: "left",
            background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.03)",
            borderRadius: 2,
            p: 2,
            mb: 3,
          }}
        >
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, mb: 0.75 }}>
            {t("paymentResult.nextTitle", { defaultValue: "What happens next" })}
          </Typography>
          <Typography component="ul" sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: "text.secondary", pl: 2.5, m: 0, "& li": { mb: 0.5 } }}>
            <li>{t("paymentResult.nextCredit", { defaultValue: "The amount is credited to your Dynopay wallet within a few minutes." })}</li>
            <li>{t("paymentResult.nextReceipt", { defaultValue: "A receipt is on its way to your e-mail — keep the transaction ID above for your records." })}</li>
            <li>{t("paymentResult.nextTransactions", { defaultValue: "You can follow it under Transactions in your dashboard." })}</li>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, justifyContent: "center" }}>
          <Button
            variant="contained"
            data-testid="payment-success-dashboard-btn"
            onClick={() => router.push("/transactions")}
            sx={{ fontFamily: "var(--font-sans)", textTransform: "none", borderRadius: 2, px: 3, py: 1.2, minHeight: 44, width: { xs: "100%", sm: "auto" } }}
          >
            {t("paymentResult.viewTransactions", { defaultValue: "View in Transactions" })}
          </Button>
          <Button
            variant="outlined"
            data-testid="payment-success-home-btn"
            onClick={() => router.push("/")}
            sx={{ fontFamily: "var(--font-sans)", textTransform: "none", borderRadius: 2, px: 3, py: 1.2, minHeight: 44, width: { xs: "100%", sm: "auto" } }}
          >
            {t("returnHome")}
          </Button>
        </Box>
        <Typography sx={{ mt: 2.5, fontFamily: "var(--font-sans)", fontSize: 12.5, color: "text.secondary" }}>
          {t("paymentResult.somethingWrong", { defaultValue: "Something doesn't look right?" })}{" "}
          <Box component="a" href="/help-support" data-testid="payment-success-support-link" sx={{ color: "primary.main", fontWeight: 600 }}>
            {t("paymentResult.contactSupport", { defaultValue: "Contact support" })}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default Success;
