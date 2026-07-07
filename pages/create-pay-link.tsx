import CreatePaymentLinkPage from "@/Components/Page/CreatePaymentLink";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { Box, Typography, useTheme } from "@mui/material";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import CreateCompanyModal from "@/Components/UI/OnboardingFlow/CreateCompanyModal";

const CreatePaymentLink = ({ setPageName, setPageDescription }: pageProps) => {
  const namespaces = ["createPaymentLinkScreen", "common"];
  const { t } = useTranslation(namespaces);
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const dispatch = useDispatch();

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const selectedCompanyId = companyState.selectedCompanyId;
  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = walletState.walletList?.length > 0;
  const setupComplete = hasCompany && hasWallet;

  // Inline modal state — keep the user on /create-pay-link
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(WalletAction(WALLET_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

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

  // Build step list — show all 2 steps, mark each done/active so user sees progress.
  type Step = {
    key: "company" | "wallet";
    label: string;
    helper: string;
    icon: typeof BusinessRounded;
    done: boolean;
    onClick: () => void;
  };
  const steps: Step[] = [
    {
      key: "company",
      label: "Create a Company",
      helper: "Used on invoices and receipts. Takes ~30 seconds.",
      icon: BusinessRounded,
      done: hasCompany,
      onClick: () => setCompanyModalOpen(true),
    },
    {
      key: "wallet",
      label: "Add a Payout Wallet",
      helper: "Where customer payments are sent. Required to receive crypto.",
      icon: AccountBalanceWalletRounded,
      done: hasWallet,
      onClick: () => setWalletModalOpen(true),
    },
  ];

  const handleCompanySuccess = () => {
    setCompanyModalOpen(false);
    // re-fetch — onSuccess from modal already commits the new company to Redux,
    // but trigger a fetch anyway to be safe.
    dispatch(CompanyAction(COMPANY_FETCH));
  };

  const handleWalletAdded = () => {
    setWalletModalOpen(false);
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(WalletAction(WALLET_FETCH, payload));
  };

  return (
    <>
      <Head>
        <meta name="description" content="Create a new payment link" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {setupComplete ? (
        <Box sx={{ mt: isMobile ? "4px" : "0px" }}>
          <CreatePaymentLinkPage paymentLinkData={{}} disabled={false} />
        </Box>
      ) : (
        <Box
          data-testid="payment-link-setup-guard"
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
            <BusinessRounded sx={{ fontSize: 32, color: theme.palette.primary.main }} />
          </Box>
          <Typography
            data-testid="setup-required-title"
            sx={{
              fontSize: isMobile ? "18px" : "22px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            A couple of quick steps first
          </Typography>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              mb: 3,
              lineHeight: 1.5,
            }}
          >
            Finish these to start accepting crypto payments — no need to leave this page.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {steps.map((step) => {
              const Icon = step.done ? CheckCircleRounded : step.icon;
              return (
                <Box
                  key={step.key}
                  data-testid={`setup-guard-step-${step.key}`}
                  onClick={step.done ? undefined : step.onClick}
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
                    cursor: step.done ? "default" : "pointer",
                    transition: "all 0.15s ease",
                    "&:hover": step.done
                      ? {}
                      : {
                          borderColor: theme.palette.primary.main,
                          backgroundColor: theme.palette.primary.light,
                        },
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
                        color: step.done ? theme.palette.success.main : theme.palette.primary.main,
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: isMobile ? "14px" : "15px",
                        fontFamily: "UrbanistSemibold",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {step.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: isMobile ? "11px" : "12px",
                        fontFamily: "UrbanistMedium",
                        color: theme.palette.text.secondary,
                        mt: 0.25,
                      }}
                    >
                      {step.done ? "Done" : step.helper}
                    </Typography>
                  </Box>
                  {!step.done && (
                    <ArrowForwardRounded
                      sx={{ fontSize: 20, color: theme.palette.primary.main, flexShrink: 0 }}
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
