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
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { LayoutProps, rootReducer } from "@/utils/types";
import { recordShortcutVisit } from "@/helpers/shortcutUsage";
import { Box, SxProps, Theme, useMediaQuery, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MainPageHeader,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "./styled";
import PageTip from "@/Components/UX/PageTip";
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
  // P2b responsive claim: 768–1024 is the TABLET band — the sidebar auto-shrinks
  // to a 72px icon rail here (regardless of the user's manual expand preference)
  // so tablets get real nav instead of the phone bottom-bar. ≥1024 = full sidebar,
  // <768 = mobile bottom-bar + hamburger drawer.
  const isTabletRail = useMediaQuery("(min-width:768px) and (max-width:1024px)");
  const railed = sidebarCollapsed || isTabletRail;
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
  const ToastState = useSelector((state: rootReducer) => state.toastReducer);
  const isDashboard =
    router.pathname === "/dashboard" ||
    router.pathname === "/pay-links" ||
    router.pathname === "/transactions";
  const hasPageHeader = !!(pageName || pageDescription);
  return (
    <>
      <CompanySettingsDialogProvider>
        <Box
          data-testid="app-shell"
          sx={{
            height: "100dvh",
            width: "100%",
            // Flush shell (design_guidelines 2026-06): a 64px top bar spanning
            // the full width, a 240px sidebar (72px rail) and the page on the
            // canvas — hairline borders separate the three, no floating cards.
            "--dp-sidebar-w": railed ? "72px" : "240px",
            "--dp-topbar-h": isMobile ? "56px" : "64px",
            pt: "env(safe-area-inset-top, 0px)",
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
              {/* ================= SIDEBAR ================= */}
              <Box
                component="nav"
                aria-label={t("mainNavigation", { ns: "common", defaultValue: "Main navigation" })}
                sx={{
                  width: "var(--dp-sidebar-w)",
                  height: "100%",
                  overflow: "hidden",
                  backgroundColor: theme.palette.background.paper,
                  borderRight: `1px solid ${theme.palette.border.main}`,
                  // Desktop sidebar shows at ≥768 (icon rail in 768–1024, full ≥1024).
                  display: "none",
                  "@media (min-width:768px)": { display: "block" },
                  transition: "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                  flexShrink: 0,
                }}
                data-sidebar-collapsed={railed ? "true" : "false"}
              >
                <NewSidebar forceCollapsed={isTabletRail} />
              </Box>

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
                  // Content column: 1440px max, 32px gutters on desktop, 16px on
                  // phones (dashboard-style pages own their phone gutters).
                  px: { xs: isDashboard ? 0 : 2, md: 4 },
                  // When a sticky page header is present IT carries the top
                  // padding (so its background covers the gap while scrolling
                  // and nothing bleeds through between the top bar and title).
                  pt: { xs: isDashboard || hasPageHeader ? 0 : 1.5, md: hasPageHeader ? 0 : 3 },
                  "& > *": { width: "100%", maxWidth: 1440, mx: "auto" },
                  // Mobile: clear (a) the fixed bottom nav pill (~74px tall incl.
                  // its own offset) AND (b) the "Emily" support-chat FAB above
                  // it. Note: this outer container-level padding only helps
                  // pages whose scrolling actually bubbles up to this
                  // container. Pages with an inner-bounded scroll (e.g.
                  // /transactions where TransactionsTable caps at fit-content
                  // and the cards flow inside) also need their own bottom
                  // spacer — see /app/Components/Page/Transactions/index.tsx.
                  // 180px = FAB top edge (164px) + 16px breathing.
                  // Plus safe-area inset for notched devices. Cleared at ≥768
                  // where the bottom nav is replaced by the sidebar/rail (P2b).
                  pb: "calc(180px + env(safe-area-inset-bottom, 0px))",
                  "@media (min-width:768px)": { pb: 4 },
                }}
              >
                {hasPageHeader && (
                  <MainPageHeader
                    data-testid="main-page-header"
                    sx={{
                      px: { xs: isDashboard ? 2 : 0, md: 0 },
                      pt: { xs: 1.5, md: 3 },
                      pb: 0,
                    }}
                  >
                    <PageHeader
                      sx={
                        pageHeaderSx
                          ? ([
                              { pt: 0, pb: { md: 3, xs: 2 }, mb: 0 },
                              pageHeaderSx,
                            ] as SxProps<Theme>)
                          : { pt: 0, pb: { md: 3, xs: 2 }, mb: 0 }
                      }
                    >
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: isMobile ? "6px" : "8px",
                        }}
                      >
                        {pageName && (
                          <PageHeaderTitle variant="h1">
                            {pageName}
                          </PageHeaderTitle>
                        )}
                        {pageDescription && (
                          <PageHeaderDescription variant="body1">
                            {pageDescription}
                          </PageHeaderDescription>
                        )}
                      </Box>

                      {pageAction && (
                        <Box
                          sx={{
                            flexShrink: 0,
                            pt: { xs: 1, md: 0 },
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: { xs: 1, md: 2 },
                          }}
                          className="pageAction"
                        >
                          {pageAction}
                        </Box>
                      )}
                    </PageHeader>

                    {pageWarning && (
                      <Box
                        sx={{ mb: { xs: 1, md: 2.5 }, mt: { xs: 0, md: 0 } }}
                      >
                        {pageWarning}
                      </Box>
                    )}
                  </MainPageHeader>
                )}

                {getPageTipKey(router.pathname) && (
                  <PageTip
                    tipKey={getPageTipKey(router.pathname) as string}
                  />
                )}

                {children}
              </Box>
            </Box>
          </Box>

          {/* ================= MOBILE NAV ================= */}
          <Box sx={{ display: "block", "@media (min-width:768px)": { display: "none" } }}>
            <MobileNavigationBar />
          </Box>
        </Box>
      </CompanySettingsDialogProvider>
    <Toast
      open={ToastState.open}
      message={ToastState.message}
      severity={ToastState.severity || "success"}
      loading={ToastState.loading}
      placement={ToastState.placement}
    />
    {/* Fee-free welcome (celebratory modal — shown once per user) */}
    <FeeFreeWelcomeModal />
    {/* Name gate — forces name-less accounts (social logins / legacy) to add
        their first + last name before using the app. No-ops when a name exists. */}
    <NameGate />
    </>
  );
};

export default withAuth(ClientLayout);
