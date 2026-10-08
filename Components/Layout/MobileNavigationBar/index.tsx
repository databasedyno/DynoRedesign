import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import useAccountProfile from "@/hooks/useAccountProfile";
import useOnboardingStatus from "@/hooks/useOnboardingStatus";
import { useWalletData } from "@/hooks/useWalletData";
import { useUnreadNotificationsCount } from "@/hooks/useUnreadNotificationsCount";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import CreateNewButton from "@/Components/Layout/NewHeader/CreateNewButton";
import NavIcon from "@/Components/Layout/NewSidebar/NavIcon";
import { buildNavSections, isNavPathActive } from "@/Components/Layout/NewSidebar/navSections";
import { TabBar, TabButton, TabDot } from "./styled";
import MoreSheet from "./MoreSheet";

const SELL_ROUTES = ["/pay-links", "/create-pay-link", "/storefront"];
const MONEY_ROUTES = ["/payouts", "/transactions", "/invoices", "/wallet"];

const isTypingTarget = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  if (node.isContentEditable) return true;
  if (node.tagName === "TEXTAREA" || node.tagName === "SELECT") return true;
  if (node.tagName !== "INPUT") return false;
  const type = (node as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(type);
};

/** Phone navigation (§8.1): Home · Sell · (+) · Money · More, plus the More bottom sheet. */
const MobileNavigationBar: React.FC<{ hidden?: boolean }> = ({ hidden = false }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const [moreOpen, setMoreOpen] = useState(false);
  const { isIndividual, reveal, hasAccount, profileComplete, fetched } = useAccountProfile();
  const brandCount = useCompanyStore().companyList?.length ?? 0;
  const userState = useSelector((s: any) => s.userReducer);
  const hasClaimedCreator = Boolean(userState?.profile?.handle && userState?.profile?.creator_page_enabled);
  const unread = useUnreadNotificationsCount();
  const { walletWarning } = useWalletData();
  const { kycRequired } = useOnboardingStatus();
  const alertCount = (kycRequired ? 1 : 0) + (fetched && (!hasAccount || !profileComplete) ? 1 : 0) + (walletWarning && hasAccount ? 1 : 0);

  const sections = useMemo(
    () => buildNavSections({ t, isIndividual, hasClaimedCreator, reveal, brandCount }),
    [t, isIndividual, hasClaimedCreator, reveal, brandCount],
  );

  // Hide on scroll-down and while typing; show again on scroll-up / blur.
  const [scrollHidden, setScrollHidden] = useState(false);
  const [typing, setTyping] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    lastY.current = main.scrollTop;
    const onScroll = () => {
      const y = main.scrollTop;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 6) return;
      setScrollHidden(dy > 0 && y > 56);
      lastY.current = y;
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [router.pathname]);
  useEffect(() => {
    setScrollHidden(false);
    setMoreOpen(false);
  }, [router.asPath]);
  useEffect(() => {
    const onIn = (e: FocusEvent) => setTyping(isTypingTarget(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  useEffect(() => {
    ["/dashboard", "/pay-links", "/payouts", "/transactions", "/storefront", "/settings"].forEach((p) => {
      try {
        void router.prefetch(p)?.catch?.(() => {});
      } catch {
        /* ignore */
      }
    });
  }, []);

  const active = (p: string) => isNavPathActive(router.pathname, p);
  const home = isIndividual
    ? { path: "/storefront", label: t("storefront", { defaultValue: "Your page" }), icon: "creator" }
    : { path: "/dashboard", label: t("navHome", { defaultValue: "Home" }), icon: "dashboard" };
  const tabs = [
    { id: "home", ...home, on: active(home.path) },
    { id: "sell", path: "/pay-links", label: t("sidebarSectionSell", { defaultValue: "Sell" }), icon: "payment-links", on: SELL_ROUTES.some(active) && !(isIndividual && active("/storefront")) },
    { id: "create" },
    { id: "money", path: "/payouts", label: t("sidebarSectionMoney", { defaultValue: "Money" }), icon: "balances", on: MONEY_ROUTES.some(active) },
  ] as const;
  const isHidden = hidden || typing || (scrollHidden && !moreOpen);
  const color = (on: boolean) => (on ? theme.palette.text.primary : theme.palette.text.secondary);

  return (
    <>
      <TabBar hidden$={isHidden} aria-label={t("common:mainNavigation", { defaultValue: "Main navigation" })} data-testid="mobile-navigation-bar" data-hidden={isHidden ? "true" : "false"}>
        {tabs.map((tab) =>
          tab.id === "create" ? (
            <Box key="create" data-testid="mobile-nav-create-slot" sx={{ display: "grid", placeItems: "center" }}>
              <CreateNewButton variant="tab" />
            </Box>
          ) : (
            <TabButton
              key={tab.id}
              type="button"
              active={tab.on}
              aria-current={tab.on ? "page" : undefined}
              data-testid={`mobile-nav-${tab.id}`}
              onClick={() => router.push(tab.path)}
            >
              <span className="tab-pill"><NavIcon name={tab.icon} color={color(tab.on)} size={20} /></span>
              <span>{tab.label}</span>
            </TabButton>
          ),
        )}
        <TabButton
          type="button"
          active={moreOpen}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          data-testid="mobile-nav-more"
          onClick={() => setMoreOpen(true)}
        >
          <span className="tab-pill"><MoreHorizRounded sx={{ fontSize: 22, color: color(moreOpen) }} /></span>
          <span>{t("navMore", { defaultValue: "More" })}</span>
          {(alertCount > 0 || unread > 0) && <TabDot data-testid="mobile-nav-more-dot" />}
        </TabButton>
      </TabBar>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} sections={sections} unread={unread} />
    </>
  );
};

export default MobileNavigationBar;
