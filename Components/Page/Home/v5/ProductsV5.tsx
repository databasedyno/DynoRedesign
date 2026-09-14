import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, keyframes, useMediaQuery, useTheme } from "@mui/material";
import { AnimatePresence, PanInfo, motion, useInView, useReducedMotion } from "framer-motion";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, Section, SectionHead, goStart } from "./shared";
import { BrowserFrame, FramedImage, PhoneFrame } from "./DeviceFrame";
import { EASE_OUT } from "../motion/tokens";

const TABS = [
  { id: "links", Icon: LinkRoundedIcon, href: "/auth/register?ref=products_links", start: true },
  { id: "checkout", Icon: ShoppingCartCheckoutRoundedIcon, href: "/pay/demo" },
  { id: "storefront", Icon: StorefrontRoundedIcon, href: "/for/creators" },
  { id: "donations", Icon: VolunteerActivismRoundedIcon, href: "/pay/donation-demo" },
  { id: "invoices", Icon: ReceiptLongRoundedIcon, href: "/auth/register?ref=products_invoices", start: true },
  { id: "embeds", Icon: CodeRoundedIcon, href: "/documentation#buy-button" },
  { id: "api", Icon: TerminalRoundedIcon, href: "/documentation" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Hostinger's hero cards cycle every few seconds — same here, one tab per AUTO_MS. */
export const AUTO_MS = 6000;
const SWIPE_PX = 56;
const SWIPE_V = 420;
const fill = keyframes`from{transform:scaleX(0)}to{transform:scaleX(1)}`;
/** Direction-aware slide: the new panel comes in from the side you swiped towards. */
const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -36, transition: { duration: 0.18, ease: "easeIn" as const } }),
};

const SHOT_URL: Record<TabId, string> = {
  links: "dynopay.com/pay-links",
  checkout: "dynopay.com/pay",
  storefront: "dynopay.com/devhub",
  donations: "dynopay.com/donate/riverside-library",
  invoices: "dynopay.com/invoices",
  embeds: "dynopay.com/documentation#buy-button",
  api: "dynopay.com/documentation",
};

/** Device-framed product shot: browser window for every tab, plus a floating phone for the checkout (what buyers see). */
const Shot: React.FC<{ id: TabId; alt: string }> = ({ id, alt }) => {
  const theme = useTheme();
  const mode = theme.palette.mode === "dark" ? "dark" : "light";
  const src = `/landing/products/${id}-${mode}.webp`;
  const phone = id === "checkout";
  return (
    <Box data-testid={`product-shot-${id}`} sx={{ position: "relative", pr: phone ? { xs: 0, md: 9 } : 0, pb: phone ? { xs: 0, md: 4 } : 0 }}>
      <BrowserFrame url={SHOT_URL[id]}>
        <Box sx={{ position: "relative", aspectRatio: "16 / 10" }}>
          <FramedImage src={src} alt={alt} />
        </Box>
      </BrowserFrame>
      {phone ? (
        <PhoneFrame testId="product-shot-checkout-phone" width={{ xs: 0, md: 150 }} sx={{ display: { xs: "none", md: "block" }, position: "absolute", right: 0, bottom: 0, zIndex: 2 }}>
          <FramedImage src={`/landing/products/checkout-phone-${mode}.webp`} alt={alt} position="top center" />
        </PhoneFrame>
      ) : null}
    </Box>
  );
};

/** Auto-rotation gate: only while on screen, tab visible, not hovered/focused, motion allowed, and the visitor hasn't taken over. */
function useAutoRotate(ref: React.RefObject<HTMLElement>) {
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const [auto, setAuto] = useState(true);
  const [held, setHeld] = useState(false);
  const [docVisible, setDocVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onVis = () => setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  const running = mounted && auto && inView && docVisible && !held && !reduced;
  return { auto, running, stop: () => setAuto(false), hold: setHeld };
}

/** One tabbed showcase replaces feature cards + showcase + audience doors + "ways to get paid". */
const ProductsV5: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const [active, setActive] = useState<TabId>("links");
  const [dir, setDir] = useState<1 | -1>(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { auto, running, stop, hold } = useAutoRotate(stageRef);
  const theme = useTheme();
  const touch = useMediaQuery(theme.breakpoints.down("md"));
  const tab = TABS.find((x) => x.id === active) ?? TABS[0];
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const pillInk = s.dark ? s.bg : "#fff";
  const idx = (id: TabId) => TABS.findIndex((x) => x.id === id);

  const advance = () => {
    setDir(1);
    setActive((a) => TABS[(idx(a) + 1) % TABS.length].id);
  };
  const pick = (id: TabId) => {
    stop();
    setDir(idx(id) >= idx(active) ? 1 : -1);
    setActive(id);
  };
  /** Swipe (mobile): left → next, right → previous. */
  const step = (delta: 1 | -1) => {
    stop();
    setDir(delta);
    setActive((a) => TABS[(idx(a) + delta + TABS.length) % TABS.length].id);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_V) step(1);
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_V) step(-1);
  };

  // Keep the active pill in view inside the horizontally scrolling tablist (never scrolls the page).
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !el) return;
    list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  return (
    <Section id="products" testId="products">
      <SectionHead eyebrow={t("v5.products.eyebrow")} headline={t("v5.products.headline")} body={t("v5.products.body")} />
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Box
          component="a"
          href="/pay/donation-demo"
          data-testid="products-donations-link"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontFamily: FONT_TECH, fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: accent, textDecoration: "none", borderBottom: `1px dashed ${s.line}`, pb: 0.25, transition: "border-color 160ms ease, color 160ms ease", "&:hover": { borderColor: accent } }}
        >
          <VolunteerActivismRoundedIcon sx={{ fontSize: 16 }} />
          {t("v5.products.donationsLink")} →
        </Box>
      </Box>
      <Box ref={stageRef} data-testid="products-stage" data-autoplay={auto ? (running ? "running" : "paused") : "off"} onMouseEnter={() => hold(true)} onMouseLeave={() => hold(false)} onFocusCapture={() => hold(true)} onBlurCapture={() => hold(false)}>
        <Box ref={listRef} role="tablist" aria-label={t("v5.products.eyebrow")} sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: { xs: 3, md: 4 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {TABS.map((tb) => {
            const on = tb.id === active;
            return (
              <Box
                key={tb.id}
                component="button"
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`product-tab-${tb.id}`}
                onClick={() => pick(tb.id)}
                sx={{ all: "unset", cursor: "pointer", position: "relative", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.75, py: 1.05, borderRadius: "999px", border: `1px solid ${on ? "transparent" : s.line}`, color: on ? pillInk : s.ink2, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", transition: "color 220ms ease, border-color 180ms ease", "&:hover": { borderColor: on ? "transparent" : s.lineStrong }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 2 } }}
              >
                {on ? (
                  <motion.span layoutId="products-tab-pill" data-testid="products-tab-pill" transition={{ type: "spring", stiffness: 480, damping: 40 }} style={{ position: "absolute", inset: 0, borderRadius: 999, background: s.ink, zIndex: 0 }}>
                    {auto ? (
                      <Box
                        component="span"
                        key={active}
                        aria-hidden
                        data-testid="products-autoplay-progress"
                        onAnimationEnd={(e: React.AnimationEvent) => { if (e.target === e.currentTarget && running) advance(); }}
                        sx={{ position: "absolute", left: 16, right: 16, bottom: 5, height: 2, borderRadius: 2, background: pillInk, opacity: 0.45, transformOrigin: "left", transform: "scaleX(0)", animation: `${fill} ${AUTO_MS}ms linear both`, animationPlayState: running ? "running" : "paused" }}
                      />
                    ) : null}
                  </motion.span>
                ) : null}
                <Box component="span" sx={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 0.9 }}>
                  <tb.Icon sx={{ fontSize: 17 }} />
                  {t(`v5.products.${tb.id}.tab`)}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box data-testid="products-panel-frame" data-swipe={touch ? "on" : "off"} sx={{ position: "relative", borderRadius: "24px", background: s.bgAlt, border: `1px solid ${s.line}`, p: { xs: 3, md: 5 }, overflow: "hidden", touchAction: "pan-y" }}>
          <AnimatePresence initial={false} mode="popLayout" custom={dir}>
            <motion.div
              key={tab.id}
              role="tabpanel"
              data-testid={`product-panel-${tab.id}`}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: EASE_OUT }}
              drag={touch ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.22}
              dragMomentum={false}
              onDragStart={() => stop()}
              onDragEnd={onDragEnd}
              style={{ display: "grid", alignItems: "center", cursor: touch ? "grab" : undefined, userSelect: touch ? "none" : undefined }}
            >
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.8fr 1.2fr" }, gap: { xs: 4, md: 6 }, alignItems: "center" }}>
                <Box>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 30 }, letterSpacing: "-0.025em", lineHeight: 1.1, color: s.ink, mb: 2 }}>{t(`v5.products.${tab.id}.title`)}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16.5 }, lineHeight: 1.55, color: s.ink2, mb: 2 }}>{t(`v5.products.${tab.id}.desc`)}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: accent, fontWeight: 600, mb: 3.5 }}>{t(`v5.products.${tab.id}.note`)}</Typography>
                  {"start" in tab && tab.start ? (
                    <PrimaryBtn small data-testid="product-cta" onClick={() => goStart(router, tab.id)} endIcon={<ArrowForwardIcon sx={{ fontSize: 17 }} />}>{t(`v5.products.${tab.id}.cta`)}</PrimaryBtn>
                  ) : (
                    <PrimaryBtn small data-testid="product-cta" href={tab.href} endIcon={<ArrowForwardIcon sx={{ fontSize: 17 }} />}>{t(`v5.products.${tab.id}.cta`)}</PrimaryBtn>
                  )}
                </Box>
                <Shot id={tab.id} alt={t("v5.products.shotAlt", { name: t(`v5.products.${tab.id}.tab`) })} />
              </Box>
            </motion.div>
          </AnimatePresence>
        </Box>
        {/* Mobile-only position dots — the swipe affordance (tap = jump). */}
        <Box role="group" aria-label={t("v5.products.eyebrow")} data-testid="products-dots" sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", gap: 1, mt: 2.25 }}>
          {TABS.map((tb) => {
            const on = tb.id === active;
            return (
              <Box
                key={tb.id}
                component="button"
                type="button"
                aria-label={t(`v5.products.${tb.id}.tab`)}
                aria-current={on ? "true" : undefined}
                data-testid={`products-dot-${tb.id}`}
                onClick={() => pick(tb.id)}
                sx={{ all: "unset", cursor: "pointer", height: 28, px: 0.25, display: "grid", placeItems: "center", "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 2, borderRadius: 999 } }}
              >
                <Box component="span" sx={{ display: "block", width: on ? 22 : 8, height: 8, borderRadius: 999, background: on ? accent : s.lineStrong, transition: "width 260ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease" }} />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Section>
  );
};

export default memo(ProductsV5);
