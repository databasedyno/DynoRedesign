import { useCompanyStore } from "@/contexts/CompanyDataContext";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import Wallet from "@/Components/Page/Wallet";
import { SetupWarnnigContainer } from "@/Components/Page/Wallet/styled";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import { WarningIconContainer } from "@/Components/UI/AddWalletModal/styled";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { Icon } from "@/styles/uiKit";
import { pageProps, rootReducer } from "@/utils/types";
import { Box, Typography, useTheme } from "@mui/material";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Header action + page warning are rendered by their OWN components rather
 * than built inline inside the layout-registration effects. Depending on
 * MUI's `theme` (or `t`/`router`) inside an effect that calls setPageAction /
 * setPageWarning (state in _app) creates a render loop, and a page stuck
 * re-rendering never lets Next commit the next route — the global transition
 * loader then hangs over the old page ("slow spinner between pages").
 * Keep those effect deps PRIMITIVE ONLY (see /storefront postmortem).
 */
const AddWalletAction: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("walletScreen");
  return (
    <CustomButton
      label={t("addWallet", { defaultValue: "Add wallet" })}
      variant="primary"
      size="medium"
      endIcon={<Icon name="plus" size={isMobile ? 18 : 20} />}
      onClick={onClick}
      sx={{
        height: isMobile ? 34 : 40,
        px: isMobile ? 1.5 : 2.5,
        fontSize: isMobile ? 13 : 15,
        [muiTheme.breakpoints.down("sm")]: {
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }}
    />
  );
};

const WalletPageWarning: React.FC<{
  hasCompany: boolean;
  walletWarning: boolean;
}> = ({ hasCompany, walletWarning }) => {
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(["walletScreen", "common"]);
  return (
    <>
      {!hasCompany && (
        <SetupWarnnigContainer
          onClick={() => router.push("/create-pay-link")}
          sx={{ cursor: "pointer", "&:hover": { opacity: 0.85 } }}
        >
          <WarningIconContainer>
            <Icon name="building-2" size={16} />
          </WarningIconContainer>
          <Box>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: "600",
                fontSize: isMobile ? "10px" : "15px",
                lineHeight: "130%",
                letterSpacing: 0,
              }}
            >
              {t("walletCompanyFirstTitle")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: "500",
                fontSize: isMobile ? "10px" : "15px",
                lineHeight: "130%",
                letterSpacing: 0,
              }}
            >
              {t("walletCompanyFirstBody")}
            </Typography>
          </Box>
        </SetupWarnnigContainer>
      )}
      {hasCompany && walletWarning && (
        <SetupWarnnigContainer>
          <WarningIconContainer>
            <Image
              src={InfoIcon}
              alt="info icon"
              width={16}
              height={16}
              draggable={false}
              style={{ filter: "brightness(0)" }}
            />
          </WarningIconContainer>
          <Box>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: "600",
                fontSize: isMobile ? "10px" : "15px",
                lineHeight: "130%",
                letterSpacing: 0,
              }}
            >
              {t("walletSetUpWarnnigTitle")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: "500",
                fontSize: isMobile ? "10px" : "15px",
                lineHeight: "130%",
                letterSpacing: 0,
              }}
            >
              {(() => {
                const text = t("walletSetUpWarnnigSubtitle");
                const boldText = t("walletSetUpWarnnigSubtitleBold");
                const parts = text.split(boldText);
                if (parts.length === 2) {
                  return (
                    <>
                      {parts[0]}
                      <Typography
                        component="span"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: "600",
                          fontSize: isMobile ? "10px" : "15px",
                          lineHeight: "130%",
                          letterSpacing: 0,
                        }}
                      >
                        {boldText}
                      </Typography>
                      {parts[1]}
                    </>
                  );
                }
                return text;
              })()}
            </Typography>
          </Box>
        </SetupWarnnigContainer>
      )}
    </>
  );
};

const WalletPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
  setPageHeaderSx,
  setPageWarning,
}: pageProps) => {
  const router = useRouter();
  const muiTheme = useTheme();
  const namespaces = ["walletScreen", "common"];
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "walletScreen", defaultValue }),
    [t],
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [currentCryptocurrency, setCurrentCryptocurrency] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("walletAction");

    if (!stored) return;

    // Guarded parse (session 14d) — corrupt storage must never crash the page.
    try {
      const { openCreate, cryptocurrency } = JSON.parse(stored);

      if (openCreate && cryptocurrency) {
        setOpenCreate(true);
        setCurrentCryptocurrency(cryptocurrency);
      }
    } catch (_e) {
      /* ignore corrupt value — cleaned up below */
    }

    sessionStorage.removeItem("walletAction");
  }, []);

  const { walletWarning, cryptocurrencies, walletLoading } = useWalletData();
  const companyState = useCompanyStore();
  const hasCompany = (companyState.companyList ?? []).length > 0;
  // Hide "Add Wallet" when all supported crypto types already have wallets
  // Also hide during loading to prevent flash of the button
  // Also hide when no company exists (wallet requires company)
  const canAddMoreWallets = !walletLoading && cryptocurrencies.length > 0 && hasCompany;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tDashboard("walletsTitle"));
      setPageDescription(
        tDashboard(
          "walletsDescription",
          "Manage your cryptocurrency wallet addresses",
        ),
      );
    }
  }, [setPageName, setPageDescription, tDashboard]);

  useEffect(() => {
    if (setPageHeaderSx) {
      setPageHeaderSx({
        [muiTheme.breakpoints.down("sm")]: {
          flexDirection: "column",
          justifyContent: "start",
          alignItems: "start",
          gap: 0.5,
        },

        "& .pageAction": {
          [muiTheme.breakpoints.down("sm")]: {
            width: "100%",
          },
        },
      });
    }
    return () => {
      if (setPageHeaderSx) {
        setPageHeaderSx(null);
      }
    };
    // muiTheme deliberately NOT a dep — breakpoints.down("sm") is a constant
    // media-query string, and a theme-object dep re-runs this effect on every
    // render → setPageHeaderSx(state in _app) → render loop that blocks route
    // transitions (see /storefront postmortem). PRIMITIVE DEPS ONLY.
  }, [setPageHeaderSx]);

  useEffect(() => {
    if (!setPageWarning) return;
    setPageWarning(
      <WalletPageWarning hasCompany={hasCompany} walletWarning={walletWarning} />,
    );
    return () => setPageWarning(null);
  }, [setPageWarning, hasCompany, walletWarning]);

  const openCreateModal = useCallback(() => setOpenCreate(true), []);

  useEffect(() => {
    if (!setPageAction) return;
    // M1 (2026-07-05): removed the redundant "Create payment link" outlined button.
    // The Wallets page is about wallet ADDRESSES, not payment links. The global
    // bottom-nav "Create" tab (mobile) + sidebar "Payment Links" nav item (desktop)
    // already give users a fast path to create links.
    setPageAction(
      canAddMoreWallets ? <AddWalletAction onClick={openCreateModal} /> : null,
    );
    return () => setPageAction(null);
  }, [setPageAction, canAddMoreWallets, openCreateModal]);


  return (
    <>
      <Head>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box
        sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        style={{ "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}
      >
        <Wallet onAddWallet={() => setOpenCreate(true)} />
        <AddWalletModal
          open={openCreate}
          currentCryptocurrency={currentCryptocurrency}
          onClose={() => setOpenCreate(false)}
        />
      </Box>
    </>
  );
};

export default WalletPage;
