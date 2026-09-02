import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import CreatePaymentLinkPage from "@/Components/Page/CreatePaymentLink";
import KycGraceBanner from "@/Components/Page/Dashboard/KycGraceBanner";
import useIsMobile from "@/hooks/useIsMobile";
import { useKycGate } from "@/hooks/useKycGate";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { pageProps, rootReducer } from "@/utils/types";
import { Box, Typography, useTheme } from "@mui/material";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  VerifiedUserRounded,
} from "@mui/icons-material";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import CreateCompanyModal from "@/Components/UI/OnboardingFlow/CreateCompanyModal";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";

const CreatePaymentLink = ({ setPageName, setPageDescription }: pageProps) => {
  const namespaces = ["createPaymentLinkScreen", "common"];
  const { t } = useTranslation(namespaces);
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const dispatch = useDispatch();

  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const kyc = useKycGate();
  const selectedCompanyId = companyState.selectedCompanyId;
  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = walletState.walletList?.length > 0;
  // KYC only gates once the 90-day grace period has expired (backend returns
  // 403 [KYC_REQUIRED] on create). During grace the form stays usable and the
  // amber KycGraceBanner is shown above it instead.
  const kycBlocked = kyc.blocked;
  const setupComplete = hasCompany && hasWallet && !kycBlocked;
  // F4: track fetch error separately so we can show a retry banner instead
  // of the "Create your first company" onboarding gate when the API failed.
  const companyFetchError = (companyState as any).fetchError === true;
  const companyFetched = (companyState as any).fetched === true;
  // S50 UX-fix: also track wallet-fetched status so we don't flash the
  // "Add a Payout Wallet" setup guard for ~1-3s while the wallet API is
  // still in-flight on a fresh page reload. Both flags must be true before
  // we can conclude "this merchant genuinely has no wallets".
  const walletFetched = (walletState as any).fetched === true;
  const dataStillLoading = !companyFetched || !walletFetched || kyc.loading;

  // Inline modal state — keep the user on /create-pay-link
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  useEffect(() => {
    companyState.refetchCompanies();
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    walletState.refetchWallets();
  }, [dispatch, selectedCompanyId]);

  // Backend said "KYC_REQUIRED" on create (status flipped since page load) →
  // re-read the gate so the inline KYC step replaces the form instead of a toast.
  const createErrorField = useSelector((s: rootReducer) => s.paymentLinkReducer?.createErrorField);
  const createErrorNonce = useSelector((s: rootReducer) => s.paymentLinkReducer?.createErrorNonce);
  useEffect(() => {
    if (createErrorField === "kyc") kyc.refresh();
  }, [createErrorNonce]);

  // Event-triggered "finish setting up to get paid" email — fired once per
  // gate per browser session the moment the guard blocks the merchant. The
  // backend re-verifies the gate and dedups per week in Redis.
  const guardShown = !dataStillLoading && !companyFetchError && !setupComplete;
  const openGate = !hasCompany ? "brand" : !hasWallet ? "wallet" : kycBlocked ? "kyc" : null;
  useEffect(() => {
    if (!guardShown || !openGate) return;
    const key = `dp:activation-nudge:${openGate}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    axiosBaseApi
      .post(API_ENDPOINTS.user.activationNudge, { gate: openGate, company_id: selectedCompanyId || undefined })
      .catch(() => {});
  }, [guardShown, openGate, selectedCompanyId]);

  const tCreatePaymentLink = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "createPaymentLinkScreen", defaultValue }),
    [t],
  );

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(
        tCreatePaymentLink("createPaymentLinkTitle", "Create Payment Link"),
      );
      setPageDescription("");
    }
  }, [setPageName, setPageDescription, tCreatePaymentLink]);

  // Build step list — show all steps, mark each done/active so user sees progress.
  // The KYC step only appears once verification is actually required (> $10k volume).
  type Step = {
    key: "company" | "wallet" | "kyc";
    label: string;
    helper: string;
    icon: typeof BusinessRounded;
    done: boolean;
    busy?: boolean;
    onClick: () => void;
  };
  const kycHelper = kyc.starting
    ? tCreatePaymentLink("setupStepKycStarting", "Opening verification…")
    : kyc.hasSession
      ? tCreatePaymentLink("setupStepKycHelperContinue", "Continue your verification where you left off.")
      : kycBlocked || kyc.daysRemaining === null
        ? tCreatePaymentLink("setupStepKycHelperBlocked", "Required — you've passed $10,000 in payment volume. Takes ~5 minutes.")
        : t("setupStepKycHelperGrace", {
            ns: "createPaymentLinkScreen",
            days: kyc.daysRemaining,
            defaultValue: "{{days}} days left to verify. Takes ~5 minutes.",
          });
  const steps: Step[] = [
    {
      key: "company",
      label: tCreatePaymentLink("setupStepCompanyLabel"),
      helper: tCreatePaymentLink("setupStepCompanyHelper"),
      icon: BusinessRounded,
      done: hasCompany,
      onClick: () => setCompanyModalOpen(true),
    },
    {
      key: "wallet",
      label: tCreatePaymentLink("setupStepWalletLabel"),
      helper: tCreatePaymentLink("setupStepWalletHelper"),
      icon: AccountBalanceWalletRounded,
      done: hasWallet,
      onClick: () => setWalletModalOpen(true),
    },
    ...(kyc.required
      ? [
          {
            key: "kyc" as const,
            label: tCreatePaymentLink("setupStepKycLabel", "Verify your identity"),
            helper: kycHelper,
            icon: VerifiedUserRounded,
            done: false,
            busy: kyc.starting,
            onClick: () => {
              void kyc.startVerification();
            },
          },
        ]
      : []),
  ];
  const kycOnlyGate = hasCompany && hasWallet && kycBlocked;

  const handleCompanySuccess = () => {
    setCompanyModalOpen(false);
    // re-fetch — onSuccess from modal already commits the new company to Redux,
    // but trigger a fetch anyway to be safe.
    companyState.refetchCompanies();
  };

  const handleWalletAdded = () => {
    setWalletModalOpen(false);
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    walletState.refetchWallets();
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {setupComplete ? (
        <Box sx={{ mt: isMobile ? "4px" : "0px" }}>
          <OnboardingBanner vertical="fundraisers" />
          {kyc.required && <KycGraceBanner />}
          <CreatePaymentLinkPage
            paymentLinkData={{}}
            disabled={false}
            setPageName={setPageName}
          />
        </Box>
      ) : companyFetched && companyFetchError && !hasCompany ? (
        /* F4: API failed while fetching companies. Show a retry banner
           instead of the misleading "Create Your Company" onboarding gate
           (which suggested the merchant's account was wiped). */
        <Box
          data-testid="payment-link-fetch-error"
          sx={{
            maxWidth: "600px",
            mx: "auto",
            mt: isMobile ? 4 : 8,
            px: 3,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "16px",
              backgroundColor: theme.palette.error.main + "22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2.5,
            }}
          >
            <BusinessRounded sx={{ fontSize: 32, color: theme.palette.error.main }} />
          </Box>
          <Typography
            sx={{
              fontSize: isMobile ? "18px" : "22px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            Couldn&apos;t load your account
          </Typography>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              mb: 3,
              lineHeight: 1.5,
            }}
          >
            The request to load your companies didn&apos;t come back. Your data is safe — this is a
            temporary issue with the connection. Try again in a moment.
          </Typography>
          <Box
            component="button"
            onClick={() => companyState.refetchCompanies()}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 14,
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }}
          >
            Retry
          </Box>
        </Box>
      ) : dataStillLoading ? (
        /* S50 UX-fix: hostbay + other data-rich merchants land on this page
           and briefly saw the "Add a Payout Wallet" setup guard for ~1-3s
           while the wallet API call was still in-flight. Show a soft loading
           state instead so the guard doesn't flash misleadingly. Once
           company + wallet fetches settle (either success OR error), we fall
           through to the setup-guard / retry-banner / form branches. */
        <Box
          data-testid="payment-link-setup-loading"
          sx={{
            maxWidth: "600px",
            mx: "auto",
            mt: isMobile ? 4 : 8,
            px: 3,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `3px solid ${theme.palette.border.main}`,
              borderTopColor: theme.palette.primary.main,
              animation: "cpl-spin 0.8s linear infinite",
              "@keyframes cpl-spin": {
                to: { transform: "rotate(360deg)" },
              },
            }}
          />
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "14px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              color: theme.palette.text.secondary,
            }}
          >
            {tCreatePaymentLink("loadingAccount", "Loading your account...")}
          </Typography>
        </Box>
      ) : (
        <Box
          data-testid="payment-link-setup-guard"
          data-gate={openGate || ""}
          sx={{
            maxWidth: "600px",
            mx: "auto",
            mt: isMobile ? 4 : 8,
            px: 3,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "16px",
              backgroundColor: theme.palette.primary.light,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2.5,
            }}
          >
            {kycOnlyGate ? (
              <VerifiedUserRounded sx={{ fontSize: 32, color: brandFg(theme.palette.mode === "dark") }} />
            ) : (
              <BusinessRounded sx={{ fontSize: 32, color: brandFg(theme.palette.mode === "dark") }} />
            )}
          </Box>
          <Typography
            data-testid="setup-required-title"
            sx={{
              fontSize: isMobile ? "18px" : "22px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            {kycOnlyGate
              ? tCreatePaymentLink("setupKycTitle", "Verify your identity to keep getting paid")
              : tCreatePaymentLink("setupTitle")}
          </Typography>
          <Typography
            data-testid="setup-required-subtitle"
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              mb: 3,
              lineHeight: 1.5,
            }}
          >
            {kycOnlyGate
              ? tCreatePaymentLink(
                  "setupKycSubtitle",
                  "You've passed $10,000 in payment volume and the 90-day grace period has ended. Complete a quick identity check to create new payment links.",
                )
              : tCreatePaymentLink("setupSubtitle")}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {steps.map((step) => {
              const Icon = step.done ? CheckCircleRounded : step.icon;
              const interactive = !step.done && !step.busy;
              return (
                <Box
                  key={step.key}
                  data-testid={`setup-guard-step-${step.key}`}
                  onClick={interactive ? step.onClick : undefined}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: isMobile ? "12px 16px" : "14px 20px",
                    borderRadius: "12px",
                    border: `1px solid ${step.done ? theme.palette.success.main : theme.palette.border.main}`,
                    backgroundColor: step.done
                      ? (theme.palette.success as any).light || theme.palette.background.paper
                      : theme.palette.background.paper,
                    cursor: interactive ? "pointer" : "default",
                    opacity: step.busy ? 0.7 : 1,
                    transition: "all 0.15s ease",
                    "&:hover": interactive
                      ? {
                          borderColor: theme.palette.primary.main,
                          backgroundColor: theme.palette.primary.light,
                        }
                      : {},
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "10px",
                      backgroundColor: step.done
                        ? (theme.palette.success as any).light || theme.palette.primary.light
                        : theme.palette.primary.light,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      sx={{
                        fontSize: 20,
                        color: step.done ? theme.palette.success.main : brandFg(theme.palette.mode === "dark"),
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: isMobile ? "14px" : "15px",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {step.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: isMobile ? "11px" : "12px",
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                        mt: 0.25,
                      }}
                    >
                      {step.done ? tCreatePaymentLink("setupDone") : step.helper}
                    </Typography>
                  </Box>
                  {!step.done && (
                    <ArrowForwardRounded
                      sx={{ fontSize: 20, color: brandFg(theme.palette.mode === "dark"), flexShrink: 0 }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Inline modals — keep the user on /create-pay-link instead of forcing navigation */}
      <CreateCompanyModal
        open={companyModalOpen}
        onSuccess={handleCompanySuccess}
        onClose={() => setCompanyModalOpen(false)}
        showStepIndicator={false}
        title={t("companyDialog:createModal.title")}
        subtitle={t("companyDialog:createModal.payLinkSubtitle")}
        closeLabel={t("companyDialog:createModal.cancel")}
      />
      {walletModalOpen && (
        <AddWalletModal
          open
          onClose={() => setWalletModalOpen(false)}
          onWalletAdded={handleWalletAdded}
        />
      )}
    </>
  );
};

export default CreatePaymentLink;
