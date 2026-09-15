import CustomButton from "@/Components/UI/Buttons";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";
import useIsMobile from "@/hooks/useIsMobile";
import useEdgeFade from "@/hooks/useEdgeFade";
import { pageProps } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Box, Skeleton, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/**
 * Developers — ONE door for keys, webhooks, events and docs (IA audit Batch B / N4,
 * closes F5). Previously the same job had three doors: this page (keys + embeds),
 * Settings → API keys and Settings → Webhooks. The Settings copies are now
 * pointers to these tabs.
 *
 * Tab shell copied from /storefront: local tab state synced from ?tab=, shallow
 * replace, code-split tabs, primitive-only deps in layout-state effects (law 7).
 */

const tabFallback = <Skeleton variant="rounded" height={420} sx={{ borderRadius: "16px" }} />;

const ApiKeysPage = dynamic(() => import("@/Components/Page/API/ApiKeysPage"), {
  ssr: false,
  loading: () => tabFallback,
});
const WebhookConsoleSection = dynamic(
  () => import("@/Components/Page/API/WebhookConsoleSection"),
  { ssr: false, loading: () => tabFallback },
);
const DeveloperHealthStrip = dynamic(
  () => import("@/Components/Page/API/DeveloperHealthStrip"),
  { ssr: false },
);

type TabId = "keys" | "webhooks" | "events" | "docs";
const TAB_IDS: TabId[] = ["keys", "webhooks", "events", "docs"];

const Developers = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const namespaces = ["apiScreen", "common"];
  const isMobile = useIsMobile("md");
  const tabsFade = useEdgeFade<HTMLDivElement>();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation(namespaces);
  const tApi = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "apiScreen", defaultValue }),
    [t],
  );

  const TABS: Array<{ id: TabId; label: string; icon: string }> = useMemo(
    () => [
      { id: "keys", label: tApi("tabs.keys", "Keys"), icon: "key" },
      { id: "webhooks", label: tApi("tabs.webhooks", "Webhooks"), icon: "webhook" },
      { id: "events", label: tApi("tabs.events", "Events log"), icon: "list" },
      { id: "docs", label: tApi("tabs.docs", "Docs"), icon: "book-open" },
    ],
    [tApi],
  );

  // Tab lives in local state; the URL is the source of truth on load and
  // back/forward — the same pattern as /storefront.
  const initialTab = useMemo(() => {
    const raw = String(router.query.tab || "keys").toLowerCase();
    return (TAB_IDS.includes(raw as TabId) ? raw : "keys") as TabId;
  }, [router.query.tab]);
  const [active, setActive] = useState<TabId>(initialTab);
  useEffect(() => setActive(initialTab), [initialTab]);

  const go = (id: TabId) => {
    setActive(id);
    router.replace(
      { pathname: "/developer-keys", query: id === "keys" ? {} : { tab: id } },
      undefined,
      { shallow: true },
    );
  };

  const [openCreate, setOpenCreate] = useState(false);
  const apiState = useSelector((state: any) => state?.apiReducer);
  const apiList: any[] = Array.isArray(apiState?.apiList) ? apiState.apiList : [];
  // Per-environment slots. Auto-provisioning gives every company a test key at
  // signup and a live key on first wallet — but if the user revokes one of them,
  // they should be able to mint that environment's key back manually.
  const hasActiveProd = apiList.some(
    (k) => k?.environment === "production" && k?.status === "active",
  );
  const hasActiveDev = apiList.some(
    (k) => k?.environment === "development" && k?.status === "active",
  );
  const canCreateAnother = !hasActiveProd || !hasActiveDev;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tApi("developersTitle", "Developers"));
      setPageDescription(
        tApi(
          "developersDescription",
          "API keys, webhooks, delivery events and integration docs — in one place",
        ),
      );
    }
  }, [setPageName, setPageDescription, tApi]);

  useEffect(() => {
    if (!setPageAction) return;
    // "Create key" belongs to the Keys tab only, and only while at least one
    // environment slot (prod/dev) is empty.
    if (active !== "keys" || !canCreateAnother) {
      setPageAction(null);
    } else {
      setPageAction(
        <CustomButton
          label={isMobile ? tApi("createKeyMobile") : tApi("createNewKey")}
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
          onClick={() => setOpenCreate(true)}
          sx={{
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
          }}
        />,
      );
    }
    return () => setPageAction(null);
  }, [setPageAction, tApi, isMobile, canCreateAnother, active]);

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  return (
    <div style={{ "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
      <Head>
        <title>{t("settingsPage.developers", { ns: "common", defaultValue: "Developers" })} · Dynopay</title>
      </Head>
      <OnboardingBanner vertical="developers" />

      {/* Wave 3f — integration health: webhook success (24 h) + last failure/retry,
          API-key age with rotation reminder, quick links. */}
      <DeveloperHealthStrip onGoTab={go} />

      {/* Segmented tabs — same shell as /storefront. Edge fade = honest scroll
          affordance so the last pill (Docs) no longer hard-clips on mobile. */}
      <Box
        ref={tabsFade.ref}
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
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          maskImage: tabsFade.maskImage,
          WebkitMaskImage: tabsFade.WebkitMaskImage,
        }}
        data-testid="developers-tabs"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Box
              key={tab.id}
              role="button"
              tabIndex={0}
              data-testid={`developers-tab-${tab.id}`}
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

      {active === "keys" && (
        <ApiKeysPage view="keys" openCreate={openCreate} setOpenCreate={setOpenCreate} />
      )}
      {active === "webhooks" && <WebhookConsoleSection view="settings" />}
      {active === "events" && <WebhookConsoleSection view="events" />}
      {active === "docs" && <ApiKeysPage view="docs" />}
    </div>
  );
};

export default Developers;
