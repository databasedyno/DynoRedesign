// FIX (2026-07-10, user report): the indigo/blue logo clashed with the black +
// lime landing brand in light mode — swapped for a near-black monochrome mark.
import DynopayLogo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import DynopayWhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowForwardRounded } from "@mui/icons-material";
import { Box, Button, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import HomeButton from "../HomeButton";
import {
  Actions,
  ActionDivider,
  ClickableLogo,
  DesktopLanguageWrapper,
  FixedHeader,
  HeaderContainer,
  HeaderDivider,
  LeftGroup,
  MenuCloseIcon,
  MenuOpenIcon,
  MobileDrawer,
  MobileLanguageWrapper,
  MobileMenuButton,
  MobileMenuDrawer,
  MobileNavContent,
  MobileNavItem,
  MobileTrustBadges,
  NavLinks,
  RightGroup,
  StatusPillWrap,
  StyledGetStartedButton,
  StyledSignInButton,
  TrustPill,
} from "./styled";

/* ================= TYPES ================= */

type SectionId = "features" | "fee-calculator";

type TranslationKey = "features" | "headerFees" | "documentation" | "blog";

interface HeaderItem {
  translationKey: TranslationKey;
  path: string;
  sectionId?: SectionId;
  external?: boolean;
}

/* ================= CONSTANTS ================= */

const HEADER_OFFSET_PX = 100;
const SCROLL_THRESHOLD_PX = 10;

const HEADER_ITEMS: readonly HeaderItem[] = [
  { translationKey: "features", sectionId: "features", path: "/" },
  { translationKey: "headerFees", path: "/fees", external: false },
  { translationKey: "documentation", path: "/documentation", external: false },
  { translationKey: "blog", path: "/blog", external: false },
] as const;

// Section IDs on the homepage that we scroll-spy against (D).
// Order matters — we highlight the last one whose top is above the viewport
// midpoint.
const SPY_SECTIONS: readonly string[] = ["hero", "fee-calculator", "features", "use-cases"] as const;

/* ================= COMPONENT ================= */

const HomeHeader = memo(function HomeHeader() {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const isMobile = useIsMobile("md");
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<string>("hero");
  // Avoid SSR/client hydration mismatch for theme-dependent assets.
  // SSR always renders in 'dark' mode (ThemeContext fallback), so we
  // must match that on the first client render, then switch after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const logoSrc = (!mounted || isDark) ? DynopayWhiteLogo : DynopayLogo;

  const lastScrollY = useRef<number>(0);
  const ticking = useRef<boolean>(false);

  /* ================= NAVIGATION ================= */

  const navigateHome = useCallback(() => {
    void router.push("/");
  }, [router]);

  const scrollToSection = useCallback((id?: SectionId) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;

    const top =
      el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET_PX;

    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleNav = useCallback(
    (item: HeaderItem) => {
      if (item.external) {
        window.open(item.path, "_blank", "noopener,noreferrer");
        setMobileMenuOpen(false);
        return;
      }

      if (item.sectionId) {
        if (router.pathname !== "/") {
          void router.push("/").then(() => {
            setTimeout(() => scrollToSection(item.sectionId), 80);
          });
        } else {
          scrollToSection(item.sectionId);
        }
      } else {
        void router.push(item.path);
      }

      setMobileMenuOpen(false);
    },
    [router, scrollToSection],
  );

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

  /* ================= SCROLL-SPY (D) ================= */
  // Highlights the nav item whose section is currently at/above the header.
  // Only runs on the homepage — noop on every other route.
  useEffect(() => {
    if (router.pathname !== "/") return;

    let raf = 0;
    const onScrollSpy = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const mid = window.scrollY + HEADER_OFFSET_PX + 40;
        let current = SPY_SECTIONS[0];
        for (const id of SPY_SECTIONS) {
          const el = document.getElementById(id);
          if (!el) continue;
          const top = el.offsetTop;
          if (top <= mid) current = id;
        }
        setActiveSection(current);
        raf = 0;
      });
    };

    onScrollSpy();
    window.addEventListener("scroll", onScrollSpy, { passive: true });
    return () => window.removeEventListener("scroll", onScrollSpy);
  }, [router.pathname]);

  /* ================= SCROLL LOCK ================= */

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (mobileMenuOpen) {
      const scrollBarWidth = window.innerWidth - html.clientWidth;

      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
    }

    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
    };
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
          <ClickableLogo
            type="button"
            aria-label="Go to home"
            onClick={navigateHome}
          >
            <Image
              src={logoSrc}
              alt="Dynopay"
              width={134}
              height={45}
              draggable={false}
              priority
            />
          </ClickableLogo>

          <NavLinks>
            {HEADER_ITEMS.map((item) => {
              const isActive = item.sectionId ? activeSection === item.sectionId : false;
              return (
                <Button
                  key={item.translationKey}
                  disableRipple
                  onClick={() => handleNav(item)}
                  sx={{
                    position: "relative",
                    // Aurora coral underline for the currently-visible section
                    "&::after": item.sectionId
                      ? {
                          content: '""',
                          position: "absolute",
                          left: "50%",
                          bottom: 4,
                          transform: `translateX(-50%) scaleX(${isActive ? 1 : 0})`,
                          transformOrigin: "center",
                          width: 22,
                          height: 2,
                          borderRadius: 2,
                          background:
                            "linear-gradient(90deg, #4F46E5 0%, #7C5CFF 100%)",
                          transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
                        }
                      : undefined,
                    color: isActive
                      ? (theme) =>
                          theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A"
                      : undefined,
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {t(item.translationKey)}
                </Button>
              );
            })}
          </NavLinks>
        </LeftGroup>

        <RightGroup>
          <Actions>
            {!isMobile && (
              <StatusPillWrap aria-label="System status">
                <span className="dot" />
                <span className="status-label">All systems normal</span>
              </StatusPillWrap>
            )}

            {!isMobile && (
              <DesktopLanguageWrapper>
                <LanguageSwitcher />
              </DesktopLanguageWrapper>
            )}

            <ThemeToggle size="small" />

            {!isMobile && <ActionDivider />}

            <StyledSignInButton
              disableRipple
              onClick={() => void router.push("/auth/login")}
            >
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
            data-testid="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <MenuCloseIcon /> : <MenuOpenIcon />}
          </MobileMenuButton>
        </RightGroup>
      </HeaderContainer>

      <MobileMenuDrawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        ModalProps={{ keepMounted: true }}
      >
        <MobileDrawer>
          <MobileNavContent>
            {HEADER_ITEMS.map((item) => (
              <MobileNavItem
                key={item.translationKey}
                onClick={() => handleNav(item)}
              >
                {t(item.translationKey)}
              </MobileNavItem>
            ))}

            {/* Coral CTA inside the mobile drawer — matches Aurora hero */}
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
                  boxShadow: "0 8px 22px rgba(79, 70, 229,0.36)",
                  "&:hover": { background: "#4338CA" },
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
                  color: "#F5F5F5",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: "none",
                  borderRadius: 999,
                  height: 44,
                  border: "1px solid rgba(255,255,255,0.14)",
                  "&:hover": { background: "rgba(255,255,255,0.06)" },
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

      <HeaderDivider />
    </FixedHeader>
  );
});

export default HomeHeader;
