import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import useAccountProfile from "@/hooks/useAccountProfile";
import { useSetupProgress } from "@/Components/Page/GetStarted/useSetupProgress";
import SaveExitDialog from "@/Components/Page/GetStarted/SaveExitDialog";
import LogoDark from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import DynopayMark from "@/assets/Icons/Logo";
import CompanySelector from "@/Components/UI/CompanySelector";
import UserMenu from "@/Components/UI/UserMenu";
import CreateNewButton from "@/Components/Layout/NewHeader/CreateNewButton";
import GlobalSearchButton from "@/Components/Common/CommandPalette";
import NotificationsBell from "@/Components/Layout/NewHeader/NotificationsBell";
import { useWalletData } from "@/hooks/useWalletData";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import useShellMode from "@/hooks/useShellMode";
import { SHELL_MQ } from "@/styles/shellTokens";
import { useTheme as useMuiTheme } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import { Box, IconButton, Tooltip } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeaderContainer, LogoContainer, MainContainer, RequiredKYC, RequiredKYCText, RightSection } from "./styled";
import { HeaderDivider } from "@/Components/UI/LanguageSwitcher/styled";
import { brandFg } from "@/constants/theme";

const NewHeader = () => {
  const router = useRouter();
  const muiTheme = useMuiTheme();
  const { t } = useTranslation(["dashboardLayout", "walletScreen", "common"]);
  const { walletWarning } = useWalletData();
  const { collapsed: sidebarCollapsed } = useSidebarCollapsed();
  const { isTablet } = useShellMode();
  // The brand cell is as wide as the EFFECTIVE sidebar (incl. the forced tablet rail).
  const railed = sidebarCollapsed || isTablet;
  const { hasAccount } = useAccountProfile();
  // Guided first-run wizard: no nudge chips / escape hatches (search, bell, + New).
  const isOnboarding = router.pathname === "/get-started";
  const setupProgress = useSetupProgress();
  const inSetup = isOnboarding || setupProgress.onboardingActive;
  const showWalletWarning = walletWarning && hasAccount && !inSetup;
  const [kycRequired, setKycRequired] = useState(false);
  const { kycRequired: onboardingKycRequired } = useOnboardingStatus();
  useEffect(() => {
    if (onboardingKycRequired) setKycRequired(true);
  }, [onboardingKycRequired]);

  const [saveExitOpen, setSaveExitOpen] = useState(false);
  const handleSaveExit = useCallback(() => setSaveExitOpen(true), []);
  const goHome = isOnboarding ? undefined : () => router.push("/dashboard");
  const helpLabel = t("common:helpChat", { defaultValue: "Help & chat" });

  return (
    <HeaderContainer>
      {isOnboarding && <SaveExitDialog open={saveExitOpen} onClose={() => setSaveExitOpen(false)} progress={setupProgress} />}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <LogoContainer data-rail={railed ? "true" : "false"} data-testid="app-brand-cell">
          <Image onClick={goHome} src={LogoDark} alt="Dynopay" width={134} height={45} draggable={false} className="logo" style={{ cursor: isOnboarding ? "default" : "pointer" }} />
          <Box className="logo-mark" onClick={goHome} data-testid="app-brand-mark">
            <DynopayMark width={32} height={32} variant="onDark" />
          </Box>
        </LogoContainer>

        {isOnboarding && (
          <Box
            component="button"
            type="button"
            data-testid="wizard-save-exit"
            onClick={handleSaveExit}
            aria-label={t("dashboardLayout:gs.saveExit", { defaultValue: "Save & exit setup" })}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              ml: { xs: 1, sm: 2 },
              height: 36,
              px: 1.5,
              borderRadius: 999,
              cursor: "pointer",
              border: `1px solid ${muiTheme.palette.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(18,18,20,0.16)"}`,
              background: "transparent",
              color: muiTheme.palette.text.secondary,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
              "&:hover": { color: muiTheme.palette.text.primary, backgroundColor: muiTheme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.04)" },
              "&:focus-visible": { outline: `2px solid ${muiTheme.palette.text.secondary}`, outlineOffset: 2 },
            }}
          >
            <CloseRounded sx={{ fontSize: 16 }} />
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {t("dashboardLayout:gs.saveExit", { defaultValue: "Save & exit setup" })}
            </Box>
            <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
              {t("dashboardLayout:gs.saveExitShort", { defaultValue: "Save & exit" })}
            </Box>
          </Box>
        )}
      </Box>

      <MainContainer data-testid="app-topbar-inner">
        {isOnboarding ? <Box sx={{ flex: 1 }} /> : <CompanySelector />}

        <RightSection>
          {!isOnboarding && <GlobalSearchButton />}
          {/* Phones: the one create control is the centred "+" in the tab bar. */}
          {!isOnboarding && (
            <Box sx={{ display: "flex", [SHELL_MQ.phone]: { display: "none" } }}>
              <CreateNewButton />
            </Box>
          )}
          {!isOnboarding && <NotificationsBell />}
          {/* Help & chat lives in the top bar on tablet/desktop (no floating button over row actions). */}
          {!isOnboarding && (
            <Tooltip title={helpLabel}>
              <IconButton
                data-testid="header-help-chat"
                aria-label={helpLabel}
                onClick={() => window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"))}
                sx={{ width: 44, height: 44, color: muiTheme.palette.text.secondary, [SHELL_MQ.phone]: { display: "none" } }}
              >
                <ChatBubbleOutlineRounded sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: "20px" }}>
            {kycRequired && !inSetup && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <RequiredKYC onClick={() => router.push("/kyc")} sx={{ cursor: "pointer" }} data-testid="kyc-required-banner">
                  <InfoIcon sx={{ fontSize: 20, color: muiTheme.palette.error.main }} />
                  <RequiredKYCText sx={{ display: { lg: "none", xl: "block" } }}>{t("dashboardLayout:requiredKYC2")}</RequiredKYCText>
                  <RequiredKYCText sx={{ display: { lg: "block", xl: "none" } }}>{t("dashboardLayout:requiredKYC1")}</RequiredKYCText>
                  <HeaderDivider style={{ margin: "0 14px" }} />
                  <ArrowOutwardIcon sx={{ color: muiTheme.palette.text.secondary, fontSize: 16 }} />
                </RequiredKYC>
              </Box>
            )}
            {showWalletWarning && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <Link href="/wallet">
                  <RequiredKYC>
                    <InfoIcon sx={{ fontSize: 20, color: brandFg(muiTheme.palette.mode === "dark") }} />
                    <RequiredKYCText sx={{ display: { lg: "none", xl: "block" }, color: brandFg(muiTheme.palette.mode === "dark") }}>
                      {t("walletScreen:walletSetUpWarnnigTitle")}
                    </RequiredKYCText>
                    <RequiredKYCText sx={{ display: { lg: "block", xl: "none" }, color: brandFg(muiTheme.palette.mode === "dark") }}>
                      {t("walletScreen:walletWarnnigTitle")}
                    </RequiredKYCText>
                  </RequiredKYC>
                </Link>
              </Box>
            )}
          </Box>
          <UserMenu onboarding={isOnboarding} />
        </RightSection>
      </MainContainer>
    </HeaderContainer>
  );
};

export default NewHeader;
