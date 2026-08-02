// Coinbase-style language control: a globe button + current language code that
// opens a compact dropdown panel. Reused in BOTH the header (opens downward,
// hidden on mobile) and the footer (opens upward, visible on all sizes).
// Self-contained so the shared LanguageSwitcher (auth/checkout surfaces) is
// untouched. Language-change side effects mirror that component: lazy-load the
// bundle, persist to localStorage, and sync to the merchant profile (only when
// signed in AND not on a checkout surface).
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import { Box } from "@mui/material";
import i18n from "i18next";
import Image, { StaticImageData } from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";
import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";

import {
  CORAL,
  LangGlobeButton,
  LangOption,
  LangOptionLabel,
  LangPanel,
  LangWrap,
} from "./styled";

type LanguageCode = "en" | "pt" | "fr" | "es" | "de" | "nl";

interface Language {
  readonly code: LanguageCode;
  readonly label: string;
  readonly flag: StaticImageData;
}

const LANGUAGES: readonly Language[] = [
  { code: "en", label: "English", flag: unitedStatesFlag },
  { code: "pt", label: "Português", flag: portugalFlag },
  { code: "fr", label: "Français", flag: franceFlag },
  { code: "es", label: "Español", flag: spainFlag },
  { code: "de", label: "Deutsch", flag: germanyFlag },
  { code: "nl", label: "Nederlands", flag: netherlandsFlag },
] as const;

interface HeaderLangMenuProps {
  /** "bottom" (header, default) opens the panel downward; "top" (footer) upward. */
  readonly placement?: "top" | "bottom";
  /** Panel horizontal alignment relative to the globe. */
  readonly align?: "left" | "right";
  /** Hide the whole control below the md breakpoint (used in the header). */
  readonly hideOnMobile?: boolean;
  /** Prefix for data-testids so multiple instances (header + footer) are distinct. */
  readonly idPrefix?: string;
}

function HeaderLangMenu({
  placement = "bottom",
  align = "right",
  hideOnMobile = false,
  idPrefix = "header",
}: HeaderLangMenuProps) {
  const { i18n: i18nInstance } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const current = (i18nInstance.language || i18n.language || "en").split("-")[0];
  const selected = useMemo<Language>(
    () => LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0],
    [current],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const panelSx = useMemo(
    () => ({
      ...(placement === "top" ? { top: "auto", bottom: "calc(100% + 12px)" } : {}),
      ...(align === "left" ? { left: 0, right: "auto" } : { right: 0, left: "auto" }),
    }),
    [placement, align],
  );

  const changeLang = useCallback(
    async (lng: LanguageCode) => {
      if (lng === current) {
        close();
        return;
      }
      try {
        const { loadLanguageAsync } = await import("@/i18n");
        await loadLanguageAsync(lng);
      } catch {
        /* non-blocking: fall back to already-loaded bundle */
      }
      i18n.changeLanguage(lng);
      try {
        localStorage.setItem("lang", lng);
        localStorage.setItem("lang_manual", "true");
      } catch {
        /* private mode — ignore */
      }
      try {
        if (typeof window !== "undefined" && localStorage.getItem("token")) {
          const path = window.location.pathname || "";
          const isCheckoutSurface =
            path === "/pay" ||
            path.startsWith("/pay/") ||
            path.startsWith("/pay-links/") ||
            path.startsWith("/payment");
          if (!isCheckoutSurface) {
            const { default: axiosBaseApi } = await import("@/axiosConfig");
            axiosBaseApi.put("user/profile", { language: lng }).catch(() => {});
          }
        }
      } catch {
        /* best-effort profile sync — ignore */
      }
      close();
    },
    [close, current],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocClick = (e: globalThis.MouseEvent) => {
      const root = wrapperRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, isOpen]);

  return (
    <LangWrap
      ref={wrapperRef}
      sx={hideOnMobile ? { display: { xs: "none", md: "inline-flex" } } : undefined}
    >
      <LangGlobeButton
        disableRipple
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Change language"
        data-testid={`${idPrefix}-language-globe`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <LanguageRoundedIcon />
        {selected.code.toUpperCase()}
        <KeyboardArrowDownRoundedIcon
          sx={{
            fontSize: 16,
            transition: "transform 220ms ease",
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        />
      </LangGlobeButton>

      {isOpen && (
        <LangPanel role="listbox" aria-label="Language options" data-testid={`${idPrefix}-language-panel`} sx={panelSx}>
          {LANGUAGES.map((lng) => {
            const isSelected = lng.code === current;
            return (
              <LangOption
                key={lng.code}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected ? "true" : "false"}
                data-testid={`${idPrefix}-lang-${lng.code}`}
                tabIndex={0}
                onClick={() => changeLang(lng.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    changeLang(lng.code);
                  }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Image src={lng.flag} alt="" width={18} height={18} draggable={false} unoptimized />
                  <LangOptionLabel>{lng.label}</LangOptionLabel>
                </Box>
                {isSelected && <CheckRoundedIcon sx={{ fontSize: 17, color: CORAL }} />}
              </LangOption>
            );
          })}
        </LangPanel>
      )}
    </LangWrap>
  );
}

export default memo(HeaderLangMenu);
