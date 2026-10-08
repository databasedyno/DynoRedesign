import { useCompanyStore } from "@/contexts/CompanyDataContext";
import MobileNavigationBar from "@/Components/Layout/MobileNavigationBar";
import NewHeader from "@/Components/Layout/NewHeader";
import NewSidebar from "@/Components/Layout/NewSidebar";
import withAuth from "@/Components/Page/Common/HOC/withAuth";
import { CompanySettingsDialogProvider } from "@/Components/UI/CompanySettingsDialog/context";
import EmailVerificationBanner from "@/Components/UI/EmailVerificationBanner";
import MfaGate from "@/Components/UI/MfaGate";
import FeeFreeWelcomeModal from "@/Components/Modals/FeeFreeWelcomeModal";
import NameGate from "@/Components/UI/NameGate";
import FeeFreeBanner from "@/Components/UI/FeeFreeBanner";
import InstallAppPrompt from "@/Components/UI/InstallAppPrompt";
import ToastHost from "@/Components/UI/Toast/ToastHost";
import useIsMobile from "@/hooks/useIsMobile";
import useShellMode from "@/hooks/useShellMode";
import { hasOpenOverlay } from "@/hooks/useBackToClose";
import { SHELL_MQ, SHELL_SIZE } from "@/styles/shellTokens";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { LayoutProps } from "@/utils/types";
import { recordShortcutVisit } from "@/helpers/shortcutUsage";
import { Box, SxProps, Theme, ThemeProvider, useTheme } from "@mui/material";
import { sidebarTheme } from "@/styles/appTheme";
import { DARK } from "@/constants/theme";
import { useRouter } from "next/router";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MainPageHeader,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "./styled";
import PageTip, { PageInfoButton } from "@/Components/UX/PageTip";
import CompactTitleBar from "./CompactTitleBar";
import { getPageTipKey } from "@/Components/UX/pageTips";

const ClientLayout = ({
  children,
  pageName,
  pageDescription,
  pageWarning,
  pageAction,
  pageHeaderSx,
}: LayoutProps) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isMobile = useIsMobile("md");
  const { collapsed: sidebarCollapsed } = useSidebarCollapsed();
  // One frame per shell mode (styles/shellTokens.ts): phone < 600 = tab bar +
  // More sheet; tablet 600–1023 = rail (labelled on touch); ≥ 1024 = sidebar.
  const shell = useShellMode();
  const isTabletRail = shell.isTablet;
  const sidebarWidth = shell.isPhone
    ? 0
    : shell.labelledRail
      ? SHELL_SIZE.labelledRail
      : sidebarCollapsed || isTabletRail
        ? SHELL_SIZE.rail
        : SHELL_SIZE.sidebar;
  const companyState = useCompanyStore();
  const hasFetchedRef = useRef(false);
  // Session 75 fix — inner scrollable container. The main-content Box below
  // owns its own vertical scroll (`overflowY: "auto"`) instead of letting the
  // window scroll, so Next.js's default scroll restoration (which only touches
  // `window`) never resets it. Result: navigating from e.g. a scrolled-down
  // /transactions or /pay-links (mobile listing) into /create-pay-link opened
  // the target page halfway/near the bottom instead of at the top. We reset
  // this container's scrollTop on every route change so every in-app page
  // opens at the top on both mobile and desktop.
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch companies ONCE at the layout level — all in-app pages benefit
  useEffect(() => {
    if (!hasFetchedRef.current && !companyState?.fetched && !companyState?.loading) {
      hasFetchedRef.current = true;
      companyState.refetchCompanies();
    }
  }, [companyState?.fetched, companyState?.loading]);

  // Back gesture closes an open sheet / drawer / dialog instead of leaving the
  // page (useBackToClose): the router ignores pops while an overlay is open.
  useEffect(() => {
    router.beforePopState(() => !hasOpenOverlay());
    return () => router.beforePopState(() => true);
  }, [router]);

  // Session 75 fix — scroll the inner container back to top whenever the
  // route path changes. `router.asPath` covers query-string-only nav too
  // (e.g. /transactions?wallet=X from the Wallet page).
  useEffect(() => {
    const handleRouteChange = () => {
      // Count which in-app destinations this merchant actually uses so the
      // dashboard can suggest their 4 most-visited as Quick Actions. Local
      // only (localStorage) — no request, no DB write.
      if (typeof window !== "undefined") {
        recordShortcutVisit(window.location.pathname);
      }
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
      // Belt & suspenders — if any page ever falls back to window scroll,
      // reset that too. `behavior: "auto"` (default) avoids a visible
      // scroll-back animation on slow devices.
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
    };
    // Fire on initial mount AND on subsequent route changes.
    handleRouteChange();
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);
  const isDashboard =
    router.pathname === "/dashboard" ||
    router.pathname === "/pay-links" ||
    router.pathname === "/transactions";
  // Focused first-run flow: the guided wizard (/get-started) hides the app's
  // navigation chrome (left sidebar, mobile bottom bar + hamburger) so clicking
  // a nav item can't yank the user out of the step-by-step setup mid-flow. The
  // top bar stays (brand + account menu) and the wizard's own "Do this later"
  // is the single, deliberate exit. Nudge chips + the fee-free banner are also
  // suppressed here (see NewHeader + FeeFreeBanner).
  const isOnboarding = router.pathname === "/get-started";
  const hasPageHeader = !!(pageName || pageDescription);
  const pageTitleRef = useRef<HTMLDivElement | null>(null);
  const tipKey = getPageTipKey(router.pathname);

  // The compact title bar is the only pinned element now: publish its height
  // so scrollIntoView()/focus() and sticky children (live previews) clear it.
  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    const h = hasPageHeader ? (isMobile ? 44 : 48) : 0;
    main.style.scrollPaddingTop = h ? `${h + 8}px` : "";
    main.style.setProperty("--page-header-h", `${h}px`);
  }, [router.pathname, hasPageHeader, isMobile]);
  return (
    <>
      <CompanySettingsDialogProvider>
        <Box
          data-testid="app-shell"
          sx={{
            width: "100%",
            // Flush shell (design_guidelines 2026-06): a 64px top bar spanning
            // the full width, a 240px sidebar (72px rail) and the page on the
            // canvas — hairline borders separate the three, no floating cards.
            "--dp-sidebar-w": `${sidebarWidth}px`,
            "--dp-topbar-h": shell.isPhone ? `${SHELL_SIZE.topbarPhone}px` : `${SHELL_SIZE.topbar}px`,
            "--dp-content-max": `${SHELL_SIZE.contentMax}px`,
            [SHELL_MQ.wide]: { "--dp-content-max": `${SHELL_SIZE.contentMaxWide}px` },
            [SHELL_MQ.ultra]: { "--dp-content-max": `${SHELL_SIZE.contentMaxUltra}px` },
            // The status-bar inset is padded once on <body> (globals.css); the
            // shell just gives it back so nothing overflows in standalone mode.
            height: "calc(100dvh - env(safe-area-inset-top, 0px))",
            display: "flex",
            overflow: "hidden",
            flexDirection: "column",
            backgroundColor: theme.palette.secondary.main,
            "--font-sans": "var(--font-inter)",
            fontFamily: "var(--font-inter)",
          }}
        >
          {/* Keyboard users: jump past header + sidebar straight to the page content. */}
          <Box
            component="a"
            href="#main-content"
            data-testid="skip-to-content"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              const main = mainScrollRef.current;
              if (!main) return;
              main.setAttribute("tabindex", "-1");
              main.focus({ preventScroll: true });
            }}
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 2000,
              px: 2,
              py: 1,
              borderRadius: "10px",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 700,
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.primary.main,
              textDecoration: "none",
              transform: "translateY(-200%)",
              transition: "transform 150ms ease-out",
              "&:focus-visible": { transform: "translateY(0)", outlineOffset: 2 },
            }}
          >
            {t("skipToContent", { ns: "common", defaultValue: "Skip to main content" })}
          </Box>
          {/* ================= HEADER ================= */}
          <Box
            component="header"
            data-testid="app-topbar"
            sx={{
              height: "var(--dp-topbar-h)",
              flexShrink: 0,
              px: { xs: 1, md: 0 },
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.border.main}`,
              display: "flex",
              alignItems: "stretch",
            }}
          >
            <NewHeader />
          </Box>

          {/* ================= EMAIL VERIFICATION BANNER ================= */}
          <EmailVerificationBanner />
          {/* ================= MANDATORY 2FA (soft banner / hard wall) ================= */}
          <MfaGate />
          {/* ================= FEE-FREE PROGRESS BANNER ================= */}
          <FeeFreeBanner />

          {/* ================= BODY ================= */}
          <Box
            sx={{
              flex: 1,
              width: "100%",
              display: "flex",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: "100%",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {/* ================= SIDEBAR (dark-brown rail in both modes) ================= */}
              {!isOnboarding && (
              <ThemeProvider theme={sidebarTheme}>
              <Box
                component="nav"
                aria-label={t("mainNavigation", { ns: "common", defaultValue: "Main navigation" })}
                sx={{
                  width: "var(--dp-sidebar-w)",
                  height: "100%",
                  overflow: "hidden",
                  backgroundColor: DARK.raised,
                  borderRight: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.18)"}`,
                  // Rail / sidebar from 600px up; phones use the tab bar.
                  display: "block",
                  [SHELL_MQ.phone]: { display: "none" },
                  transition: "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                  flexShrink: 0,
                }}
                data-sidebar-collapsed={sidebarWidth < SHELL_SIZE.sidebar ? "true" : "false"}
                data-shell-mode={shell.mode}
              >
                <NewSidebar forceCollapsed={isTabletRail} labelled={shell.labelledRail} />
              </Box>
              </ThemeProvider>
              )}

              {/* ================= MAIN CONTENT ================= */}
              <Box
                component="main"
                id="main-content"
                ref={mainScrollRef}
                sx={{
                  "&:focus": { outline: "none" },
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  // Content column: 1440px max on typical desktops, growing on
                  // ultra-wide (≥2000px) screens so pages don't leave a large
                  // blank gutter on the right (QA CC-004). 32px gutters on
                  // desktop, 16px on phones (dashboard-style pages own their
                  // phone gutters).
                  px: { xs: isDashboard ? 0 : 2, md: 4 },
                  // When a sticky page header is present IT carries the top
                  // padding (so its background covers the gap while scrolling
                  // and nothing bleeds through between the top bar and title).
                  pt: { xs: isDashboard || hasPageHeader ? 0 : 1.5, md: hasPageHeader ? 0 : 3 },
                  "& > *": {
                    width: "100%",
                    maxWidth: "var(--dp-content-max)",
                    mx: "auto",
                  },
                  // Phones: clear the 56px tab bar (+ safe area) with breathing room;
                  // pages with an inner-bounded scroll add their own spacer.
                  pb: "calc(88px + env(safe-area-inset-bottom, 0px))",
                  [SHELL_MQ.tabletUp]: { pb: 4 },
                }}
              >
                <InstallAppPrompt brand="dynopay" wrapSx={{ px: 2, pt: 1.5 }} />
                {hasPageHeader && pageName && <CompactTitleBar title={pageName} watch={pageTitleRef} root={mainScrollRef} phoneGutter={isDashboard ? 0 : 16} />}
                {hasPageHeader && (
                  <MainPageHeader
                    data-testid="main-page-header"
                    sx={{ px: { xs: isDashboard ? 2 : 0, md: 0 }, pt: { xs: 1.5, md: 3 }, pb: 0 }}
                  >
                    <PageHeader
                      sx={
                        pageHeaderSx
                          ? ([{ pt: 0, pb: { md: 3, xs: 2 }, mb: 0 }, pageHeaderSx] as SxProps<Theme>)
                          : { pt: 0, pb: { md: 3, xs: 2 }, mb: 0 }
                      }
                    >
                      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: isMobile ? "4px" : "8px" }}>
                        {pageName && (
                          <Box ref={pageTitleRef} sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                            <PageHeaderTitle variant="h1">{pageName}</PageHeaderTitle>
                            {/* ⓘ = the page's tip (all sizes) + its description (phones). */}
                            <PageInfoButton tipKey={tipKey} description={shell.isPhone ? pageDescription : undefined} />
                          </Box>
                        )}
                        {pageDescription && !shell.isPhone && (
                          <PageHeaderDescription variant="body1">{pageDescription}</PageHeaderDescription>
                        )}
                      </Box>

                      {pageAction && (
                        <Box
                          sx={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: { xs: 1, md: 2 }, [SHELL_MQ.phone]: { width: "100%", justifyContent: "flex-start" } }}
                          className="pageAction"
                        >
                          {pageAction}
                        </Box>
                      )}
                    </PageHeader>

                    {pageWarning && <Box sx={{ mb: { xs: 1, md: 2.5 } }}>{pageWarning}</Box>}
                  </MainPageHeader>
                )}

                {tipKey && <PageTip key={tipKey} tipKey={tipKey} />}

                {children}
              </Box>
            </Box>
          </Box>

          {/* ================= PHONE TAB BAR ================= */}
          {/* Always reachable on phones so the merchant can return Home / open
              More from every in-app page (incl. create/edit forms). It still
              auto-hides while typing and on scroll-down so it never covers the
              form field in use, then reappears on blur / scroll-up. */}
          {!isOnboarding && shell.isPhone && <MobileNavigationBar />}
        </Box>
      </CompanySettingsDialogProvider>
    <ToastHost />
    {/* Fee-free welcome (celebratory modal — shown once per user) */}
    <FeeFreeWelcomeModal />
    {/* Name gate — forces name-less accounts (social logins / legacy) to add
        their first + last name before using the app. No-ops when a name exists. */}
    <NameGate />
    </>
  );
};

export default withAuth(ClientLayout);
