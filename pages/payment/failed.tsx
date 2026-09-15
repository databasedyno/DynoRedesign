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
          {(() => {
            const st = String(errorData?.status ?? "").toLowerCase();
            const byStatus: Record<string, string> = {
              expired: t("paymentResult.failed.expired", { defaultValue: "The payment window closed before the payment was completed. Nothing was charged — you can start again whenever you're ready." }),
              cancelled: t("paymentResult.failed.cancelled", { defaultValue: "The payment was cancelled before it completed. Nothing was charged." }),
              underpaid: t("paymentResult.failed.underpaid", { defaultValue: "The amount that arrived was less than the amount due, so the payment couldn't be completed. Check the request and try again." }),
              declined: t("paymentResult.failed.declined", { defaultValue: "The payment was declined by the provider. Try another method or contact your bank." }),
            };
            return byStatus[st] || (errorData?.error ? String(errorData.error) : t("paymentFailedBody"));
          })()}
        </Typography>
        <Typography data-testid="payment-failed-next" sx={{ fontFamily: "var(--font-sans)", color: "text.secondary", mb: 3, fontSize: 13.5 }}>
          {t("paymentResult.failed.next", { defaultValue: "Nothing to undo — no money moved. If you were charged anyway, keep the reference below and contact support; we'll sort it out." })}
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
        <Typography sx={{ mt: 2.5, fontFamily: "var(--font-sans)", fontSize: 12.5, color: "text.secondary" }}>
          <Box component="a" href="/help-support" data-testid="payment-failed-support-link" sx={{ color: "primary.main", fontWeight: 600 }}>
            {t("paymentResult.contactSupport", { defaultValue: "Contact support" })}
          </Box>
          {" · "}
          <Box component="a" href="/system-status" data-testid="payment-failed-status-link" sx={{ color: "primary.main", fontWeight: 600 }}>
            {t("paymentResult.systemStatus", { defaultValue: "System status" })}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default Failed;
