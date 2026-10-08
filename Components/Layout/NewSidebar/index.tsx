import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useCollapsedSections } from "@/hooks/useCollapsedSections";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import { Box, Button, ClickAwayListener, Divider, Fade, Popper, Tooltip, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { TransactionAction, TRANSACTION_FETCH } from "@/Redux/Actions/TransactionAction";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useAccountProfile from "@/hooks/useAccountProfile";
import { BRAND_ACCENT } from "@/constants/theme";
import { IconBox, Menu, MenuLink, SidebarWrapper } from "./styled";
import { SectionHeader } from "./SectionHeader";
import SetupProgressItem from "./SetupProgressItem";
import { buildNavSections, isNavPathActive, type SidebarItem } from "./navSections";
import NavIcon from "./NavIcon";
import LabelledRail from "./LabelledRail";
import SidebarFooter from "./SidebarFooter";

const NewSidebar = ({
  forceCollapsed = false,
  labelled = false,
}: {
  forceCollapsed?: boolean;
  /** Touch tablets: icon + caption per group, groups open a fly-out. */
  labelled?: boolean;
} = {}) => {
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  // Rail = user manually collapsed OR the tablet band forces it.
  const isCollapsed = collapsed || forceCollapsed;
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useDispatch();
  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { isMember, can } = useCompanyStore();
  const brandCount = useCompanyStore().companyList?.length ?? 0;
  const txLoadedCompany = useSelector((s: rootReducer) => s.transactionReducer?.loaded_company_id);
  const txLoading = useSelector((s: rootReducer) => s.transactionReducer?.loading);
  const navPrefetchedRef = useRef<Set<string>>(new Set());

  // Hover/focus prefetch: warm the route chunk, and the transactions DATA so
  // /transactions paints instantly on click.
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
          dispatch(TransactionAction(TRANSACTION_FETCH, selectedCompanyId ? { company_id: selectedCompanyId } : undefined));
        }
      }
    },
    [router, dispatch, selectedCompanyId, txLoadedCompany, txLoading],
  );
  const userState = useSelector((s: rootReducer) => (s as any).userReducer);
  const hasClaimedCreator = Boolean(userState?.profile?.handle && userState?.profile?.creator_page_enabled);

  // First-run creator-page coach-mark (once, localStorage-gated).
  const CREATOR_TOUR_KEY = "dyno_creator_tour_seen";
  const creatorPillRef = useRef<HTMLElement | null>(null);
  const [tourAnchor, setTourAnchor] = useState<HTMLElement | null>(null);
  const [showTour, setShowTour] = useState(false);
  const profileLoaded = Boolean(userState?.profile);
  useEffect(() => {
    if (labelled || !profileLoaded || hasClaimedCreator) return;
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
  }, [labelled, profileLoaded, hasClaimedCreator]);
  const dismissTour = useCallback(() => {
    setShowTour(false);
    try {
      window.localStorage.setItem(CREATOR_TOUR_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const startCreatorSetup = useCallback(() => {
    dismissTour();
    router.push("/storefront?tab=page");
  }, [dismissTour, router]);

  useEffect(() => {
    ["/dashboard", "/transactions", "/pay-links", "/payouts", "/wallet", "/settings", "/storefront"].forEach((p) =>
      router.prefetch(p),
    );
  }, []);
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const { isIndividual, reveal } = useAccountProfile();
  const sections = useMemo(
    () => buildNavSections({ t, isIndividual, hasClaimedCreator, reveal, brandCount }),
    [t, isIndividual, hasClaimedCreator, reveal, brandCount],
  );
  const { isSectionCollapsed, toggle: toggleSection, expand: expandSection } = useCollapsedSections();
  const isActiveRoute = useCallback((path: string) => isNavPathActive(router.pathname, path), [router.pathname]);

  // The group holding the current page always stays open.
  const activeSectionKey = useMemo(
    () => sections.find((s) => s.items.some((i) => isActiveRoute(i.path)))?.key,
    [sections, isActiveRoute],
  );
  useEffect(() => {
    if (activeSectionKey) expandSection(activeSectionKey);
  }, [activeSectionKey, expandSection]);

  // Scroll cue: fade the bottom edge while more rows sit below the fold.
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const measure = () => setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [sections, isCollapsed, labelled]);

  const iconColor = (isActive: boolean) => (isActive ? theme.palette.primary.main : theme.palette.text.secondary);
  const denyTip = t("noPermissionTooltip", { defaultValue: "You don't have permission for this" });

  if (labelled) {
    return (
      <SidebarWrapper data-collapsed="true" data-labelled="true" sx={{ padding: "10px 6px" }}>
        <LabelledRail sections={sections} isActiveRoute={isActiveRoute} isDenied={(i) => !!(isMember && i.permission && !can(i.permission))} prefetch={prefetchNav} />
      </SidebarWrapper>
    );
  }

  return (
    <SidebarWrapper data-collapsed={isCollapsed ? "true" : "false"} sx={isCollapsed ? { padding: "12px 8px" } : undefined}>
      <Box sx={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Menu ref={menuRef} data-testid="sidebar-menu">
          <Box sx={{ display: "flex", flexDirection: "column", gap: "inherit" }}>
            <SetupProgressItem collapsed={isCollapsed} />
            {sections.map((section, sectionIdx) => {
              const hasHeader = !isCollapsed && !!section.label;
              const folded = hasHeader && section.key !== activeSectionKey && isSectionCollapsed(section.key);
              return (
                <React.Fragment key={section.key}>
                  {isCollapsed && sectionIdx > 0 && (
                    <Divider flexItem sx={{ mx: 0.5, my: 0.75, borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
                  )}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }} data-testid={`sidebar-section-${section.key}`} data-folded={folded ? "true" : "false"}>
                    {hasHeader && (
                      <SectionHeader
                        sectionKey={section.key}
                        label={section.label}
                        open={!folded}
                        count={section.items.length}
                        onToggle={() => toggleSection(section.key)}
                      />
                    )}
                    {!folded && (
                      <Box id={`sidebar-section-${section.key}`} sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {section.items.map((item) => {
                          const isActive = isActiveRoute(item.path);
                          const denied = !!(isMember && item.permission && !can(item.permission));
                          const node = (
                            <MenuLink
                              href={item.path}
                              prefetch={false}
                              active={isActive}
                              aria-current={isActive ? "page" : undefined}
                              aria-disabled={denied || undefined}
                              aria-label={isCollapsed ? item.label : undefined}
                              tabIndex={denied ? -1 : 0}
                              data-denied={denied ? "true" : "false"}
                              data-testid={`sidebar-item-${item.icon}`}
                              ref={item.icon === "creator" ? (creatorPillRef as any) : undefined}
                              onFocus={() => { if (!denied) prefetchNav(item); }}
                              onMouseEnter={() => { if (!denied) prefetchNav(item); }}
                              onClick={(e: React.MouseEvent) => { if (denied) e.preventDefault(); }}
                              sx={{
                                ...(isCollapsed ? { justifyContent: "center", padding: "10px 0", gap: 0 } : {}),
                                ...(denied ? { opacity: 0.45, cursor: "not-allowed" } : {}),
                              }}
                            >
                              <IconBox active={isActive}>
                                <NavIcon name={item.icon} color={iconColor(isActive)} />
                              </IconBox>
                              {!isCollapsed && (
                                <Box component="span" sx={{ fontSize: "14px", fontWeight: isActive ? 600 : 500, lineHeight: 1.2, fontFamily: "var(--font-sans)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.label}
                                </Box>
                              )}
                            </MenuLink>
                          );
                          const tip = denied ? denyTip : isCollapsed ? item.label : "";
                          return tip ? (
                            <Tooltip key={item.path} title={tip} placement="right" arrow enterDelay={200}>
                              {node}
                            </Tooltip>
                          ) : (
                            <React.Fragment key={item.path}>{node}</React.Fragment>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        </Menu>
        <Box
          aria-hidden
          data-testid="sidebar-scroll-fade"
          data-visible={moreBelow ? "true" : "false"}
          sx={{
            pointerEvents: "none",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 36,
            opacity: moreBelow ? 1 : 0,
            transition: "opacity 160ms ease",
            background: `linear-gradient(to bottom, rgba(0,0,0,0), ${theme.palette.background.paper})`,
          }}
        />
      </Box>

      <SidebarFooter collapsed={isCollapsed} canToggle={!forceCollapsed} onToggle={toggleCollapsed} />

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
                <Box sx={{ width: 272, p: 2, borderRadius: "14px", backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, boxShadow: "0 12px 40px rgba(0,0,0,0.28)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                    <AutoAwesomeRounded sx={{ fontSize: 18, color: BRAND_ACCENT }} />
                    <Box sx={{ fontSize: 14, fontWeight: 800, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
                      {t("creatorTourTitle", { defaultValue: "New: your creator page" })}
                    </Box>
                  </Box>
                  <Box sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55, mb: 1.5 }}>
                    {t("creatorTourBody", { defaultValue: "Claim your handle to get a shareable link-in-bio page for tips \u2014 your public \u201cBuy me a coffee\u201d." })}
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button onClick={dismissTour} size="small" data-testid="creator-tour-dismiss" sx={{ textTransform: "none", fontWeight: 700, fontSize: 13, color: theme.palette.text.secondary, minWidth: 0, px: 1 }}>
                      {t("creatorTourDismiss", { defaultValue: "Maybe later" })}
                    </Button>
                    <Button
                      onClick={startCreatorSetup}
                      disableElevation
                      variant="contained"
                      size="small"
                      data-testid="creator-tour-cta"
                      sx={{ textTransform: "none", fontWeight: 800, fontSize: 13, borderRadius: "8px", backgroundColor: BRAND_ACCENT, color: "#0A0A0B", "&:hover": { backgroundColor: BRAND_ACCENT, filter: "brightness(1.08)" } }}
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

