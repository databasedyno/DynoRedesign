// Coinbase-style language control: a globe button + current language code that
// opens a compact dropdown panel. Reused in BOTH the header (opens downward,
// hidden on mobile) and the footer (opens upward, visible on all sizes).
// Self-contained so the shared LanguageSwitcher (auth/checkout surfaces) is
// untouched. Language-change side effects mirror that component: lazy-load the
// bundle, persist to localStorage, and sync to the merchant profile (only when
// signed in AND not on a checkout surface).
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { Box } from "@mui/material";
import i18n from "i18next";
import Image from "next/image";
import { useRouter } from "next/router";
import { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

import { LANGUAGES, languageFor, type AppLanguage, type LanguageCode } from "@/helpers/languages";

import {
  CORAL,
  LangGlobeButton,
  LangOption,
  LangOptionCode,
  LangOptionLabel,
  LangPanel,
  LangWrap,
} from "./styled";

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
  const { i18n: i18nInstance, t } = useTranslation("common");
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const current = (i18nInstance.language || i18n.language || "en").split("-")[0];
  const selected = useMemo<AppLanguage>(() => languageFor(current), [current]);

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
      const { setAppLanguage } = await import("@/helpers/setAppLanguage");
      await setAppLanguage(lng);
      // Reflect the locale in the URL (?lang=xx) so the canonical/hreflang and a
      // shared link match the language on screen. Shallow → no full reload.
      const nextQuery = { ...router.query } as Record<string, string>;
      if (lng === "en") delete nextQuery.lang;
      else nextQuery.lang = lng;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
        scroll: false,
      });
      close();
    },
    [close, current, router],
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
        aria-label={`${t("language.change")} · ${selected.name}`}
        title={selected.name}
        data-testid={`${idPrefix}-language-globe`}
        data-current-lang={selected.code}
        data-compact={hideOnMobile ? "true" : undefined}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Image
          className="lang-flag"
          src={selected.flag}
          alt=""
          width={20}
          height={20}
          draggable={false}
          unoptimized
          data-testid={`${idPrefix}-language-flag`}
        />
        <span className="lang-name" data-testid={`${idPrefix}-language-name`}>{selected.name}</span>
        <KeyboardArrowDownRoundedIcon
          className="lang-chev"
          sx={{
            fontSize: 16,
            transition: "transform 220ms ease",
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        />
      </LangGlobeButton>

      {isOpen && (
        <LangPanel role="listbox" aria-label={t("language.options")} data-testid={`${idPrefix}-language-panel`} sx={panelSx}>
          {LANGUAGES.map((lng) => {
            const isSelected = lng.code === current;
            return (
              <LangOption
                key={lng.code}
                role="option"
                aria-selected={isSelected}
                aria-label={`${lng.name} (${lng.english})`}
                data-selected={isSelected ? "true" : "false"}
                data-testid={`${idPrefix}-lang-${lng.code}`}
                data-lang={lng.code}
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
                  <Image src={lng.flag} alt="" width={20} height={20} draggable={false} unoptimized />
                  <LangOptionLabel>{lng.name}</LangOptionLabel>
                </Box>
                {isSelected ? (
                  <CheckRoundedIcon sx={{ fontSize: 17, color: CORAL }} />
                ) : (
                  <LangOptionCode>{lng.code.toUpperCase()}</LangOptionCode>
                )}
              </LangOption>
            );
          })}
        </LangPanel>
      )}
    </LangWrap>
  );
}

export default memo(HeaderLangMenu);
