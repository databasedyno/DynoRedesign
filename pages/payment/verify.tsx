import axiosBaseApi from "@/axiosConfig";
import { generateStatusUrl } from "@/helpers";
import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import BrandLogo from "@/Components/Layout/BrandLogo";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type State = "checking" | "slow" | "nothing" | "error";

/**
 * Legacy fiat-funding return URL (card / mobile money). Never a bare spinner:
 * checking → (redirects to /payment/success|failed) · slow after 20 s · clear
 * "nothing to verify" and error states with a way out.
 */
const Verify = () => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.response;
    if (!raw) { setState("nothing"); return; }
    let active = true;
    const slowTimer = setTimeout(() => { if (active) setState((s) => (s === "checking" ? "slow" : s)); }, 20000);
    const run = async () => {
      try {
        const response = JSON.parse(String(raw));
        const res = await axiosBaseApi.post("/wallet/confirmPayment", response);
        if (!active) return;
        router.replace(generateStatusUrl(res.data.data));
      } catch (err: unknown) {
        if (!active) return;
        const data = (err as { response?: { data?: { data?: unknown } } })?.response?.data?.data;
        if (data) router.replace(generateStatusUrl(data));
        else setState("error");
      }
    };
    run();
    return () => { active = false; clearTimeout(slowTimer); };
  }, [router.isReady, router.query.response]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = theme.palette.mode === "dark";
  const linkSx = { color: "primary.main", fontWeight: 600 } as const;

  return (
    <Box data-testid="payment-verify-page" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2, backgroundColor: isDark ? "#0b0f19" : "#f6f7fb" }}>
      <Box sx={{ width: "100%", maxWidth: 480, textAlign: "center", p: { xs: 3, sm: 5 }, borderRadius: 3, background: theme.palette.background.paper, border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}` }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}><BrandLogo redirect={false} /></Box>

        {(state === "checking" || state === "slow") && (
          <Box data-testid="payment-verify-checking">
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h5" sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, mb: 1 }}>{t("verifyingPayment")}</Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", color: "text.secondary", fontSize: 14.5 }}>
              {state === "slow"
                ? t("paymentResult.verify.slow", { defaultValue: "This is taking longer than usual. Your payment is safe — keep this page open, or check Transactions in a few minutes." })
                : t("paymentResult.verify.checking", { defaultValue: "We're confirming the payment with the provider. This usually takes under 10 seconds — don't close this page." })}
            </Typography>
            {state === "slow" && (
              <Button data-testid="payment-verify-transactions-btn" variant="outlined" onClick={() => router.push("/transactions")} sx={{ mt: 3, textTransform: "none", borderRadius: 2, minHeight: 44 }}>
                {t("paymentResult.viewTransactions", { defaultValue: "View in Transactions" })}
              </Button>
            )}
          </Box>
        )}

        {state === "nothing" && (
          <Box data-testid="payment-verify-nothing">
            <ErrorOutlineIcon sx={{ fontSize: 56, color: "#f59e0b", mb: 1.5 }} />
            <Typography variant="h5" sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, mb: 1 }}>
              {t("paymentResult.verify.nothingTitle", { defaultValue: "Nothing to verify here" })}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", color: "text.secondary", fontSize: 14.5, mb: 3 }}>
              {t("paymentResult.verify.nothingBody", { defaultValue: "This page only works when a payment provider sends you back to it. If you just paid, your Transactions list shows the current status." })}
            </Typography>
            <Button data-testid="payment-verify-transactions-btn" variant="contained" onClick={() => router.push("/transactions")} sx={{ textTransform: "none", borderRadius: 2, minHeight: 44, px: 3 }}>
              {t("paymentResult.viewTransactions", { defaultValue: "View in Transactions" })}
            </Button>
          </Box>
        )}

        {state === "error" && (
          <Box data-testid="payment-verify-error">
            <ErrorOutlineIcon sx={{ fontSize: 56, color: "#ef4444", mb: 1.5 }} />
            <Typography variant="h5" sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, mb: 1 }}>
              {t("paymentResult.verify.errorTitle", { defaultValue: "We couldn't confirm the payment yet" })}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", color: "text.secondary", fontSize: 14.5, mb: 3 }}>
              {t("paymentResult.verify.errorBody", { defaultValue: "The provider didn't answer. If money left your account it is not lost — it will show under Transactions once confirmed, and support can trace it with your reference." })}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexDirection: { xs: "column", sm: "row" } }}>
              <Button data-testid="payment-verify-retry-btn" variant="contained" onClick={() => router.reload()} sx={{ textTransform: "none", borderRadius: 2, minHeight: 44, px: 3 }}>
                {t("tryAgain")}
              </Button>
              <Button data-testid="payment-verify-transactions-btn" variant="outlined" onClick={() => router.push("/transactions")} sx={{ textTransform: "none", borderRadius: 2, minHeight: 44, px: 3 }}>
                {t("paymentResult.viewTransactions", { defaultValue: "View in Transactions" })}
              </Button>
            </Box>
          </Box>
        )}

        <Typography sx={{ mt: 3, fontFamily: "var(--font-sans)", fontSize: 12.5, color: "text.secondary" }}>
          <Box component="a" href="/help-support" data-testid="payment-verify-support-link" sx={linkSx}>{t("paymentResult.contactSupport", { defaultValue: "Contact support" })}</Box>
          {" · "}
          <Box component="a" href="/system-status" data-testid="payment-verify-status-link" sx={linkSx}>{t("paymentResult.systemStatus", { defaultValue: "System status" })}</Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default Verify;
