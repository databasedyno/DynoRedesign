import React, { memo, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAurora } from "../v3/theme.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "./shared";
import useTokenData from "@/hooks/useTokenData";

/** Phone-only sticky CTA bar, shown once the hero has scrolled out. */
const StickyMobileCta: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const [show, setShow] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);
  const authed = !!useTokenData();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const hero = document.querySelector<HTMLElement>("[data-testid=hero-v5]");
        const past = hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > window.innerHeight;
        const nearEnd = window.innerHeight + window.scrollY > document.body.scrollHeight - 700;
        setShow(past && !nearEnd);
        // Sit above the first-visit language chooser (also fixed to the bottom) instead of under it.
        const langBar = document.querySelector<HTMLElement>("[data-testid=language-onboarding-bar]");
        setBottomOffset(langBar ? Math.ceil(langBar.getBoundingClientRect().height) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const mo = new MutationObserver(onScroll);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      mo.disconnect();
    };
  }, []);

  // Signed-in merchants get the "Go to dashboard" bar from the public layout instead.
  if (authed) return null;

  return (
    <Box
      data-testid="sticky-mobile-cta"
      data-visible={show ? "true" : "false"}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        zIndex: 1400,
        display: { xs: "flex", md: "none" },
        gap: 1,
        px: 2,
        pt: 1.25,
        pb: "calc(10px + env(safe-area-inset-bottom))",
        // Phone-only bar: near-solid, NO backdrop-filter (iOS Safari compositor stall).
        background: s.dark ? "rgba(11,11,15,0.97)" : "rgba(250,250,247,0.98)",
        borderTop: `1px solid ${s.line}`,
        transform: show ? "translateY(0)" : "translateY(110%)",
        transition: "transform 240ms cubic-bezier(0.16,1,0.3,1), bottom 200ms ease",
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <PrimaryBtn small data-testid="sticky-start" onClick={() => goStart(router, "sticky")} sx={{ flex: 1.2 }}>{t("v5.sticky.start")}</PrimaryBtn>
      <SecondaryBtn small data-testid="sticky-demo" href="/pay/demo" sx={{ flex: 1 }}>{t("v5.sticky.demo")}</SecondaryBtn>
    </Box>
  );
};

export default memo(StickyMobileCta);
