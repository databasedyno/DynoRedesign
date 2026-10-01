import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { lazyLoading } from "@/Components/UI/DynamicFallback";
import { Box, Typography, Skeleton, useTheme } from "@mui/material";
import { Icon as Iconify } from "@iconify/react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation, Trans } from "react-i18next";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { Icon } from "@/styles/uiKit";
import OverflowTabs from "@/Components/UI/OverflowTabs";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { pageProps, rootReducer } from "@/utils/types";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

const tabFallback = <Skeleton variant="rounded" height={420} sx={{ borderRadius: "16px" }} />;
const tabLoading = lazyLoading(tabFallback, { minHeight: 420 });

const PageTab = dynamic(() => import("@/Components/Page/Storefront/PageTab"), {
  ssr: false,
  loading: tabLoading,
});
const ProductsTab = dynamic(() => import("@/Components/Page/Storefront/ProductsTab"), {
  ssr: false,
  loading: tabLoading,
});
const ShareTab = dynamic(() => import("@/Components/Page/Storefront/ShareTab"), {
  ssr: false,
  loading: tabLoading,
});
const StorefrontComparePanel = dynamic(
  () => import("@/Components/Page/Storefront/StorefrontComparePanel"),
  { ssr: false, loading: lazyLoading(null, { silent: true }) },
);

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
 * NOTE: effects that call setPageAction (state in _app) must keep PRIMITIVE deps —
 * depending on MUI's `theme` there once created a render loop that blocked Next
 * from committing the next route (transition loader stuck).
 */

type TabId = "page" | "products" | "share";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "page", label: "Page", icon: "layout-dashboard" },
  { id: "products", label: "Products", icon: "package" },
  { id: "share", label: "Share", icon: "share-2" },
];

const Storefront = ({ setPageName, setPageDescription, setPageAction, setPageHeaderSx }: pageProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");

  // Phones: stack the (long) subtitle above the "View my page" action instead
  // of squeezing them side by side. PRIMITIVE DEPS ONLY (see wallet.tsx note).
  useEffect(() => {
    if (!setPageHeaderSx) return;
    setPageHeaderSx({
      "@media (max-width:599.95px)": { flexDirection: "column", alignItems: "stretch", gap: 1 },
      "& .pageAction": { "@media (max-width:599.95px)": { justifyContent: "flex-start" } },
    });
    return () => setPageHeaderSx(null);
  }, [setPageHeaderSx]);
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const { companyList, selectedCompanyId } = useCompanyStore();
  const selectedCompany = companyList.find(
    (c: any) => Number(c.company_id) === Number(selectedCompanyId),
  );
  const selectedCompanyName =
    (selectedCompany?.company_name as string) || (selectedCompany?.name as string) || "";
  const showCompanyHint = companyList.length > 1 && Boolean(selectedCompanyName);

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
    setPageName?.(t("storefront.title", { defaultValue: "Storefront" }));
    setPageDescription?.(
      t("storefront.subtitle", {
        defaultValue:
          "Your Dynopay page — tips, products and payment links behind one link.",
      }),
    );
    return () => {
      setPageName?.("");
      setPageDescription?.("");
    };
  }, [setPageName, setPageDescription, t]);

  // Wave 3b: the ONE primary action ("Edit page") lives in the Page header card;
  // "View my page" sits in its publish row — so no layout header action here.
  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(null);
    return () => setPageAction(null);
  }, [setPageAction]);

  const go = (id: TabId) => {
    setActive(id);
    router.replace(
      { pathname: "/storefront", query: id === "page" ? {} : { tab: id } },
      undefined,
      { shallow: true },
    );
  };

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  // OverflowTabs items — translated labels + icon nodes.
  const tabItems = useMemo(
    () =>
      TABS.map((tb) => ({
        id: tb.id,
        label: t(`storefront.tab${tb.id.charAt(0).toUpperCase()}${tb.id.slice(1)}`, {
          defaultValue: tb.label,
        }),
        icon: <Icon name={tb.icon} size={15} />,
      })),
    [t],
  );

  return (
    <>
      <Head>
        <title>{`${t("storefront.title", { defaultValue: "Storefront" })} · Dynopay`}</title>
      </Head>

      <Box
        sx={{ px: { xs: 2, md: 0 }, pt: { xs: 1, md: 0 }, pb: { xs: 12, md: 4 }, width: "100%" }}
        data-testid="storefront-page"
      >
        {/* Storefront-per-company hint: which company's storefront am I editing? */}
        {showCompanyHint && (
          <Box
            data-testid="storefront-company-hint"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              mb: 2,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
              backgroundColor: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
              maxWidth: "100%",
            }}
          >
            <Iconify icon="mdi:storefront-outline" width={15} color={indigo} />
            <Typography
              sx={{
                fontSize: 12.5,
                fontWeight: 600,
                color: theme.palette.text.secondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <Trans
                i18nKey="storefront.editingHint"
                ns="common"
                values={{ company: selectedCompanyName }}
                defaults="Editing <b>{{company}}</b>'s storefront"
                components={{
                  b: (
                    <Box
                      component="span"
                      sx={{ color: theme.palette.text.primary, fontWeight: 700 }}
                    />
                  ),
                }}
              />
            </Typography>
          </Box>
        )}

        {/* Segmented tabs → OverflowTabs: collapses tabs that don't fit into a
            searchable "N more tabs…" pill on ANY viewport (desktop / tablet / phone). */}
        <Box sx={{ mb: 3, maxWidth: "100%" }}>
          <OverflowTabs
            items={tabItems}
            value={active}
            onChange={(id) => go(id as TabId)}
            ariaLabel={t("storefront.tabsAria", { defaultValue: "Storefront sections" })}
            containerTestId="storefront-tabs"
            itemTestIdPrefix="storefront-tab"
          />
        </Box>

        {active === "page" && <PageTab />}
        {active === "products" && <ProductsTab />}
        {active === "share" && <ShareTab />}

        {/* Analytics Split — per-company views/tips/sales (multi-company only) */}
        <StorefrontComparePanel />
      </Box>
    </>
  );
};

export default Storefront;
