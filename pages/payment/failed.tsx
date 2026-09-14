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
          borderRadius: "12px",
          p: 5,
          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.08)"}`,
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
          sx={{ fontFamily: "var(--font-hero)", fontWeight: 600, mb: 1, color: "text.primary" }}
        >
          {t("paymentFailed")}
        </Typography>

        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            color: "text.secondary",
            mb: 3,
            fontSize: 15,
          }}
        >
          {errorData?.error
            ? String(errorData.error)
            : t("paymentFailedBody")}
        </Typography>

        {Boolean(errorData?.transaction_id) && (
          <Box
            sx={{
              background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.2)"}`,
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
              {t("transactionReferenceLabel")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-tech)",
                fontSize: 13.5,
                wordBreak: "break-all",
              }}
            >
              {String(errorData?.transaction_id ?? "")}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, justifyContent: "center" }}>
          <Button
            variant="outlined"
            onClick={() => router.back()}
            sx={{
              fontFamily: "var(--font-sans)",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              py: 1.2,
              minHeight: 44,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {t("tryAgain")}
          </Button>
          <Button
            variant="contained"
            onClick={() => router.push("/")}
            sx={{
              fontFamily: "var(--font-sans)",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              py: 1.2,
              minHeight: 44,
              width: { xs: "100%", sm: "auto" },
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
