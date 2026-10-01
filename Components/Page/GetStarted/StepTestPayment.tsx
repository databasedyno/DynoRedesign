import React, { useEffect, useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import CopyInline from "@/Components/UX/CopyInline";
import SandboxSimulatorCard from "@/Components/Page/API/SandboxSimulatorCard";
import axiosBaseApi from "@/axiosConfig";
import { StepFooter, StepHeader } from "./StepChrome";
import { markTestPaymentDone, type SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onGoApiKey: () => void;
  onFinish: () => void;
}

/**
 * Developer track — Step 5: make a test payment. Embeds the existing sandbox
 * simulator (create a dpk_test_ payment → walk it pending → confirmed →
 * settled + fire the signed webhooks; never real funds). Completes on a
 * simulated settle, any real payment, or a settled sandbox payment made
 * earlier on another device.
 */
const StepTestPayment: React.FC<Props> = ({ progress, onBack, onGoApiKey, onFinish }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { hasTestKey, hasPayment, hasTestPayment, companyId } = progress;
  const done = hasPayment || hasTestPayment;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  // Cross-device: a sandbox payment already simulated to settled also counts.
  useEffect(() => {
    if (!companyId || !hasTestKey || hasTestPayment) return;
    let cancelled = false;
    axiosBaseApi
      .get("userApi/transactions/sandbox/recent", { params: { company_id: companyId, limit: 10 } })
      .then((res) => {
        const list: Array<{ status?: string }> = res?.data?.data?.payments || [];
        if (!cancelled && list.some((p) => String(p?.status || "").toLowerCase() === "settled")) {
          markTestPaymentDone(companyId);
        }
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, hasTestKey, hasTestPayment]);

  const snippet = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://dynopay.com";
    return [
      `curl -X POST ${origin}/api/user/cryptoPayment \\`,
      `  -H "x-api-key: dpk_test_your_key" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"amount": 19.99, "currency": "USDT"}'`,
      ``,
      `# then walk it to settled (sandbox only):`,
      `curl -X POST ${origin}/api/user/simulatePayment/<payment_id> \\`,
      `  -H "x-api-key: dpk_test_your_key"`,
    ].join("\n");
  }, []);

  return (
    <Box data-testid="gs-step-testpay">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 5, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={
          done
            ? t("gs.testPayDoneTitle", { defaultValue: "Your test payment settled" })
            : t("gs.testPayTitle", { defaultValue: "Make a test payment" })
        }
        subtitle={t("gs.testPaySubtitle", {
          defaultValue:
            "Create a sandbox payment and simulate it — Dynopay walks it pending → confirmed → settled and sends your signed webhooks. No real crypto moves.",
        })}
      />

      {done && (
        <Box
          data-testid="gs-testpay-done"
          sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, mb: 2, borderRadius: "14px", border: `1px solid ${border}` }}
        >
          <Box sx={{ color: positive, display: "flex" }}>
            <Icon name="circle-check" size={22} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {t("gs.testPayDoneHeadline", { defaultValue: "End-to-end flow verified" })}
            </Box>
            <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
              {t("gs.testPayDoneBody", {
                defaultValue: "Your integration handled a payment from pending to settled. Create a live key when you're ready to accept real payments.",
              })}
            </Box>
          </Box>
        </Box>
      )}

      {!hasTestKey ? (
        <Box
          data-testid="gs-testpay-needs-key"
          sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 2, borderRadius: "14px", border: `1px dashed ${border}` }}
        >
          <Box sx={{ color: muted, display: "flex", mt: "2px" }}>
            <Icon name="key-round" size={18} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {t("gs.testPayNeedsKeyTitle", { defaultValue: "You need a sandbox key first" })}
            </Box>
            <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
              {t("gs.testPayNeedsKeyBody", {
                defaultValue: "Test payments only work with a sandbox (dpk_test_) key, so real funds are never involved.",
              })}
            </Box>
            <Box
              component="button"
              type="button"
              data-testid="gs-testpay-go-apikey"
              onClick={onGoApiKey}
              sx={{
                mt: 1,
                p: 0,
                border: 0,
                background: "transparent",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 700,
                color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
              }}
            >
              {t("gs.testPayCreateKey", { defaultValue: "Create a sandbox key →" })}
            </Box>
          </Box>
        </Box>
      ) : (
        <>
          <Box data-testid="gs-testpay-simulator">
            <SandboxSimulatorCard />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: ink }}>
                {t("gs.testPayFromCode", { defaultValue: "Or from your code" })}
              </Box>
              <CopyInline value={snippet} size={14} testId="gs-testpay-copy-snippet" />
            </Box>
            <Box
              component="pre"
              data-testid="gs-testpay-snippet"
              sx={{
                m: 0,
                p: 1.75,
                borderRadius: "12px",
                overflowX: "auto",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                lineHeight: 1.6,
                color: isDark ? "#E5E7EB" : "#111827",
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.04)",
                border: `1px solid ${border}`,
              }}
            >
              {snippet}
            </Box>
          </Box>
        </>
      )}

      <StepFooter
        onBack={onBack}
        note={
          done
            ? undefined
            : t("gs.testPayLaterNote", { defaultValue: "You can also simulate later from Developers → API keys." })
        }
        primaryLabel={
          done
            ? t("gs.testPayFinish", { defaultValue: "Finish — open Developers" })
            : t("gs.testPayOpenDevelopers", { defaultValue: "Open Developers" })
        }
        onPrimary={onFinish}
        primaryTestId="gs-testpay-finish"
      />
    </Box>
  );
};

export default StepTestPayment;
