import useIsMobile from "@/hooks/useIsMobile";
import { Box } from "@mui/material";
import i18n from "i18next";
import Image from "next/image";
import {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  CheckIconBox,
  DropdownContainer,
  DropdownHeader,
  DropdownListItem,
  ExpandIconBox,
  HeaderDivider,
  HeaderRight,
  HeaderSelectedLeft,
  LangCode,
  LangTextDesktop,
  LangTextMobile,
  ListItemLeft,
  TriggerBox,
  TriggerDivider,
  TriggerLeft,
  TriggerRight,
  WrapperBox,
} from "./styled";

import ExpandLessIcon from "@/assets/Icons/ExpendLess-Arrow.svg";
import ExpandMoreIcon from "@/assets/Icons/ExpendMore-Arrow.svg";
import CheckIcon from "@/assets/Icons/true-icon.svg";
import { LANGUAGES, languageFor, type AppLanguage, type LanguageCode } from "@/helpers/languages";

/* ===================== TYPES ===================== */

type Props = Readonly<{
  showBig?: boolean;
}>;

/* ===================== COMPONENT ===================== */

function LanguageSwitcher({ showBig = false }: Props) {
  const isMobile = useIsMobile("md");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { i18n: i18nInstance, t } = useTranslation("common"); // Subscribe to language changes for re-render

  const [isOpen, setIsOpen] = useState<boolean>(false);
  // Which side the 196px dropdown expands toward. Default right-aligned (menu
  // grows left) — correct when the trigger sits near the right edge (headers).
  // Recomputed on open: if right-alignment would clip off the LEFT viewport
  // edge (e.g. the login page, where the switcher sits near the left), and
  // left-alignment fits, flip to left-aligned so the menu grows right instead.
  const [alignRight, setAlignRight] = useState<boolean>(true);

  const computeAlign = useCallback(() => {
    if (typeof window === "undefined") return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const MENU_W = 196;
    const PAD = 8;
    // Constrain the menu to the nearest ancestor that CLIPS overflow (e.g. a
    // narrow right-anchored drawer on the checkout page). Previously we only
    // checked the viewport edges, so a right-aligned menu could spill past the
    // LEFT edge of a 240px drawer and get clipped by it — leaving only the last
    // couple of letters of each language name visible (iPhone report 2026-07).
    let leftBound = 0;
    let rightBound = window.innerWidth;
    let node: HTMLElement | null = wrapperRef.current?.parentElement ?? null;
    while (node) {
      const cs = window.getComputedStyle(node);
      const ox = cs.overflowX;
      if (ox === "hidden" || ox === "auto" || ox === "scroll") {
        const b = node.getBoundingClientRect();
        leftBound = Math.max(leftBound, b.left);
        rightBound = Math.min(rightBound, b.right);
        break; // nearest clipping ancestor is the binding constraint
      }
      node = node.parentElement;
    }
    // Right-aligned menu occupies [rect.right - MENU_W, rect.right].
    const fitsRight = rect.right - MENU_W >= leftBound + PAD;
    // Left-aligned menu occupies [rect.left, rect.left + MENU_W].
    const fitsLeft = rect.left + MENU_W <= rightBound - PAD;
    // Prefer right-alignment (header default); flip to left only when a
    // right-aligned menu would clip AND a left-aligned one actually fits.
    setAlignRight(fitsRight || !fitsLeft);
  }, []);

  const current = (i18nInstance.language || i18n.language || "en").split("-")[0];
  const selected = useMemo<AppLanguage>(() => languageFor(current), [current]);
  // Desktop / big: flag + the language's own name. Tight mobile chrome: flag + code.
  const compact = isMobile && !showBig;

  const Text = showBig
    ? LangTextDesktop
    : isMobile
      ? LangTextMobile
      : LangTextDesktop;

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const changeLang = useCallback(
    async (lng: LanguageCode) => {
      if (lng === current) {
        close();
        return;
      }
      const { setAppLanguage } = await import("@/helpers/setAppLanguage");
      await setAppLanguage(lng);
      close();
    },
    [close, current],
  );

  const onTriggerClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      computeAlign();
      toggle();
    },
    [toggle, computeAlign],
  );

  const onKeyActivate = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        computeAlign();
        toggle();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    },
    [close, toggle, computeAlign],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const root = wrapperRef.current;
      const target = event.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [close, isOpen]);

  return (
    <WrapperBox ref={wrapperRef}>
      <TriggerBox
        onClick={onTriggerClick}
        onKeyDown={onKeyActivate}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t("language.change")} · ${selected.name}`}
        title={selected.name}
        data-testid="language-trigger"
        data-current-lang={selected.code}
        sx={{
          height: showBig ? 40 : isMobile ? 28 : 40,
          minWidth: compact ? 78 : 111,
          padding: showBig ? "10px 13px" : isMobile ? "7px 8px" : "10px 13px",
          gap: showBig ? "14px" : isMobile ? "10px" : "14px",
        }}
      >
        <TriggerLeft>
          <Image
            src={selected.flag}
            alt=""
            width={showBig ? 20 : isMobile ? 14 : 20}
            height={showBig ? 20 : isMobile ? 14 : 20}
            draggable={false}
            style={{ borderRadius: "50%" }}
          />
          <Text data-testid="language-trigger-label" sx={{ whiteSpace: "nowrap" }}>
            {compact ? selected.code.toUpperCase() : selected.name}
          </Text>
        </TriggerLeft>

        <TriggerRight>
          <TriggerDivider sx={{ height: showBig ? 16 : isMobile ? 10 : 16 }} />

          <ExpandIconBox>
            <Image
              src={isOpen ? ExpandLessIcon : ExpandMoreIcon}
              alt="expand"
              width={showBig ? 11 : isMobile ? 7 : 11}
              height={showBig ? 6 : isMobile ? 4 : 6}
              draggable={false}
            />
          </ExpandIconBox>
        </TriggerRight>
      </TriggerBox>

      {isOpen && (
        <DropdownContainer
          data-testid="language-dropdown"
          sx={{
            left: alignRight ? "auto" : 0,
            right: alignRight ? 0 : "auto",
          }}
        >
          <DropdownHeader
            onClick={close}
            onKeyDown={onKeyActivate}
            role="button"
            tabIndex={0}
            aria-label={t("language.closeMenu")}
          >
            <HeaderSelectedLeft>
              <Image
                src={selected.flag}
                alt=""
                width={16}
                height={16}
                draggable={false}
                unoptimized
                style={{ borderRadius: "50%" }}
              />
              <LangTextDesktop sx={{ whiteSpace: "nowrap" }}>{selected.name}</LangTextDesktop>
            </HeaderSelectedLeft>

            <HeaderRight>
              <HeaderDivider />
              <ExpandIconBox>
                <Image
                  src={ExpandLessIcon}
                  alt="expand"
                  width={showBig ? 11 : isMobile ? 7 : 11}
                  height={showBig ? 6 : isMobile ? 4 : 6}
                  draggable={false}
                />
              </ExpandIconBox>
            </HeaderRight>
          </DropdownHeader>

          <Box role="listbox" aria-label={t("language.options")}>
            {LANGUAGES.map((lng) => {
              const isSelected = lng.code === current;

              return (
                <DropdownListItem
                  key={lng.code}
                  role="option"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${lng.name} (${lng.english})`}
                  data-selected={isSelected ? "true" : "false"}
                  data-testid={`language-option-${lng.code}`}
                  data-lang={lng.code}
                  onClick={() => changeLang(lng.code)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      changeLang(lng.code);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                    }
                  }}
                >
                  <ListItemLeft>
                    <Image
                      src={lng.flag}
                      alt=""
                      width={18}
                      height={18}
                      draggable={false}
                      unoptimized
                      style={{ borderRadius: "50%" }}
                    />
                    <LangTextDesktop>{lng.name}</LangTextDesktop>
                  </ListItemLeft>

                  <CheckIconBox>
                    {isSelected ? (
                      <Image
                        src={CheckIcon}
                        alt="check"
                        width={11}
                        height={8}
                        draggable={false}
                      />
                    ) : (
                      <LangCode>{lng.code.toUpperCase()}</LangCode>
                    )}
                  </CheckIconBox>
                </DropdownListItem>
              );
            })}
          </Box>
        </DropdownContainer>
      )}
    </WrapperBox>
  );
}

export default memo(LanguageSwitcher);
