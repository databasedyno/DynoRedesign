// Coinbase-style marketing header (2026-08-02):
//   • Desktop: logo + mega-menu dropdowns (Products / Developers / Resources /
//     Company). Products includes a highlighted "featured" promo tile.
//   • Right side: search (⌘K command menu), "All systems normal" pill, globe
//     language menu, theme toggle, Sign in, Get started.
//   • Mobile / tablet (<1025px): full-height drawer with an accordion of the
//     same sections, auth CTAs, language + theme, trust row.
// Menu items are real <Link> anchors (reliable + a11y/SEO). Preserves the
// hardened hamburger tap (onPointerUp + de-dupe) and body-only scroll-lock.
import DynopayLogo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import DynopayWhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import { ArrowForwardRounded } from "@mui/icons-material";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, Collapse, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import HomeButton from "../HomeButton";
import CommandMenu from "./CommandMenu";
import HeaderLangMenu from "./HeaderLangMenu";
import { MENU_SECTIONS } from "./menuData";
import {
  Actions,
  ActionDivider,
  ClickableLogo,
  FeaturedBadge,
  FeaturedTile,
  FixedHeader,
  HeaderContainer,
  HeaderDivider,
  LeftGroup,
  MegaCard,
  MegaItemDesc,
  MegaItemIcon,
  MegaItemLink,
  MegaItemTitle,
  MegaPanel,
  MegaTrigger,
  MegaTriggerButton,
  MenuCloseIcon,
  MenuOpenIcon,
  MobileDrawer,
  MobileLanguageWrapper,
  MobileMenuButton,
  MobileMenuDrawer,
  MobileNavContent,
  MobileSection,
  MobileSectionButton,
  MobileSubItem,
  MobileTrustBadges,
  NavLinks,
  RightGroup,
  SearchButton,
  StatusPillWrap,
  StyledGetStartedButton,
  StyledSignInButton,
  TrustPill,
} from "./styled";

/* ================= CONSTANTS ================= */

const HEADER_OFFSET_PX = 100;
const SCROLL_THRESHOLD_PX = 10;
const MEGA_CLOSE_DELAY_MS = 220;

/* ================= COMPONENT ================= */

const HomeHeader = memo(function HomeHeader() {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  // Desktop mega-menu: which section (if any) is open.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Mobile accordion: which section is expanded (Products open by default).
  const [openMobileSection, setOpenMobileSection] = useState<string | null>("products");

  // Avoid SSR/client hydration mismatch for theme-dependent assets.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const logoSrc = !mounted || isDark ? DynopayWhiteLogo : DynopayLogo;

  const lastScrollY = useRef<number>(0);
  const ticking = useRef<boolean>(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // De-dupe pointerup + synthesised click for the mobile hamburger.
  const lastToggleTsRef = useRef<number>(0);

  /* ================= NAVIGATION ================= */

  const navigateHome = useCallback(() => {
    void router.push("/");
  }, [router]);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET_PX;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  // Mega-menu / accordion item click. Items render as real <Link> anchors so
  // navigation is native + reliable. Only same-page homepage hash links are
  // intercepted to smooth-scroll; everything else uses native <Link> nav.
  const handleItemClick = useCallback(
    (e: ReactMouseEvent<HTMLElement>, href: string) => {
      setOpenMenu(null);
      setMobileMenuOpen(false);

      if (href.startsWith("/#")) {
        e.preventDefault();
        const id = href.slice(2);
        if (router.pathname === "/") {
          scrollToId(id);
        } else {
          void router.push("/").then(() => setTimeout(() => scrollToId(id), 90));
        }
      }
    },
    [router, scrollToId],
  );

  /* ================= MEGA-MENU OPEN/CLOSE ================= */

  const openNow = useCallback((key: string) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenMenu(key);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), MEGA_CLOSE_DELAY_MS);
  }, []);

  // Close the open mega-menu on the first scroll, and on Escape.
  useEffect(() => {
    if (!openMenu) return undefined;
    const onScroll = () => setOpenMenu(null);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Global ⌘K / Ctrl+K to toggle the command menu.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close menus on route change.
  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [router.asPath]);

  /* ================= HEADER VISIBILITY ================= */

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        let visible = isHeaderVisible;

        if (currentY < SCROLL_THRESHOLD_PX) {
          visible = true;
        } else if (currentY > lastScrollY.current) {
          visible = false;
        } else {
          visible = true;
        }

        lastScrollY.current = currentY;
        setIsHeaderVisible(visible);
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHeaderVisible]);

  /* ================= SCROLL LOCK (mobile drawer) ================= */

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (mobileMenuOpen) {
      const scrollBarWidth = window.innerWidth - html.clientWidth;
      const rafId = requestAnimationFrame(() => {
        body.style.overflow = "hidden";
        body.style.paddingRight = `${scrollBarWidth}px`;
      });
      return () => {
        cancelAnimationFrame(rafId);
        body.style.overflow = "";
        body.style.paddingRight = "";
      };
    }

    body.style.overflow = "";
    body.style.paddingRight = "";
    return undefined;
  }, [mobileMenuOpen]);

  /* ================= RENDER ================= */

  return (
    <FixedHeader
      sx={{
        transform: isHeaderVisible ? "translateY(0)" : "translateY(-100%)",
        opacity: isHeaderVisible ? 1 : 0,
      }}
    >
      <HeaderContainer aria-label="Primary navigation">
        <LeftGroup>
          <ClickableLogo type="button" aria-label="Go to home" onClick={navigateHome}>
            <Image src={logoSrc} alt="Dynopay" width={134} height={45} draggable={false} priority />
          </ClickableLogo>

          <NavLinks>
            {MENU_SECTIONS.map((section) => {
              const open = openMenu === section.key;
              const featured = section.featured;
              const FeaturedIcon = featured?.Icon;
              return (
                <MegaTrigger
                  key={section.key}
                  onMouseEnter={() => openNow(section.key)}
                  onMouseLeave={scheduleClose}
                >
                  <MegaTriggerButton
                    disableRipple
                    data-open={open ? "true" : "false"}
                    data-testid={`nav-${section.key}`}
                    aria-haspopup="true"
                    aria-expanded={open}
                    onClick={() => setOpenMenu(open ? null : section.key)}
                  >
                    {t(section.labelKey)}
                    <KeyboardArrowDownRounded className="chev" />
                  </MegaTriggerButton>

                  {open && (
                    <MegaPanel data-testid={`mega-${section.key}`}>
                      <MegaCard
                        sx={featured ? { flexDirection: "row", maxWidth: 648, minWidth: 588, gap: 1.5 } : undefined}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.25,
                            flex: 1,
                            minWidth: featured ? 300 : "auto",
                          }}
                        >
                          {section.items.map((item) => {
                            const Icon = item.Icon;
                            return (
                              <MegaItemLink
                                key={item.titleKey}
                                component={Link}
                                href={item.href}
                                data-testid={`mega-item-${item.titleKey}`}
                                onClick={(e: ReactMouseEvent<HTMLElement>) => handleItemClick(e, item.href)}
                              >
                                <MegaItemIcon className="mega-icon">
                                  <Icon />
                                </MegaItemIcon>
                                <Box>
                                  <MegaItemTitle className="mega-title">{t(item.titleKey)}</MegaItemTitle>
                                  <MegaItemDesc>{t(item.descKey)}</MegaItemDesc>
                                </Box>
                              </MegaItemLink>
                            );
                          })}
                        </Box>

                        {featured && FeaturedIcon && (
                          <FeaturedTile
                            component={Link}
                            href={featured.href}
                            data-testid="mega-featured"
                            onClick={(e: ReactMouseEvent<HTMLElement>) => handleItemClick(e, featured.href)}
                          >
                            <FeaturedBadge>
                              <FeaturedIcon sx={{ fontSize: 13 }} />
                              Public beta
                            </FeaturedBadge>
                            <Box sx={{ position: "relative", zIndex: 1 }}>
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-hero)",
                                  fontSize: 16.5,
                                  fontWeight: 600,
                                  lineHeight: 1.2,
                                  mb: 0.75,
                                }}
                              >
                                {t(featured.titleKey)}
                              </Typography>
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-body)",
                                  fontSize: 12.5,
                                  lineHeight: 1.45,
                                  color: "rgba(255,255,255,0.86)",
                                }}
                              >
                                {t(featured.descKey)}
                              </Typography>
                            </Box>
                            <Box
                              className="feat-cta"
                              sx={{
                                position: "relative",
                                zIndex: 1,
                                mt: "auto",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                fontFamily: "var(--font-body)",
                                fontSize: 13.5,
                                fontWeight: 600,
                              }}
                            >
                              {t(featured.ctaKey)}
                              <ArrowForwardRounded
                                className="feat-arrow"
                                sx={{ fontSize: 16, transition: "transform 200ms ease" }}
                              />
                            </Box>
                          </FeaturedTile>
                        )}
                      </MegaCard>
                    </MegaPanel>
                  )}
                </MegaTrigger>
              );
            })}
          </NavLinks>
        </LeftGroup>

        <RightGroup>
          <Actions>
            <StatusPillWrap aria-label="System status">
              <span className="dot" />
              <span className="status-label">{t("v3.header.systemsNormal")}</span>
            </StatusPillWrap>

            <SearchButton
              disableRipple
              aria-label={t("search.button")}
              data-testid="header-search-button"
              onClick={() => setSearchOpen(true)}
            >
              <SearchRoundedIcon />
              <span className="kbd">⌘K</span>
            </SearchButton>

            <HeaderLangMenu hideOnMobile />

            <ThemeToggle size="small" />

            <ActionDivider />

            <StyledSignInButton disableRipple onClick={() => void router.push("/auth/login")}>
              {t("signIn")}
            </StyledSignInButton>

            <StyledGetStartedButton>
              <HomeButton
                variant="primary"
                label={t("getStarted")}
                showIcon={false}
                navigateTo="/auth/register"
                sx={{
                  borderRadius: "999px !important",
                  padding: "10px 20px !important",
                  minWidth: "120px",
                  fontSize: "15px !important",
                  fontFamily: "var(--font-body) !important",
                  fontWeight: "600 !important",
                }}
              />
            </StyledGetStartedButton>
          </Actions>

          <MobileMenuButton
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            data-testid="mobile-menu-toggle"
            onPointerUp={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              lastToggleTsRef.current = Date.now();
              setMobileMenuOpen((prev) => !prev);
            }}
            onClick={() => {
              if (Date.now() - lastToggleTsRef.current < 350) return;
              setMobileMenuOpen((prev) => !prev);
            }}
          >
            {mobileMenuOpen ? <MenuCloseIcon /> : <MenuOpenIcon />}
          </MobileMenuButton>
        </RightGroup>
      </HeaderContainer>

      <MobileMenuDrawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        transitionDuration={{ enter: 200, exit: 150 }}
        ModalProps={{ keepMounted: true, disableScrollLock: true }}
      >
        <MobileDrawer>
          <MobileNavContent>
            {MENU_SECTIONS.map((section) => {
              const open = openMobileSection === section.key;
              return (
                <MobileSection key={section.key}>
                  <MobileSectionButton
                    type="button"
                    data-open={open ? "true" : "false"}
                    data-testid={`mnav-${section.key}`}
                    aria-expanded={open}
                    onClick={() => setOpenMobileSection(open ? null : section.key)}
                  >
                    {t(section.labelKey)}
                    <KeyboardArrowDownRounded className="chev" />
                  </MobileSectionButton>

                  <Collapse in={open} timeout={220} unmountOnExit>
                    <Box sx={{ pb: 1.25 }}>
                      {section.items.map((item) => {
                        const Icon = item.Icon;
                        return (
                          <MobileSubItem
                            key={item.titleKey}
                            component={Link}
                            href={item.href}
                            data-testid={`msub-${item.titleKey}`}
                            onClick={(e: ReactMouseEvent<HTMLElement>) => handleItemClick(e, item.href)}
                          >
                            <Box className="msub-icon">
                              <Icon />
                            </Box>
                            <Typography className="msub-title">{t(item.titleKey)}</Typography>
                          </MobileSubItem>
                        );
                      })}
                    </Box>
                  </Collapse>
                </MobileSection>
              );
            })}

            {/* Auth CTAs */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 2.5 }}>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void router.push("/auth/register");
                }}
                endIcon={<ArrowForwardRounded />}
                sx={{
                  background: "#4F46E5",
                  color: "#FFFFFF",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 999,
                  padding: "12px 22px",
                  height: 48,
                  boxShadow: "none",
                  transition: "background-color 200ms ease, transform 150ms cubic-bezier(0.16,1,0.3,1)",
                  "&:hover": { background: "#4338CA", boxShadow: "none" },
                  "&:active": { transform: "scale(0.98)", background: "#4338CA" },
                }}
              >
                {t("getStarted")}
              </Button>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void router.push("/auth/login");
                }}
                sx={{
                  color: isDark ? "#F5F5F5" : "#0A0A0A",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: "none",
                  borderRadius: 999,
                  height: 44,
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)"}`,
                  transition: "background-color 200ms ease, border-color 200ms ease",
                  "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.04)",
                    borderColor: "#4F46E5",
                  },
                }}
              >
                {t("signIn")}
              </Button>
            </Box>

            <MobileLanguageWrapper>
              <LanguageSwitcher showBig={true} />
              <ThemeToggle size="small" sx={{ ml: 1 }} />
            </MobileLanguageWrapper>

            <MobileTrustBadges>
              <TrustPill>SOC 2</TrustPill>
              <TrustPill>GDPR</TrustPill>
              <TrustPill>Non-custodial</TrustPill>
              <TrustPill>● Live</TrustPill>
            </MobileTrustBadges>
          </MobileNavContent>
        </MobileDrawer>
      </MobileMenuDrawer>

      <CommandMenu open={searchOpen} onClose={() => setSearchOpen(false)} />

      <HeaderDivider />
    </FixedHeader>
  );
});

export default HomeHeader;
