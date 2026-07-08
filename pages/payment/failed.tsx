import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { Box, Typography, Button, useTheme } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import BrandLogo from "@/Components/Layout/BrandLogo";
import { useTranslation } from "react-i18next";

const Failed = () => {
  const { t } = useTranslation("common");
  const router = useRouter();
  const theme = useTheme();
  const [errorData, setErrorData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (router.query) {
      if (router.query.response) {
        try {
          const parsed = JSON.parse(router.query.response as string);
          setErrorData(parsed);
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
      }
      if (router.query.error || router.query.status) {
        setErrorData({
          error: router.query.error,
          status: router.query.status,
          transaction_id: router.query.transaction_id,
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

        <ErrorOutlineIcon
          sx={{ fontSize: 72, color: "#ef4444", mb: 2 }}
        />

        <Typography
          variant="h5"
          sx={{ fontFamily: "OutfitSemiBold", mb: 1, color: "text.primary" }}
        >
          {t("paymentFailed")}
        </Typography>

        <Typography
          sx={{
            fontFamily: "OutfitRegular",
            color: "text.secondary",
            mb: 3,
            fontSize: 15,
          }}
        >
          {errorData?.error
            ? String(errorData.error)
            : t("paymentFailedBody")}
        </Typography>

        {errorData?.transaction_id && (
          <Box
            sx={{
              background: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff0f0",
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
              {t("transactionReferenceLabel")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "OutfitMedium",
                fontSize: 14,
                wordBreak: "break-all",
              }}
            >
              {String(errorData.transaction_id)}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            variant="outlined"
            onClick={() => router.back()}
            sx={{
              fontFamily: "OutfitMedium",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              py: 1.2,
            }}
          >
            {t("tryAgain")}
          </Button>
          <Button
            variant="contained"
            onClick={() => router.push("/")}
            sx={{
              fontFamily: "OutfitMedium",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              py: 1.2,
            }}
          >
            {t("returnHome")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default Failed;
