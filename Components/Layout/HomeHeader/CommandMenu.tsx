// Coinbase-style command menu (⌘K / search icon): a quick-jump overlay to
// search docs, products and marketing pages. Data comes from SEARCH_ENTRIES
// (derived from the same mega-menu model) so it stays in sync automatically.
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Modal, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { SEARCH_ENTRIES } from "./menuData";
import {
  CmdCard,
  CmdFooter,
  CmdGroupLabel,
  CmdInput,
  CmdInputRow,
  CmdItem,
  CmdResults,
} from "./styled";

const HEADER_OFFSET_PX = 100;

interface CommandMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function CommandMenu({ open, onClose }: CommandMenuProps) {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Resolve translated title + group once per render.
  const entries = useMemo(
    () => SEARCH_ENTRIES.map((e) => ({ ...e, title: t(e.titleKey), group: t(e.groupKey) })),
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.title.toLowerCase().includes(q) || e.group.toLowerCase().includes(q));
  }, [entries, query]);

  // Reset + focus when opened.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (activeIndex > filtered.length - 1) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      if (href.startsWith("/#")) {
        const id = href.slice(2);
        const scroll = () => {
          const el = document.getElementById(id);
          if (el) {
            const top = el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET_PX;
            window.scrollTo({ top, behavior: "smooth" });
          }
        };
        if (router.pathname === "/") scroll();
        else void router.push("/").then(() => setTimeout(scroll, 90));
        return;
      }
      void router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filtered[activeIndex];
        if (target) navigate(target.href);
      }
    },
    [filtered, activeIndex, navigate],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="command-menu-title"
      sx={{ zIndex: 1600, display: "flex", alignItems: "flex-start", justifyContent: "center" }}
      slotProps={{ backdrop: { sx: { backgroundColor: "rgba(9,9,14,0.55)", backdropFilter: "blur(3px)" } } }}
    >
      <Box sx={{ mt: { xs: "12vh", md: "14vh" }, outline: "none" }} data-testid="command-menu">
        <CmdCard>
          <CmdInputRow>
            <SearchRoundedIcon className="search-ic" />
            <CmdInput
              ref={inputRef}
              data-testid="command-input"
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              aria-label={t("search.placeholder")}
            />
          </CmdInputRow>

          <CmdResults>
            {filtered.length === 0 ? (
              <Typography
                sx={{
                  textAlign: "center",
                  py: 5,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "text.secondary",
                }}
              >
                {t("search.empty")}
              </Typography>
            ) : (
              filtered.map((entry, idx) => {
                const Icon = entry.Icon;
                const showGroup = idx === 0 || filtered[idx - 1].group !== entry.group;
                return (
                  <Box key={`${entry.titleKey}-${entry.href}`}>
                    {showGroup && <CmdGroupLabel>{entry.group}</CmdGroupLabel>}
                    <CmdItem
                      data-active={idx === activeIndex ? "true" : "false"}
                      data-testid={`cmd-item-${entry.titleKey}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => navigate(entry.href)}
                    >
                      <Box className="cmd-ic">
                        <Icon />
                      </Box>
                      <span className="cmd-title">{entry.title}</span>
                      <span className="cmd-group">{entry.group}</span>
                    </CmdItem>
                  </Box>
                );
              })
            )}
          </CmdResults>

          <CmdFooter>
            <span>
              <span className="kbd">↑↓</span>
              {t("search.hint")}
            </span>
            <span>
              <span className="kbd">Esc</span>
              {t("search.close")}
            </span>
          </CmdFooter>
        </CmdCard>
      </Box>
    </Modal>
  );
}

export default memo(CommandMenu);
