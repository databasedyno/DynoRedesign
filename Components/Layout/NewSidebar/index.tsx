import useIsMobile from "@/hooks/useIsMobile";
import { useUnreadNotificationsCount } from "@/hooks/useUnreadNotificationsCount";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { Box, Button, ClickAwayListener, Divider, Fade, Popper, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReferralAndKnowledge from "../ReferralAndKnowledge";
import {
  IconBox,
  Menu,
  MenuItem,
  QuickAddButton,
  SectionLabel,
  SidebarWrapper,
} from "./styled";

interface SidebarItem {
  label: string;
  icon: string;
  path: string;
  plus?: boolean;
  isNew?: boolean;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const NewSidebar = () => {
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const theme = useTheme();
  const unreadNotifications = useUnreadNotificationsCount();
  // Only surface the "Creator page" NEW pill for merchants who haven't
  // published yet. Once they've set a handle & enabled the page, the pill
  // disappears — feature is now theirs, no need for the marketing badge.
  const userState = useSelector((s: rootReducer) => (s as any).userReducer);
  const hasClaimedCreator = Boolean(
    userState?.profile?.handle && userState?.profile?.creator_page_enabled,
  );

  // ── First-run creator-page coach-mark (option d) ──────────────
  // Shown once (localStorage-gated), only for merchants who haven't claimed a
  // handle yet, anchored to the sidebar "New" pill. Waits until the profile is
  // loaded so it never flashes for users who already have a creator page.
  const CREATOR_TOUR_KEY = "dyno_creator_tour_seen";
  const creatorPillRef = useRef<HTMLElement | null>(null);
  const [tourAnchor, setTourAnchor] = useState<HTMLElement | null>(null);
  const [showTour, setShowTour] = useState(false);
  const profileLoaded = Boolean(userState?.profile);
  useEffect(() => {
    if (isMobile || !profileLoaded || hasClaimedCreator) return;
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(CREATOR_TOUR_KEY)) return;
    } catch {
      return;
    }
    const id = setTimeout(() => {
      if (creatorPillRef.current) {
        setTourAnchor(creatorPillRef.current);
        setShowTour(true);
      }
    }, 900);
    return () => clearTimeout(id);
  }, [isMobile, profileLoaded, hasClaimedCreator]);
  const dismissTour = useCallback(() => {
    setShowTour(false);
    try {
      window.localStorage.setItem(CREATOR_TOUR_KEY, "1");
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);
  const startCreatorSetup = useCallback(() => {
    dismissTour();
    router.push("/creator");
  }, [dismissTour, router]);

  // Prefetch all menu routes for instant navigation
  useEffect(() => {
    const paths = [
      "/dashboard", "/transactions", "/invoices", "/pay-links",
      "/wallet", "/customers", "/developer-keys", "/referrals",
      "/notifications", "/create-pay-link", "/settings", "/creator",
    ];
    paths.forEach((p) => router.prefetch(p));
  }, []);
  const { t } = useTranslation("dashboardLayout");

  const sections: SidebarSection[] = [
    {
      label: t("sidebarSectionMain"),
      items: [
        { label: t("dashboard"), icon: "dashboard", path: "/dashboard" },
        { label: t("transactions"), icon: "transactions", path: "/transactions" },
        { label: t("invoicesTax"), icon: "invoices", path: "/invoices" },
      ],
    },
    {
      label: t("sidebarSectionPayments"),
      items: [
        { label: t("payLinks"), icon: "payment-links", path: "/pay-links", plus: true },
        // Product Catalog nav item — gated by feature flag (spec §13). When
        // NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG=false, hide the entry entirely.
        ...(String(process.env.NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG ?? "true").toLowerCase() !== "false"
          ? [{ label: t("products", { defaultValue: "Products" }), icon: "invoices", path: "/pay-links/products" }]
          : []),
        { label: t("creatorPage", { defaultValue: "Creator page" }), icon: "creator", path: "/creator", isNew: !hasClaimedCreator },
        { label: t("wallets"), icon: "wallets", path: "/wallet" },
        { label: t("customers"), icon: "customers", path: "/customers" },
      ],
    },
    {
      label: t("sidebarSectionAccount"),
      items: [
        { label: t("api"), icon: "api", path: "/developer-keys" },
        { label: t("referrals"), icon: "referrals", path: "/referrals" },
        { label: t("notifications"), icon: "notifications", path: "/notifications" },
        { label: t("settings"), icon: "settings", path: "/settings" },
      ],
    },
  ];

  const isActiveRoute = (path: string) => {
    if (path === "/") return router.pathname === "/";
    // Session 47: with nested /pay-links/products, both `/pay-links` and
    // `/pay-links/products` used to highlight together via startsWith.
    // Match at path-segment boundary only so parent/child items don't both
    // light up.
    const p = router.pathname;
    if (p === path) return true;
    // Special-case /pay-links: NOT active when inside /pay-links/products
    if (path === "/pay-links" && p.startsWith("/pay-links/products")) return false;
    return p.startsWith(path + "/");
  };

  const iconColor = (isActive: boolean) =>
    isActive ? theme.palette.primary.contrastText : theme.palette.text.secondary;

  return (
    <SidebarWrapper>
      <Menu>
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={section.label}>
            {/* UX-2026-07-08: thin divider between sections to make groupings scannable */}
            {!isMobile && sectionIdx > 0 && (
              <Divider
                flexItem
                sx={{
                  mx: 1.5,
                  my: 0.75,
                  borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
              />
            )}
            <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {!isMobile && <SectionLabel>{section.label}</SectionLabel>}

              {section.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const isNotifications = item.icon === "notifications";
                const showBadge = isNotifications && unreadNotifications > 0;

                return (
                  <MenuItem
                    key={item.path}
                    active={isActive}
                    onClick={() => router.push(item.path)}
                  >
                    <IconBox active={isActive} sx={{ position: "relative" }}>
                      {item.icon === "referrals" ? (
                        <GroupAddRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : item.icon === "settings" ? (
                        <SettingsRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : item.icon === "creator" ? (
                        <AutoAwesomeRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : (
                        <SidebarIcon
                          name={item.icon}
                          size={item.icon === "customers" ? 24 : 20}
                          color={iconColor(isActive)}
                        />
                      )}
                      {/* Unread notifications badge — always attached to icon so it shows in
                          both expanded and collapsed sidebar states. */}
                      {showBadge && (
                        <Box
                          data-testid="sidebar-notifications-badge"
                          aria-label={`${unreadNotifications} unread notifications`}
                          sx={{
                            position: "absolute",
                            top: -4,
                            right: -6,
                            minWidth: 18,
                            height: 18,
                            px: unreadNotifications > 9 ? 0.5 : 0,
                            borderRadius: 999,
                            backgroundColor: "#E11D48",
                            color: "#FFFFFF",
                            fontSize: 10,
                            fontFamily: "var(--font-sans), sans-serif",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `2px solid ${theme.palette.background.default || "#FFFFFF"}`,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        >
                          {unreadNotifications > 99 ? "99+" : unreadNotifications}
                        </Box>
                      )}
                    </IconBox>

                    <Box
                      component="span"
                      sx={{
                        fontSize: isMobile ? "11px" : "14px",
                        fontWeight: isActive ? 700 : 500,
                        textAlign: "center",
                        lineHeight: 1.2,
                        fontFamily: isActive ? "var(--font-sans)" : "var(--font-sans)",
                        [theme.breakpoints.down("md")]: {
                          fontSize: "11px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                        },
                      }}
                    >
                      {isMobile ? item.label.split(" ")[0] : item.label}
                    </Box>

                    {item.isNew && !isMobile && (
                      <Box
                        component="span"
                        ref={(el: HTMLElement | null) => {
                          if (item.icon === "creator") creatorPillRef.current = el;
                        }}
                        data-testid={`sidebar-new-${item.icon}`}
                        sx={{
                          ml: 0.75,
                          px: 0.75,
                          py: 0.15,
                          borderRadius: 999,
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontFamily: "var(--font-sans)",
                          backgroundColor: "#CCFF00",
                          color: "#0A0A0B",
                          lineHeight: 1.4,
                          alignSelf: "center",
                        }}
                      >
                        {t("newBadge", { defaultValue: "New" })}
                      </Box>
                    )}

                    {item.plus && !isMobile && (
                      <Tooltip title={t("newPaymentLink")} placement="right" arrow>
                        <QuickAddButton
                          active={isActive}
                          aria-label={t("newPaymentLink")}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push("/create-pay-link");
                          }}
                        >
                          <AddIcon sx={{ fontSize: "16px", color: "inherit" }} />
                        </QuickAddButton>
                      </Tooltip>
                    )}
                  </MenuItem>
                );
              })}
            </Box>
          </React.Fragment>
        ))}
      </Menu>
      {/* Referral and Knowledge Base Section */}
      <ReferralAndKnowledge isMobile={isMobile} />

      {/* First-run creator-page coach-mark (option d) */}
      <Popper
        open={showTour && Boolean(tourAnchor)}
        anchorEl={tourAnchor}
        placement="right"
        transition
        modifiers={[{ name: "offset", options: { offset: [0, 14] } }]}
        style={{ zIndex: 1400 }}
        data-testid="creator-tour-popper"
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={220}>
            <Box>
              <ClickAwayListener onClickAway={dismissTour}>
                <Box
                  sx={{
                    width: 272,
                    p: 2,
                    borderRadius: "14px",
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                    <AutoAwesomeRounded sx={{ fontSize: 18, color: "#CCFF00" }} />
                    <Box sx={{ fontSize: 14, fontWeight: 800, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
                      {t("creatorTourTitle", { defaultValue: "New: your creator page" })}
                    </Box>
                  </Box>
                  <Box sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55, mb: 1.5 }}>
                    {t("creatorTourBody", { defaultValue: "Claim your handle to get a shareable link-in-bio page for tips & donations \u2014 your public \u201cBuy me a coffee\u201d." })}
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button
                      onClick={dismissTour}
                      size="small"
                      data-testid="creator-tour-dismiss"
                      sx={{ textTransform: "none", fontWeight: 700, fontSize: 12.5, color: theme.palette.text.secondary, minWidth: 0, px: 1 }}
                    >
                      {t("creatorTourDismiss", { defaultValue: "Maybe later" })}
                    </Button>
                    <Button
                      onClick={startCreatorSetup}
                      disableElevation
                      variant="contained"
                      size="small"
                      data-testid="creator-tour-cta"
                      sx={{ textTransform: "none", fontWeight: 800, fontSize: 12.5, borderRadius: "8px", backgroundColor: "#CCFF00", color: "#0A0A0B", "&:hover": { backgroundColor: "#CCFF00", filter: "brightness(1.05)" } }}
                    >
                      {t("creatorTourCta", { defaultValue: "Set it up" })}
                    </Button>
                  </Box>
                </Box>
              </ClickAwayListener>
            </Box>
          </Fade>
        )}
      </Popper>
    </SidebarWrapper>
  );
};

export default NewSidebar;
