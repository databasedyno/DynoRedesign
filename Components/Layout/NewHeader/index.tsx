import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import LogoDark from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import CompanySelector from "@/Components/UI/CompanySelector";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import UserMenu from "@/Components/UI/UserMenu";
import NewSidebar from "@/Components/Layout/NewSidebar";
import { useWalletData } from "@/hooks/useWalletData";
import { rootReducer } from "@/utils/types";
import { useTheme as useMuiTheme } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import MenuRounded from "@mui/icons-material/MenuRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { Box, Drawer, IconButton, Typography, useMediaQuery } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import {
  HeaderContainer,
  LogoContainer,
  MainContainer,
  RequiredKYC,
  RequiredKYCText,
  RightSection,
} from "./styled";
import { HeaderDivider } from "@/Components/UI/LanguageSwitcher/styled";
import { API_ENDPOINTS } from "@/api/endpoints";
import useTokenData from "@/hooks/useTokenData";
import { getInitials } from "@/helpers";
import { avatarGradient } from "@/helpers/avatarGradient";
import { brandFg } from "@/constants/theme";

const NewHeader = () => {
  const router = useRouter();
  const muiTheme = useMuiTheme();
  const tokenData = useTokenData();
  const drawerUserName = tokenData?.name || "";
  const drawerFirstName = drawerUserName.split(" ")[0] || "";
  const drawerLastName = drawerUserName.split(" ")[1] || "";
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const namespaces = ["dashboardLayout", "walletScreen"];
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );
  const tWallet = useCallback(
    (key: string) => t(key, { ns: "walletScreen" }),
    [t],
  );
  const { walletWarning } = useWalletData();
  const companyState = useCompanyStore();
  const hasCompany = (companyState.companyList ?? []).length > 0;
  const companyFetched = companyState.fetched;
  // Show company warning only after company data has been fetched
  const showCompanyWarning = companyFetched && !hasCompany;
  // Show wallet warning only if company exists (wallet depends on company)
  const showWalletWarning = walletWarning && hasCompany;
  const [kycRequired, setKycRequired] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  // UX-2026-08-02: Coinbase-style mobile top-left hamburger. Opens a Drawer
  // that reuses the desktop NewSidebar's full menu so mobile users can reach
  // everything (Wallets, Create Pay Link, Products, Creator, API, Referrals,
  // Notifications, Settings). The MobileNavigationBar bottom bar is now
  // trimmed to just 3 primary items (Dashboard · Pay Links · Transactions).
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  // Close the drawer whenever the route changes (user just navigated).
  useEffect(() => {
    const onRoute = () => setDrawerOpen(false);
    router.events.on("routeChangeComplete", onRoute);
    return () => router.events.off("routeChangeComplete", onRoute);
  }, [router.events]);

  const { kycRequired: onboardingKycRequired } = useOnboardingStatus();
  useEffect(() => {
    if (onboardingKycRequired) setKycRequired(true);
  }, [onboardingKycRequired]);

  const handleKycClick = async () => {
    if (kycLoading) return;
    setKycLoading(true);
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.kyc.submit);
      const url = res?.data?.data?.verification_url || res?.data?.data?.url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setKycLoading(false);
    }
  };
  return (
    <HeaderContainer>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* Mobile/tablet hamburger — top-left, opens full nav drawer (Coinbase pattern) */}
        <IconButton
          data-testid="mobile-hamburger-toggle"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          disableRipple
          disableFocusRipple
          sx={{
            display: { xs: "inline-flex", lg: "none" },
            width: 40,
            height: 40,
            mr: 0.5,
            color: muiTheme.palette.text.primary,
            backgroundColor: "transparent",
            // STICKY-HOVER FIX (matches the public header): on touch, :hover /
            // :active latch after a tap and leave a dark shade on the icon.
            // Keep it flat on touch (transparent + no ripple); show a hover
            // tint only on real hover-capable pointers (desktop mouse).
            "&:hover, &:active, &.Mui-focusVisible, &:focus": {
              backgroundColor: "transparent",
            },
            "& .MuiTouchRipple-root": { display: "none" },
            "@media (hover: hover) and (pointer: fine)": {
              "&:hover": {
                backgroundColor:
                  muiTheme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(10,10,15,0.04)",
              },
            },
          }}
        >
          <MenuRounded sx={{ fontSize: 22 }} />
        </IconButton>

        <LogoContainer>
          <Image
            onClick={() => router.push("/dashboard")}
            src={muiTheme.palette.mode === "dark" ? LogoDark : Logo}
            alt="logo"
            width={114}
            height={39}
            draggable={false}
            className="logo"
          />
        </LogoContainer>

        <Box
          onClick={() => router.push("/dashboard")}
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            cursor: "pointer",
            pl: 0.5,
          }}
        >
          {/* Mobile/tablet app-header brand: theme-aware monochrome Dynopay
              wordmark (black in light, white in dark). Replaces the old tiny
              88×96 indigo PNG that rendered at 22×24 and clashed with the
              black + lime brand. */}
          <Image
            src={muiTheme.palette.mode === "dark" ? LogoDark : Logo}
            alt="Dynopay"
            width={114}
            height={39}
            draggable={false}
            priority
            style={{ width: "auto", height: "22px" }}
          />
        </Box>
      </Box>

      <MainContainer>
        <CompanySelector />

        <RightSection>
          {/* Mobile theme toggle - visible only on mobile */}
          <Box sx={{ display: { xs: "flex", lg: "none" } }}>
            <ThemeToggle size="small" data-testid="theme-toggle-mobile" />
          </Box>
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: "20px" }}>
            <Box sx={{ order: { lg: 2, xl: 1 } }}>
              <LanguageSwitcher />
            </Box>

            <ThemeToggle size="small" data-testid="theme-toggle-desktop" />

            {kycRequired && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <RequiredKYC
                  onClick={handleKycClick}
                  sx={{ cursor: kycLoading ? "wait" : "pointer" }}
                  data-testid="kyc-required-banner"
                >
                  <InfoIcon
                    sx={{ fontSize: 20, color: muiTheme.palette.error.main }}
                  />
                  <RequiredKYCText sx={{ display: { lg: "none", xl: "block" } }}>{tDashboard("requiredKYC2")}</RequiredKYCText>
                  <RequiredKYCText sx={{ display: { lg: "block", xl: "none" } }}>{tDashboard("requiredKYC1")}</RequiredKYCText>
                  <HeaderDivider style={{ margin: "0 14px" }} />
                  <ArrowOutwardIcon
                    sx={{ color: muiTheme.palette.text.secondary, fontSize: 16 }}
                  />
                </RequiredKYC>
              </Box>
            )}

            {showCompanyWarning && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <Link href="/create-pay-link">
                  <RequiredKYC>
                    <InfoIcon
                      sx={{ fontSize: 20, color: brandFg(muiTheme.palette.mode === "dark") }}
                    />
                    <RequiredKYCText
                      sx={{
                        display: { lg: "none", xl: "block" },
                        color: brandFg(muiTheme.palette.mode === "dark"),
                      }}
                    >
                      {tDashboard("companySetupWarning")}
                    </RequiredKYCText>
                    <RequiredKYCText
                      sx={{
                        display: { lg: "block", xl: "none" },
                        color: brandFg(muiTheme.palette.mode === "dark"),
                      }}
                    >
                      {tDashboard("companySetupWarningShort")}
                    </RequiredKYCText>
                  </RequiredKYC>
                </Link>
              </Box>
            )}

            {showWalletWarning && (
              <Box sx={{ order: { lg: 1, xl: 2 } }}>
                <Link href="/wallet">
                  <RequiredKYC>
                    <InfoIcon
                      sx={{ fontSize: 20, color: brandFg(muiTheme.palette.mode === "dark") }}
                    />
                    <RequiredKYCText
                      sx={{
                        display: { lg: "none", xl: "block" },
                        color: brandFg(muiTheme.palette.mode === "dark"),
                      }}
                    >
                      {tWallet("walletSetUpWarnnigTitle")}
                    </RequiredKYCText>
                    <RequiredKYCText
                      sx={{
                        display: { lg: "block", xl: "none" },
                        color: brandFg(muiTheme.palette.mode === "dark"),
                      }}
                    >
                      {tWallet("walletWarnnigTitle")}
                    </RequiredKYCText>
                  </RequiredKYC>
                </Link>
              </Box>
            )}
          </Box>
          <UserMenu />
        </RightSection>
      </MainContainer>

      {/* Mobile/tablet nav Drawer — Coinbase pattern (top-left hamburger). */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data-testid="mobile-nav-drawer"
        ModalProps={{ keepMounted: false }}
        transitionDuration={reduceMotion ? 0 : undefined}
        PaperProps={{
          sx: {
            width: { xs: "82vw", sm: 320 },
            maxWidth: 340,
            backgroundColor: muiTheme.palette.background.default,
            borderRight: `1px solid ${
              muiTheme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(10,10,15,0.08)"
            }`,
            overflowX: "hidden",
          },
        }}
        sx={{ display: { xs: "block", lg: "none" } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${
              muiTheme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(10,10,15,0.06)"
            }`,
          }}
        >
          <Image
            src={muiTheme.palette.mode === "dark" ? LogoDark : Logo}
            alt="Dynopay"
            width={114}
            height={39}
            draggable={false}
            style={{ width: "auto", height: "26px" }}
          />
          <IconButton
            data-testid="mobile-nav-drawer-close"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            sx={{
              width: 36,
              height: 36,
              color: muiTheme.palette.text.primary,
            }}
          >
            <CloseRounded sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        {/* Gradient-avatar profile header — gives the mobile drawer identity
            (matches the top-bar avatar + the Emergent reference). */}
        {drawerUserName && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${
                muiTheme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(10,10,15,0.06)"
              }`,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: avatarGradient(drawerUserName),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 15,
                fontFamily: "var(--font-sans)",
                textTransform: "uppercase",
                flexShrink: 0,
                boxShadow:
                  muiTheme.palette.mode === "dark"
                    ? "0 2px 8px rgba(0,0,0,0.35)"
                    : "0 2px 8px rgba(10,10,15,0.18)",
              }}
            >
              {getInitials(drawerFirstName, drawerLastName)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: muiTheme.palette.text.primary,
                  fontFamily: "var(--font-sans)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {drawerUserName}
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: muiTheme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                }}
              >
                View account
              </Typography>
            </Box>
          </Box>
        )}
        {/* Reuse the desktop sidebar so nothing is lost. It already knows how
            to render active states + section groupings. */}
        <Box
          sx={{
            height: drawerUserName ? "calc(100dvh - 138px)" : "calc(100dvh - 65px)",
            overflowY: "auto",
            "& > *": { width: "100% !important" },
          }}
        >
          <NewSidebar />
        </Box>
      </Drawer>
    </HeaderContainer>
  );
};

export default NewHeader;
