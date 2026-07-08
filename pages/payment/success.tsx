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
          borderRadius: 3,
          p: 5,
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
          sx={{ fontFamily: "OutfitSemiBold", mb: 1, color: "text.primary" }}
        >
          {t("paymentSuccessful")}
        </Typography>

        <Typography
          sx={{
            fontFamily: "OutfitRegular",
            color: "text.secondary",
            mb: 3,
            fontSize: 15,
          }}
        >
          {t("paymentProcessedSuccessfully")}
        </Typography>

        {paymentData?.transaction_id && (
          <Box
            sx={{
              background: theme.palette.mode === "dark" ? "#1a1a2e" : "#f0f4ff",
              borderRadius: 2,
              p: 2,
              mb: 3,
            }}
          >
            <Typography
              sx={{
                fontFamily: "OutfitRegular",
                fontSize: 13,
                color: "text.secondary",
                mb: 0.5,
              }}
            >
              {t("transactionIdLabel")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "OutfitMedium",
                fontSize: 14,
                wordBreak: "break-all",
              }}
            >
              {String(paymentData.transaction_id)}
            </Typography>
          </Box>
        )}

        <Button
          variant="contained"
          onClick={() => router.push("/")}
          sx={{
            fontFamily: "OutfitMedium",
            textTransform: "none",
            borderRadius: 2,
            px: 4,
            py: 1.2,
          }}
        >
          {t("returnHome")}
        </Button>
      </Box>
    </Box>
  );
};

export default Success;
