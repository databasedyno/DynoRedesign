import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Box, Skeleton, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { pageProps, rootReducer } from "@/utils/types";
import { buildCreatorUrl } from "@/helpers/creatorUrl";

const tabFallback = <Skeleton variant="rounded" height={420} sx={{ borderRadius: "16px" }} />;

const PageTab = dynamic(() => import("@/Components/Page/Storefront/PageTab"), {
  ssr: false,
  loading: () => tabFallback,
});
const ProductsTab = dynamic(() => import("@/Components/Page/Storefront/ProductsTab"), {
  ssr: false,
  loading: () => tabFallback,
});
const ShareTab = dynamic(() => import("@/Components/Page/Storefront/ShareTab"), {
  ssr: false,
  loading: () => tabFallback,
});

/**
 * Storefront — one place for everything a merchant sells behind ONE link.
 *
 * Folds the old /creator page (page look, bio, tips) and /pay-links/products
 * (catalog) into three tabs and adds Share, so the merchant configures and
 * shares a single public page instead of hopping between screens with separate
 * public URLs. Both old routes now redirect here.
 *
 * Tabs are code-split: the products list and the QR canvas never load for
 * someone who only came to tweak their bio.
 *
 * NOTE (2026-06): the header action is rendered by <OpenPageAction/> rather than
 * built inline in the effect. Depending on MUI's `theme` inside an effect that
 * calls setPageAction (state in _app) created a render loop, and a page stuck
 * re-rendering never lets Next commit the next route — the global transition
 * loader then hung over the new page. Keep effect deps primitive here.
 */

type TabId = "page" | "products" | "share";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "page", label: "Page", icon: "layout-dashboard" },
  { id: "products", label: "Products", icon: "package" },
  { id: "share", label: "Share", icon: "share-2" },
];

/**
 * Header action. Kept as its own component so the effect that registers it with
 * the layout does NOT have to depend on the MUI `theme` object — depending on
 * theme made the effect re-run on every render, and since it also calls
 * setPageAction (state in _app) that became a render loop which blocked Next
 * from ever committing the next route (the transition loader stuck on screen).
 */
const OpenPageAction: React.FC<{ handle: string }> = ({ handle }) => {
  const theme = useTheme();
  const open = () => window.open(buildCreatorUrl(handle), "_blank");
  return (
    <Box
      role="button"
      tabIndex={0}
      data-testid="storefront-open-page"
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 2,
        height: 40,
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.border.main}`,
        "&:hover": { backgroundColor: theme.palette.action.hover },
      }}
    >
      <Icon name="external-link" size={15} />
      View my page
    </Box>
  );
};

const Storefront = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const handle = profile?.handle as string | undefined;

  // The Products and Share tabs don't render the settings form that normally
  // pulls the profile into Redux, so landing directly on them would leave the
  // handle unknown (Share would claim there is no link).
  useEffect(() => {
    if (!profile?.user_id) dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, profile?.user_id]);

  // Tab lives in local state (URL is the source of truth on load / back-forward)
  // so switching is instant and never depends on a shallow-route re-render.
  const initialTab = useMemo(() => {
    const raw = String(router.query.tab || "page").toLowerCase();
    return (TABS.some((t) => t.id === raw) ? raw : "page") as TabId;
  }, [router.query.tab]);
  const [active, setActive] = useState<TabId>(initialTab);
  useEffect(() => setActive(initialTab), [initialTab]);

  useEffect(() => {
    setPageName?.("Storefront");
    setPageDescription?.(
      "Your Dynopay page — tips, products and payment links behind one link.",
    );
    return () => {
      setPageName?.("");
      setPageDescription?.("");
    };
  }, [setPageName, setPageDescription]);

  // Header action: jump straight to the live page once a handle exists.
  useEffect(() => {
    if (!setPageAction) return;
    if (!handle) {
      setPageAction(null);
      return;
    }
    setPageAction(<OpenPageAction handle={handle} />);
    return () => setPageAction(null);
  }, [setPageAction, handle]);

  const go = (id: TabId) => {
    setActive(id);
    router.replace(
      { pathname: "/storefront", query: id === "page" ? {} : { tab: id } },
      undefined,
      { shallow: true },
    );
  };

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  return (
    <>
      <Head>
        <title>Storefront · Dynopay</title>
      </Head>

      <Box
        sx={{ px: { xs: 2, md: 0 }, pt: { xs: 1, md: 0 }, pb: { xs: 12, md: 4 }, width: "100%" }}
        data-testid="storefront-page"
      >
        {/* Segmented tabs */}
        <Box
          sx={{
            display: "inline-flex",
            gap: 0.5,
            p: 0.5,
            mb: 3,
            borderRadius: 999,
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
            backgroundColor: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <Box
                key={tab.id}
                role="button"
                tabIndex={0}
                data-testid={`storefront-tab-${tab.id}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => go(tab.id)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    go(tab.id);
                  }
                }}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: { xs: 1.75, sm: 2.25 },
                  height: 38,
                  borderRadius: 999,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  fontWeight: 700,
                  transition: "background-color 160ms ease, color 160ms ease",
                  color: isActive
                    ? "#fff"
                    : isDark
                      ? CB_TOKENS.ink.secondaryDark
                      : CB_TOKENS.ink.secondaryLight,
                  backgroundColor: isActive ? indigo : "transparent",
                  "&:hover": {
                    backgroundColor: isActive
                      ? indigo
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(10,10,15,0.04)",
                  },
                }}
              >
                <Icon name={tab.icon} size={15} />
                {tab.label}
              </Box>
            );
          })}
        </Box>

        {active === "page" && <PageTab />}
        {active === "products" && <ProductsTab />}
        {active === "share" && <ShareTab />}
      </Box>
    </>
  );
};

export default Storefront;
