import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import useAccountProfile from "@/hooks/useAccountProfile";
import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import LogoDark from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import CompanySelector from "@/Components/UI/CompanySelector";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import UserMenu from "@/Components/UI/UserMenu";
import NewSidebar from "@/Components/Layout/NewSidebar";
import CreateNewButton from "@/Components/Layout/NewHeader/CreateNewButton";
import GlobalSearchButton from "@/Components/Common/CommandPalette";
import NotificationsBell from "@/Components/Layout/NewHeader/NotificationsBell";
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
  // Every user is auto-provisioned an Account at signup, so "no company" is no
  // longer the gap — an INCOMPLETE account is (no country ⇒ broken invoices/VAT).
  // Blueprint §3 header slim-down: the profile-completeness prompt moved INTO the
  // avatar menu (see UserMenu), so it no longer lives as a header pill here.
  const { hasAccount } = useAccountProfile();
  // Show wallet warning only once the account exists (wallet depends on it)
  const showWalletWarning = walletWarning && hasAccount;
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
          aria-label={t("dashboardLayout:ariaOpenMenu")}
          onClick={() => setDrawerOpen(true)}
          disableRipple
          disableFocusRipple
          sx={{
            display: "inline-flex",
            "@media (min-width:768px)": { display: "none" },
            width: { xs: 40, sm: 44 },
            height: 44,
            mr: { xs: 0, sm: 0.5 },
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
            display: { xs: "none", sm: "flex", lg: "none" },
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
          {/* Audit §4.1 header: `+ New · 🔔 inbox · account switcher`.
              One create control (law 3) and the inbox's new home (F8).
              Move 4: global search (⌘K / magnifier) joins the chrome. */}
          <GlobalSearchButton />
          <CreateNewButton />
          <NotificationsBell />
          {/* Tablet theme toggle. Hidden on phones (<600px) — it is duplicated
              inside the user menu (user-menu-theme-toggle) and the header pill
              needs the width for the business name. */}
          <Box sx={{ display: { xs: "none", sm: "flex", lg: "none" } }}>
            <ThemeToggle size="small" data-testid="theme-toggle-mobile" />
          </Box>
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: "20px" }}>
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
        sx={{ display: "block", "@media (min-width:768px)": { display: "none" } }}
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
            aria-label={t("dashboardLayout:ariaCloseMenu")}
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
                {t("dashboardLayout:viewAccount")}
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
          <NewSidebar inDrawer />
        </Box>
      </Drawer>
    </HeaderContainer>
  );
};

export default NewHeader;
