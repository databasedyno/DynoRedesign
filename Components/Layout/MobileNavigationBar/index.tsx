import AddIcon from "@mui/icons-material/Add";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import ErrorIcon from "@mui/icons-material/Error";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import LanguageIcon from "@mui/icons-material/Language";
import { Box, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import i18n from "i18next";

import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";
import Link from "next/link";

import LanguageSwitcherModal from "@/Components/UI/MobileLanguageSwitcher";
import { HeaderDivider } from "@/Components/UI/LanguageSwitcher/styled";
import axiosBaseApi from "@/axiosConfig";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  AlertBanner,
  AlertText,
  ExpandedContent,
  FirstRow,
  IconButton,
  MainNavRow,
  NavigationBar,
  NavigationBarContainer,
  NavItem,
  NavLabel,
  SecondRow,
} from "./styled";

import { useWalletData } from "@/hooks/useWalletData";
import { useUnreadNotificationsCount } from "@/hooks/useUnreadNotificationsCount";

const MobileNavigationBar = () => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const [isExpanded, setIsExpanded] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const navBarRef = useRef<HTMLDivElement>(null);
  const [kycRequired, setKycRequired] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const { walletWarning } = useWalletData();
  const unreadNotifications = useUnreadNotificationsCount();
  const companyState = useSelector((state: any) => state.companyReducer);
  const hasCompany = (companyState?.companyList ?? []).length > 0;
  const companyFetched = companyState?.fetched;
  const showCompanyWarning = companyFetched && !hasCompany;
  const showWalletWarning = walletWarning && hasCompany;

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    axiosBaseApi
      .get("/user/onboarding-status")
      .then((res: any) => {
        const data = res?.data?.data;
        if (data?.kyc_required || data?.kycRequired) {
          setKycRequired(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleKycClick = async () => {
    if (kycLoading) return;
    setKycLoading(true);
    try {
      const res = await axiosBaseApi.post("/kyc/submit");
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

  const languages = [
    { code: "en", label: "English", flag: unitedStatesFlag },
    { code: "pt", label: "Português", flag: portugalFlag },
    { code: "fr", label: "Français", flag: franceFlag },
    { code: "es", label: "Español", flag: spainFlag },
    { code: "de", label: "Deutsch", flag: germanyFlag },
    { code: "nl", label: "Nederlands", flag: netherlandsFlag },
  ];

  // First row items (5 items)
  // UX-2026-07-08: renamed "More" → "Account" so users understand what's inside
  // (settings, help, notifications, language, etc.). Fallback via defaultValue.
  const firstRowItems = [
    { label: t("dash"), icon: "dashboard", path: "/dashboard", id: "dash" },
    {
      label: t("transactions"),
      icon: "transactions",
      path: "/transactions",
      id: "transactions",
    },
    {
      label: t("create"),
      icon: "add",
      path: "/create-pay-link",
      id: "create-pay-link",
    },
    { label: t("wallets"), icon: "wallets", path: "/wallet", id: "wallets" },
    {
      label: isExpanded
        ? t("close")
        : t("account", { defaultValue: "Account" }),
      icon: isExpanded ? "close" : "more",
      path: null,
      id: "more",
    },
  ];

  // Second row items (expanded) - shown when expanded
  const secondRowItems = [
    {
      label: t("invoicesTax"),
      icon: "invoices",
      path: "/invoices",
      id: "invoices",
    },
    {
      label: t("customers"),
      icon: "customers",
      path: "/customers",
      id: "customers",
    },
    {
      label: t("payLinks"),
      icon: "payment-links",
      path: "/pay-links",
      id: "pay-links",
    },
    { label: t("api"), icon: "api", path: "/developer-keys", id: "api" },
  ];

  // Third row items (expanded) - additional nav items
  const thirdRowItems = [
    {
      label: t("referrals"),
      icon: "referrals",
      path: "/referrals",
      id: "referrals",
    },
    {
      label: t("notifications"),
      icon: "notifications",
      path: "/notifications",
      id: "notifications",
    },
    { label: t("language"), icon: "language", path: null, id: "language" },
    {
      label: t("helpSupport"),
      icon: "help",
      path: "/help-support",
      id: "help-support",
    },
  ];

  const isActiveRoute = (path: string | null) => {
    if (!path) return false;
    if (path === "/") return router.pathname === "/";
    return router.pathname.startsWith(path);
  };

  const handleNavClick = (
    item: (typeof firstRowItems)[0] | (typeof secondRowItems)[0] | (typeof thirdRowItems)[0],
  ) => {
    if (item.id === "more") {
      setIsExpanded(!isExpanded);
    } else if (item.path) {
      router.push(item.path);
      setIsExpanded(false);
    } else if (item.id === "language") {
      setOpenLang((prev) => !prev);
      // setIsExpanded(false);
    }
  };

  // Close expanded navigation when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isExpanded &&
        navBarRef.current &&
        !navBarRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  const renderIcon = (
    icon: string | any,
    active: boolean,
    isCreate = false,
  ) => {
    if (typeof icon === "string") {
      switch (icon) {
        case "add":
          return (
            <AddIcon
              sx={{
                color: isCreate
                  ? theme.palette.primary.main
                  : active
                    ? theme.palette.primary.main
                    : theme.palette.text.primary,
              }}
            />
          );
        case "more":
          return <KeyboardArrowUpIcon />;
        case "close":
          return <KeyboardArrowDownIcon />;
        case "language":
          return <LanguageIcon />;
        default:
          return null;
      }
    }
    return <Image src={icon} width={20} height={20} alt="" draggable={false} />;
  };

  return (
    <NavigationBarContainer>
      <Box position="relative" ref={navBarRef}>
        <NavigationBar expanded={isExpanded}>
          <MainNavRow expanded={isExpanded}>
            {/* First row - 5 items */}
            <FirstRow>
              {firstRowItems.map((item) => {
                const active = isActiveRoute(item.path);
                const isCreate = item.icon === "add";
                const supportedIcons = [
                  "dashboard",
                  "transactions",
                  "wallets",
                  "api",
                  "notifications",
                  "payment-links",
                  "referrals",
                  "invoices",
                  "customers",
                ];
                const useSidebarIcon = supportedIcons.includes(item.icon);
                return (
                  <NavItem
                    key={item.id}
                    active={active}
                    onClick={() => handleNavClick(item)}
                  >
                    <IconButton active={active || isCreate}>
                      {useSidebarIcon ? (
                        <SidebarIcon
                          name={item.icon}
                          size={16}
                          color={
                            active
                              ? theme.palette.primary.main
                              : theme.palette.text.primary
                          }
                        />
                      ) : (
                        renderIcon(item.icon, active, isCreate)
                      )}
                    </IconButton>
                    <NavLabel active={active}>{item.label}</NavLabel>
                  </NavItem>
                );
              })}
            </FirstRow>

            {/* Second row - expanded nav items */}
            {isExpanded && (
              <SecondRow>
                {secondRowItems.map((item) => {
                  const active = isActiveRoute(item.path);
                  const isCreate = item.id === "create";

                  return (
                    <NavItem
                      key={item.id}
                      active={active}
                      onClick={() => handleNavClick(item)}
                    >
                      <IconButton active={active || isCreate}>
                        <SidebarIcon
                          name={item.icon}
                          size={16}
                          color={
                            active
                              ? theme.palette.primary.main
                              : theme.palette.text.primary
                          }
                        />
                      </IconButton>
                      <NavLabel active={active}>{item.label}</NavLabel>
                    </NavItem>
                  );
                })}
              </SecondRow>
            )}

            {/* Third row - more nav items */}
            {isExpanded && (
              <SecondRow>
                {thirdRowItems.map((item) => {
                  const active = isActiveRoute(item.path);
                  const isCreate = item.id === "create";
                  const currentLang = i18n.language || "en";
                  const isNotif = item.id === "notifications";
                  const showBadge = isNotif && unreadNotifications > 0;

                  return (
                    <NavItem
                      key={item.id}
                      active={active}
                      onClick={() => handleNavClick(item)}
                    >
                      <IconButton active={active || isCreate} sx={{ position: "relative" }}>
                        {item.id === "language" ? (
                          <Box
                            sx={{
                              fontSize: "14px",
                              fontWeight: 600,
                              fontFamily: "var(--font-sans)",
                              color: active
                                ? theme.palette.primary.main
                                : theme.palette.text.primary,
                            }}
                          >
                            {currentLang.toUpperCase()}
                          </Box>
                        ) : item.id === "help-support" ? (
                          <HelpOutlineRounded
                            sx={{
                              fontSize: 20,
                              color: active
                                ? theme.palette.primary.main
                                : theme.palette.text.primary,
                            }}
                          />
                        ) : (
                          <SidebarIcon
                            name={item.icon}
                            size={16}
                            color={
                              active
                                ? theme.palette.primary.main
                                : theme.palette.text.primary
                            }
                          />
                        )}
                        {showBadge && (
                          <Box
                            data-testid="mobile-nav-notifications-badge"
                            aria-label={`${unreadNotifications} unread notifications`}
                            sx={{
                              position: "absolute",
                              top: -4,
                              right: -6,
                              minWidth: 16,
                              height: 16,
                              px: unreadNotifications > 9 ? 0.4 : 0,
                              borderRadius: 999,
                              backgroundColor: "#E11D48",
                              color: "#FFFFFF",
                              fontSize: 9,
                              fontFamily: "var(--font-sans), sans-serif",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `2px solid ${theme.palette.background.default || "#FFFFFF"}`,
                            }}
                          >
                            {unreadNotifications > 99 ? "99+" : unreadNotifications}
                          </Box>
                        )}
                      </IconButton>
                      <NavLabel active={active}>{item.label}</NavLabel>
                    </NavItem>
                  );
                })}
              </SecondRow>
            )}
          </MainNavRow>

          {kycRequired && (
            <ExpandedContent isExpanding={isExpanded}>
              <AlertBanner
                onClick={handleKycClick}
                sx={{ cursor: kycLoading ? "wait" : "pointer" }}
                data-testid="kyc-required-banner-mobile"
              >
                <ErrorIcon
                  sx={{ color: theme.palette.error.main, fontSize: "20px" }}
                />
                <AlertText>{t("requiredKYC")}</AlertText>

                <HeaderDivider />
                <ArrowOutwardIcon
                  sx={{ color: theme.palette.text.secondary, fontSize: "16px" }}
                />
              </AlertBanner>
            </ExpandedContent>
          )}

          {showCompanyWarning && (
            <ExpandedContent isExpanding={isExpanded}>
              <Link href="/create-pay-link" onClick={() => setIsExpanded(false)}>
                <AlertBanner>
                  <ErrorIcon
                    sx={{ color: theme.palette.error.main, fontSize: "20px" }}
                  />
                  <AlertText>{t("companySetupWarning")}</AlertText>
                </AlertBanner>
              </Link>
            </ExpandedContent>
          )}

          {showWalletWarning && (
            <ExpandedContent isExpanding={isExpanded}>
              <Link href="/wallet" onClick={() => setIsExpanded(false)}>
                <AlertBanner>
                  <ErrorIcon
                    sx={{ color: theme.palette.error.main, fontSize: "20px" }}
                  />
                  <AlertText>{t("walletSetUpWarnnigTitle")}</AlertText>
                </AlertBanner>
              </Link>
            </ExpandedContent>
          )}
        </NavigationBar>

        <LanguageSwitcherModal
          open={openLang}
          languages={languages}
          currentLanguage={i18n.language || "en"}
          onSelect={async (code: string) => {
            try {
              const { loadLanguageAsync } = await import("@/i18n");
              await loadLanguageAsync(code);
            } catch {
              /* noop — fall back to changeLanguage below */
            }
            i18n.changeLanguage(code);
            localStorage.setItem("lang", code);
            localStorage.setItem("lang_manual", "true");
          }}
          onClose={() => setOpenLang(false)}
        />
      </Box>
    </NavigationBarContainer>
  );
};

export default MobileNavigationBar;
