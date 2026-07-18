import MobileNavigationBar from "@/Components/Layout/MobileNavigationBar";
import NewHeader from "@/Components/Layout/NewHeader";
import NewSidebar from "@/Components/Layout/NewSidebar";
import withAuth from "@/Components/Page/Common/HOC/withAuth";
import { CompanySettingsDialogProvider } from "@/Components/UI/CompanySettingsDialog/context";
import EmailVerificationBanner from "@/Components/UI/EmailVerificationBanner";
import FeeFreeWelcomeModal from "@/Components/Modals/FeeFreeWelcomeModal";
import FeeFreeBanner from "@/Components/UI/FeeFreeBanner";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { LayoutProps, rootReducer } from "@/utils/types";
import { Box, SxProps, Theme, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { useEffect, useRef } from "react";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import {
  MainPageHeader,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "./styled";

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
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();
  const companyState = useSelector((state: rootReducer) => (state as any).companyReducer);
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
      dispatch(CompanyAction(COMPANY_FETCH));
    }
  }, [dispatch, companyState?.fetched, companyState?.loading]);

  // Session 75 fix — scroll the inner container back to top whenever the
  // route path changes. `router.asPath` covers query-string-only nav too
  // (e.g. /transactions?wallet=X from the Wallet page).
  useEffect(() => {
    const handleRouteChange = () => {
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
  return (
    <>
      <CompanySettingsDialogProvider>
        <Box
          sx={{
            height: "100dvh",
            width: "100%",
            p: {
              xs: isDashboard ? "0px" : "8px 16px 0px 16px",
              md: "16px 23px 16px 23px",
              lg: "16px 23px 16px 23px",
              xl: "16px 40px 16px 40px",
            },
            display: "flex",
            overflow: "hidden",
            flexDirection: "column",
            backgroundColor: theme.palette.secondary.main,
            gap: isMobile ? "20px" : "24px",
          }}
        >
          {/* ================= HEADER ================= */}
          <Box
            sx={{
              p: {
                xs: isDashboard ? "8px 16px 0px 16px" : "0px",
                md: "0px",
              },
            }}
          >
            <Box
              sx={{
                height: isMobile ? "40px" : "56px",
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Box sx={{ width: "100%", maxWidth: "1840px" }}>
                <NewHeader />
              </Box>
            </Box>
          </Box>

          {/* ================= EMAIL VERIFICATION BANNER ================= */}
          <EmailVerificationBanner />
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
                maxWidth: "1840px",
                display: "flex",
                gap: "24px",
                overflow: "hidden",
              }}
            >
              {/* ================= SIDEBAR ================= */}
              <Box
                sx={{
                  width: "clamp(265px, 18vw, 324px)",
                  height: "100%",
                  overflow: "hidden",
                  display: { xs: "none", lg: "block" },
                }}
              >
                <NewSidebar />
              </Box>

              {/* ================= MAIN CONTENT ================= */}
              <Box
                ref={mainScrollRef}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  // Mobile: clear (a) the fixed bottom nav pill (~74px tall incl.
                  // its own offset) AND (b) the "Emily" support-chat FAB above
                  // it. Note: this outer container-level padding only helps
                  // pages whose scrolling actually bubbles up to this
                  // container. Pages with an inner-bounded scroll (e.g.
                  // /transactions where TransactionsTable caps at fit-content
                  // and the cards flow inside) also need their own bottom
                  // spacer — see /app/Components/Page/Transactions/index.tsx.
                  // 180px = FAB top edge (164px) + 16px breathing.
                  // Plus safe-area inset for notched devices.
                  pb: { xs: "calc(180px + env(safe-area-inset-bottom, 0px))", lg: 0 },
                }}
              >
                {(pageName || pageDescription) && (
                  <MainPageHeader
                    sx={{
                      p: {
                        xs: isDashboard ? "0px 16px 0px 16px" : "0px",
                        md: "0px",
                      },
                    }}
                  >
                    <PageHeader
                      sx={
                        pageHeaderSx
                          ? ([
                              { pt: 0, pb: { lg: 2.5, md: 1.5, xs: 2 }, mb: 0 },
                              pageHeaderSx,
                            ] as SxProps<Theme>)
                          : { pt: 0, pb: { lg: 2.5, md: 1.5, xs: 2 }, mb: 0 }
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

                {children}
              </Box>
            </Box>
          </Box>

          {/* ================= MOBILE NAV ================= */}
          <Box sx={{ display: { xs: "block", lg: "none" } }}>
            <MobileNavigationBar />
          </Box>
        </Box>
      </CompanySettingsDialogProvider>
    <Toast
      open={ToastState.open}
      message={ToastState.message}
      severity={ToastState.severity || "success"}
      loading={ToastState.loading}
    />
    {/* Fee-free welcome (celebratory modal — shown once per user) */}
    <FeeFreeWelcomeModal />
    </>
  );
};

export default withAuth(ClientLayout);
