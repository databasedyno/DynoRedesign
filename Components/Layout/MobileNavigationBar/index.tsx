import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import useAccountProfile from "@/hooks/useAccountProfile";
import AddIcon from "@mui/icons-material/Add";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ErrorIcon from "@mui/icons-material/Error";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import LanguageIcon from "@mui/icons-material/Language";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
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
import useProfile from "@/hooks/useProfile";
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
import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import { API_ENDPOINTS } from "@/api/endpoints";

const MobileNavigationBar = () => {
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const [isExpanded, setIsExpanded] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const navBarRef = useRef<HTMLDivElement>(null);
  const [kycRequired, setKycRequired] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const { walletWarning } = useWalletData();
  const unreadNotifications = useUnreadNotificationsCount();
  const {
    hasAccount,
    profileComplete,
    isIndividual,
    reveal,
    fetched: accountFetched,
  } = useAccountProfile();
  const showSetupWarning = accountFetched && (!hasAccount || !profileComplete);
  const setupHref = hasAccount ? "/settings?section=company" : "/create-pay-link";
  const setupWarningText = !hasAccount
    ? t("companySetupWarning")
    : isIndividual
      ? t("accountSetupWarningIndividual", {
          defaultValue: "Add your country to finish setup",
        })
      : t("accountSetupWarningBusiness", {
          defaultValue: "Finish your business profile",
        });
  const showWalletWarning = walletWarning && hasAccount;

  // ── Creator-page discoverability (mobile/tablet nav parity with desktop sidebar) ──
  // Show a small "NEW" dot on the Account/More trigger when the user hasn't
  // claimed a creator page yet. Once they've enabled it + set a handle the
  // dot disappears, matching the desktop sidebar's `isNew` behavior.
  const userState: any = { profile: useProfile().profile };
  const hasClaimedCreator = Boolean(
    userState?.profile?.handle && userState?.profile?.creator_page_enabled,
  );
  const profileLoaded = Boolean(userState?.profile);
  // Only show the indicator to signed-in users whose profile has loaded and
  // who genuinely haven't claimed yet — avoids a "phantom NEW" flash on page
  // load or for logged-out state.
  const showCreatorNewDot = profileLoaded && !hasClaimedCreator;

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

  const languages = [
    { code: "en", label: "English", flag: unitedStatesFlag },
    { code: "pt", label: "Português", flag: portugalFlag },
    { code: "fr", label: "Français", flag: franceFlag },
    { code: "es", label: "Español", flag: spainFlag },
    { code: "de", label: "Deutsch", flag: germanyFlag },
    { code: "nl", label: "Nederlands", flag: netherlandsFlag },
  ];

  // ── Persona rows + reveal-on-relevance (audit F13/N1) ─────────────────────
  // Same source of truth as the desktop sidebar (useAccountProfile → useNavReveal)
  // so the two navs can never disagree about which rows exist or what they are
  // called. The bottom bar keeps 3 primary items; a creator's primary is their
  // page, a business's is the dashboard.
  const publicPageItem = {
    // Move 6: ONE consistent name for the public page everywhere — "Your page"
    // (was "Storefront" here, "Creator page" in quick-actions, "Checkout
    // page" for businesses).
    label: isIndividual
      ? t("storefront", { defaultValue: "Your page" })
      : t("checkoutPage", { defaultValue: "Your page" }),
    icon: "creator",
    path: "/storefront",
    id: "storefront",
    isNew: !hasClaimedCreator,
  };
  const dashboardItem = { label: t("dashboard"), icon: "dashboard", path: "/dashboard", id: "dash" };
  const payLinksItem = {
    label: t("payLinks"),
    icon: "payment-links",
    path: "/pay-links",
    id: "pay-links",
  };
  const transactionsItem = {
    label: t("transactions"),
    icon: "transactions",
    path: "/transactions",
    id: "transactions",
  };
  // F4: receipts, not receivables — tbl_invoice only ever holds settled money.
  const receiptsItem = {
    label: t("receiptsTax", { defaultValue: "Receipts & Tax" }),
    icon: "invoices",
    path: "/invoices",
    id: "invoices",
  };
  const customersItem = {
    label: t("customers"),
    icon: "customers",
    path: "/customers",
    id: "customers",
  };

  // Move 5 (usability restructuring): the confirmed phone tab set is
  // **Home · Payments · Wallet · More**. "Payments" is the umbrella for
  // pay-links + transactions (active for both routes); everything else lives
  // under More (which re-activates the previously unreachable expanded rows).
  const paymentsItem = {
    label: t("navPayments", { defaultValue: "Payments" }),
    icon: "payment-links",
    path: "/pay-links",
    id: "payments",
  };
  const walletItem = {
    label: t("navWallet", { defaultValue: "Wallet" }),
    icon: "wallets",
    path: "/wallet",
    id: "wallet",
  };
  const moreItem = {
    label: t("navMore", { defaultValue: "More" }),
    icon: "more",
    path: null as string | null,
    id: "more",
  };
  const homeItem = isIndividual
    ? publicPageItem
    : { ...dashboardItem, label: t("navHome", { defaultValue: "Home" }) };
  const firstRowItems = [homeItem, paymentsItem, walletItem, moreItem];

  // Second row items (expanded) - shown when expanded
  // UX-2026-07-14: Added Creator page (Session 40+) and Products (Session 47)
  // so mobile/tablet users can reach the new revenue streams. Previously
  // these were desktop-only via the NewSidebar which only mounts at ≥lg
  // (1200px), leaving tablets + phones with no way to navigate to them.
  const secondRowItems = [
    // A creator's dashboard sits after their page; a business already has it first.
    ...(isIndividual ? [dashboardItem] : [publicPageItem]),
    payLinksItem,
    transactionsItem,
    ...(reveal.receipts ? [receiptsItem] : []),
    ...(reveal.customers ? [customersItem] : []),
  ];

  // Third row items (expanded) - additional nav items
  const thirdRowItems = [
    ...(reveal.developers
      ? [{ label: t("developers", { defaultValue: "Developers" }), icon: "api", path: "/developer-keys", id: "api" }]
      : []),
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
    {
      label: t("settings", { defaultValue: "Settings" }),
      icon: "settings",
      path: "/settings",
      id: "settings",
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

  // Prefetch every mobile-nav route on mount so taps navigate instantly.
  // router.prefetch is a no-op in dev; in PRODUCTION it warms the route's JS
  // chunk. Mobile has no hover, so the desktop sidebar's hover-prefetch never
  // fires here — without this, every tap downloads the chunk over the mobile
  // network first (the "long spinner between pages" the merchant reported).
  useEffect(() => {
    const paths = [
      "/dashboard", "/pay-links", "/transactions", "/invoices", "/customers",
      "/storefront", "/wallet", "/referrals", "/notifications", "/settings",
      "/help-support", "/create-pay-link",
    ];
    paths.forEach((p) => {
      try {
        void router.prefetch(p)?.catch?.(() => {});
      } catch {
        /* prefetch unsupported — ignore */
      }
    });
  }, []);

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
          return (
            <MoreHorizRounded
              sx={{
                fontSize: 20,
                color: active ? brandFg(isDark) : theme.palette.text.secondary,
              }}
            />
          );
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
        <NavigationBar expanded={isExpanded} data-testid="mobile-navigation-bar">
          <MainNavRow expanded={isExpanded}>
            {/* First row - 3 items (Coinbase pattern, Session 97c) */}
            <FirstRow>
              {firstRowItems.map((item) => {
                const active =
                  item.id === "payments"
                    ? isActiveRoute("/pay-links") || isActiveRoute("/transactions")
                    : item.id === "more"
                      ? isExpanded
                      : isActiveRoute(item.path);
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
                // Show a subtle NEW dot on the Account/More trigger while
                // the drawer is COLLAPSED and the user hasn't discovered the
                // new features hiding inside (creator page unclaimed).
                const showAccountNewDot =
                  item.id === "more" && !isExpanded && showCreatorNewDot;
                return (
                  <NavItem
                    key={item.id}
                    active={active}
                    onClick={() => handleNavClick(item)}
                  >
                    <IconButton
                      active={active || isCreate}
                      sx={{ position: "relative" }}
                    >
                      {useSidebarIcon ? (
                        <SidebarIcon
                          name={item.icon}
                          size={16}
                          color={
                            active ? brandFg(isDark) : theme.palette.text.secondary
                          }
                        />
                      ) : (
                        renderIcon(item.icon, active, isCreate)
                      )}
                      {showAccountNewDot && (
                        <Box
                          data-testid="mobile-nav-account-new-dot"
                          aria-label="New features available"
                          sx={{
                            position: "absolute",
                            top: -2,
                            right: -4,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: BRAND_ACCENT,
                            border: `2px solid ${theme.palette.background.default || "#FFFFFF"}`,
                            boxShadow: "0 0 6px rgba(129,140,248,0.75)",
                          }}
                        />
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
                  const iconColor = active
                    ? brandFg(isDark)
                    : theme.palette.text.secondary;

                  return (
                    <NavItem
                      key={item.id}
                      active={active}
                      onClick={() => handleNavClick(item)}
                    >
                      <IconButton
                        active={active || isCreate}
                        sx={{ position: "relative" }}
                      >
                        {useSidebarIcon ? (
                          <SidebarIcon
                            name={item.icon}
                            size={16}
                            color={iconColor}
                          />
                        ) : item.icon === "creator" ? (
                          <AutoAwesomeRounded
                            sx={{ fontSize: 18, color: iconColor }}
                          />
                        ) : item.icon === "products" ? (
                          <Inventory2Rounded
                            sx={{ fontSize: 18, color: iconColor }}
                          />
                        ) : (
                          renderIcon(item.icon, active, isCreate)
                        )}
                        {(item as any).isNew && (
                          <Box
                            data-testid={`mobile-nav-new-dot-${item.id}`}
                            aria-label="New feature"
                            sx={{
                              position: "absolute",
                              top: -2,
                              right: -4,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: BRAND_ACCENT,
                              border: `2px solid ${theme.palette.background.default || "#FFFFFF"}`,
                              boxShadow: "0 0 6px rgba(129,140,248,0.75)",
                            }}
                          />
                        )}
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
                        ) : item.icon === "settings" ? (
                          <SettingsRounded
                            sx={{
                              fontSize: 18,
                              color: active
                                ? brandFg(isDark)
                                : theme.palette.text.secondary,
                            }}
                          />
                        ) : (
                          <SidebarIcon
                            name={item.icon}
                            size={16}
                            color={
                              active ? brandFg(isDark) : theme.palette.text.secondary
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

          {showSetupWarning && (
            <ExpandedContent isExpanding={isExpanded}>
              <Link href={setupHref} onClick={() => setIsExpanded(false)}>
                <AlertBanner data-testid="mobile-account-setup-warning">
                  <ErrorIcon
                    sx={{ color: theme.palette.error.main, fontSize: "20px" }}
                  />
                  <AlertText>{setupWarningText}</AlertText>
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
            const { setAppLanguage } = await import("@/helpers/setAppLanguage");
            await setAppLanguage(code);
          }}
          onClose={() => setOpenLang(false)}
        />
      </Box>
    </NavigationBarContainer>
  );
};

export default MobileNavigationBar;
