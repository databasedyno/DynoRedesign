import CustomButton from "@/Components/UI/Buttons";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";
import useIsMobile from "@/hooks/useIsMobile";
import OverflowTabs from "@/Components/UI/OverflowTabs";
import { pageProps } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Box, Skeleton } from "@mui/material";
import dynamic from "next/dynamic";
import { lazyLoading } from "@/Components/UI/DynamicFallback";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Icon } from "@/styles/uiKit";

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
const tabLoading = lazyLoading(tabFallback, { minHeight: 420 });

const ApiKeysPage = dynamic(() => import("@/Components/Page/API/ApiKeysPage"), {
  ssr: false,
  loading: tabLoading,
});
const WebhookConsoleSection = dynamic(
  () => import("@/Components/Page/API/WebhookConsoleSection"),
  { ssr: false, loading: tabLoading },
);
const DeveloperHealthStrip = dynamic(
  () => import("@/Components/Page/API/DeveloperHealthStrip"),
  { ssr: false, loading: lazyLoading(null, { silent: true }) },
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

  // OverflowTabs items — icon nodes built from the icon names above.
  const tabItems = useMemo(
    () => TABS.map((tb) => ({ id: tb.id, label: tb.label, icon: <Icon name={tb.icon} size={15} /> })),
    [TABS],
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

  return (
    <div style={{ "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
      <Head>
        <title>{t("settingsPage.developers", { ns: "common", defaultValue: "Developers" })} · Dynopay</title>
      </Head>
      <OnboardingBanner vertical="developers" />

      {/* Wave 3f — integration health: webhook success (24 h) + last failure/retry,
          API-key age with rotation reminder, quick links. */}
      <DeveloperHealthStrip onGoTab={go} />

      {/* Segmented tabs → OverflowTabs: collapses any tabs that don't fit into a
          searchable "N more tabs…" pill on ANY viewport (desktop / tablet / phone),
          instead of the old horizontal scroller that hid the last pill. */}
      <Box sx={{ mb: 3, maxWidth: "100%" }}>
        <OverflowTabs
          items={tabItems}
          value={active}
          onChange={(id) => go(id as TabId)}
          ariaLabel={tApi("tabs.aria", "Developer sections")}
          containerTestId="developers-tabs"
          itemTestIdPrefix="developers-tab"
        />
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
