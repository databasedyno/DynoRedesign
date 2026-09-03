import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useCollapsedSections } from "@/hooks/useCollapsedSections";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { Box, Button, ClickAwayListener, Divider, Fade, IconButton, Popper, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { TransactionAction, TRANSACTION_FETCH } from "@/Redux/Actions/TransactionAction";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useAccountProfile from "@/hooks/useAccountProfile";
import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import {
  IconBox,
  Menu,
  MenuItem,
  SidebarWrapper,
} from "./styled";
import { SectionHeader } from "./SectionHeader";
import { buildNavSections, type SidebarItem } from "./navSections";

const NewSidebar = ({
  forceCollapsed = false,
  inDrawer = false,
}: {
  forceCollapsed?: boolean;
  inDrawer?: boolean;
} = {}) => {
  // "Compact" rendering (small fonts, always-full labels, no collapse toggle) is
  // driven by whether THIS instance lives inside the mobile drawer — not the raw
  // viewport — so the desktop icon-rail renders correctly across the whole
  // 768–1024 tablet band (P2b responsive claim).
  const isMobile = inDrawer;
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  // Rail = user manually collapsed OR the layout forces it in the tablet band.
  // Never a rail inside the drawer (labels must always show there).
  const isCollapsed = !inDrawer && (collapsed || forceCollapsed);
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useDispatch();
  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { isMember, can } = useCompanyStore();
  const txLoadedCompany = useSelector(
    (s: rootReducer) => s.transactionReducer?.loaded_company_id,
  );
  const txLoading = useSelector((s: rootReducer) => s.transactionReducer?.loading);
  const navPrefetchedRef = useRef<Set<string>>(new Set());

  // Nav hover-prefetch: warm the route's JS chunk for every item, and warm the
  // transactions DATA (Redux) so /transactions paints instantly on click
  // instead of showing a skeleton for the whole backend round-trip.
  const prefetchNav = useCallback(
    (item: SidebarItem) => {
      try {
        router.prefetch(item.path);
      } catch {
        /* best-effort */
      }
      if (item.path === "/transactions") {
        const alreadyHasCompany = txLoadedCompany === (selectedCompanyId ?? null);
        const key = `tx:${selectedCompanyId ?? ""}`;
        if (!alreadyHasCompany && !txLoading && !navPrefetchedRef.current.has(key)) {
          navPrefetchedRef.current.add(key);
          dispatch(
            TransactionAction(
              TRANSACTION_FETCH,
              selectedCompanyId ? { company_id: selectedCompanyId } : undefined,
            ),
          );
        }
      }
    },
    [router, dispatch, selectedCompanyId, txLoadedCompany, txLoading],
  );
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
    router.push("/storefront?tab=page");
  }, [dismissTour, router]);

  // Prefetch all menu routes for instant navigation
  useEffect(() => {
    const paths = [
      "/dashboard", "/transactions", "/invoices", "/pay-links",
      "/wallet", "/customers", "/developer-keys",
      "/create-pay-link", "/settings", "/storefront",
      "/referrals", "/notifications", "/help-support",
    ];
    paths.forEach((p) => router.prefetch(p));
  }, []);
  const { t } = useTranslation(["dashboardLayout", "common"]);

  // ── Sell / Money / Grow / Settings ──────────────────────────────────────────
  // Dashboard pinned on top; four collapsible groups below (Components/Layout/
  // NewSidebar/navSections.ts). Reveal-on-relevance rows (receipts, customers,
  // developers) still come from hooks/useNavReveal.ts. Refer & earn and Help
  // moved from the old footer cards into normal rows so the whole nav fits at
  // 768px tall without scrolling.
  const { isIndividual, reveal } = useAccountProfile();
  const sections = useMemo(
    () => buildNavSections({ t, isIndividual, hasClaimedCreator, reveal }),
    [t, isIndividual, hasClaimedCreator, reveal],
  );
  const { isSectionCollapsed, toggle: toggleSection, expand: expandSection } = useCollapsedSections();

  const isActiveRoute = useCallback((path: string) => {
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
  }, [router.pathname]);

  // The group holding the current page always stays open.
  const activeSectionKey = useMemo(
    () => sections.find((s) => s.items.some((i) => isActiveRoute(i.path)))?.key,
    [sections, isActiveRoute],
  );
  useEffect(() => {
    if (activeSectionKey) expandSection(activeSectionKey);
  }, [activeSectionKey, expandSection]);

  // Quiet Money (design_guidelines.json): nav icons are neutral when inactive
  // and indigo when active — NO per-item "rainbow" accents. Keeps the nav calm
  // and high-trust, consistent across desktop sidebar + mobile drawer/bottom bar.
  const iconColor = (isActive: boolean) =>
    isActive ? brandFg(theme.palette.mode === "dark") : theme.palette.text.secondary;

  return (
    <SidebarWrapper data-collapsed={isCollapsed ? "true" : "false"} sx={isCollapsed ? { padding: "12px 8px" } : undefined}>
      <Menu>
        {sections.map((section, sectionIdx) => {
          const hasHeader = !isCollapsed && !!section.label;
          // Folded groups only exist in the labelled (expanded / drawer) nav;
          // the icon rail always shows every row. The active group never folds.
          const folded = hasHeader && section.key !== activeSectionKey && isSectionCollapsed(section.key);
          return (
          <React.Fragment key={section.key}>
            {/* The group LABEL is the separation now. The old divider-per-section
                doubled up on it and cost ~13px each — with 4 groups that is a
                whole nav row of vertical space, and this sidebar's height is the
                scarce resource. In the COLLAPSED rail there are no labels, so
                the divider is the only grouping cue and is kept there. */}
            {!isMobile && isCollapsed && sectionIdx > 0 && (
              <Divider
                flexItem
                sx={{
                  mx: 0.5,
                  my: 0.75,
                  borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
              />
            )}
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: "2px" }}
              data-testid={`sidebar-section-${section.key}`}
              data-folded={folded ? "true" : "false"}
            >
              {hasHeader && (
                <SectionHeader
                  sectionKey={section.key}
                  label={section.label}
                  open={!folded}
                  count={section.items.length}
                  onToggle={() => toggleSection(section.key)}
                />
              )}

              {!folded && <Box id={`sidebar-section-${section.key}`} sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {section.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const denied = !!(isMember && item.permission && !can(item.permission));

                const menuItemNode = (
                  <MenuItem
                    active={isActive}
                    onMouseEnter={() => { if (!denied) prefetchNav(item); }}
                    onClick={() => {
                      if (denied) return;
                      router.push(item.path);
                    }}
                    aria-disabled={denied}
                    data-denied={denied ? "true" : "false"}
                    sx={{
                      ...(isCollapsed
                        ? {
                            justifyContent: "center",
                            padding: "10px 0",
                            gap: 0,
                          }
                        : {}),
                      ...(denied
                        ? { opacity: 0.45, cursor: "not-allowed" }
                        : {}),
                    }}
                    data-testid={`sidebar-item-${item.icon}`}
                  >
                    <IconBox active={isActive} sx={{ position: "relative" }}>
                      {item.icon === "settings" ? (
                        <SettingsRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : item.icon === "creator" ? (
                        <AutoAwesomeRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : item.icon === "help" ? (
                        <HelpOutlineRounded sx={{ fontSize: 20, color: iconColor(isActive) }} />
                      ) : (
                        <SidebarIcon
                          name={item.icon}
                          size={item.icon === "customers" ? 24 : 20}
                          color={iconColor(isActive)}
                        />
                      )}
                    </IconBox>

                    <Box
                      component="span"
                      sx={{
                        // Mobile drawer must MATCH the desktop sidebar 1:1 —
                        // same full labels, same 14px type, same left alignment.
                        // (Previously the drawer shrank to 11px AND truncated
                        // every label to its first word, e.g. "Payment Links"
                        // -> "Payment", "Payout wallets" -> "Payout".)
                        fontSize: "14px",
                        fontWeight: isActive ? 600 : 500,
                        textAlign: "left",
                        lineHeight: 1.2,
                        fontFamily: "var(--font-sans)",
                        // Ensure long labels don't push trailing badges (NEW pill,
                        // + button) out of the visible sidebar area on narrow
                        // clamp widths (265-324px).
                        minWidth: 0,
                        flex: "0 1 auto",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: isCollapsed ? "none" : undefined,
                      }}
                    >
                      {item.label}
                    </Box>
                  </MenuItem>
                );

                // A denied item always gets the "no permission" tooltip (both
                // rail + expanded); otherwise the rail keeps its label tooltip.
                const tooltipTitle = denied
                  ? t("noPermissionTooltip", {
                      defaultValue: "You don't have permission for this",
                    })
                  : isCollapsed
                    ? item.label
                    : "";

                return tooltipTitle ? (
                  <Tooltip
                    key={item.path}
                    title={tooltipTitle}
                    placement="right"
                    arrow
                    enterDelay={200}
                  >
                    {menuItemNode}
                  </Tooltip>
                ) : (
                  <React.Fragment key={item.path}>{menuItemNode}</React.Fragment>
                );
              })}
              </Box>}
            </Box>
          </React.Fragment>
          );
        })}
      </Menu>

      {/* Collapse toggle — sits at the very bottom of the sidebar. Chevron
          points inward (left) when expanded, outward (right) when collapsed.
          Desktop-only; hidden on mobile where the sidebar is a drawer. */}
      {!isMobile && (
        <Box
          sx={{
            mt: "auto",
            pt: 1,
            display: "flex",
            justifyContent: isCollapsed ? "center" : "flex-end",
            borderTop: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          <Tooltip
            title={
              isCollapsed
                ? t("sidebarExpand", { defaultValue: "Expand sidebar" })
                : t("sidebarCollapse", { defaultValue: "Collapse sidebar" })
            }
            placement="right"
            arrow
          >
            <IconButton
              onClick={toggleCollapsed}
              size="small"
              data-testid="sidebar-collapse-toggle"
              data-collapsed={isCollapsed ? "true" : "false"}
              aria-label={
                isCollapsed
                  ? t("sidebarExpand", { defaultValue: "Expand sidebar" })
                  : t("sidebarCollapse", { defaultValue: "Collapse sidebar" })
              }
              sx={{
                width: 32,
                height: 32,
                color: theme.palette.text.secondary,
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(15,15,20,0.05)",
                  color: theme.palette.text.primary,
                },
              }}
            >
              {isCollapsed ? (
                <ChevronRightRounded sx={{ fontSize: 20 }} />
              ) : (
                <ChevronLeftRounded sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}

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
                    <AutoAwesomeRounded sx={{ fontSize: 18, color: BRAND_ACCENT }} />
                    <Box sx={{ fontSize: 14, fontWeight: 800, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
                      {t("creatorTourTitle", { defaultValue: "New: your creator page" })}
                    </Box>
                  </Box>
                  <Box sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55, mb: 1.5 }}>
                    {t("creatorTourBody", { defaultValue: "Claim your handle to get a shareable link-in-bio page for tips \u2014 your public \u201cBuy me a coffee\u201d." })}
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
                      sx={{ textTransform: "none", fontWeight: 800, fontSize: 12.5, borderRadius: "8px", backgroundColor: BRAND_ACCENT, color: "#0A0A0B", "&:hover": { backgroundColor: BRAND_ACCENT, filter: "brightness(1.08)" } }}
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
