import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Popover, TextField, Typography, useTheme } from "@mui/material";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { useTranslation } from "react-i18next";

export interface OverflowTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  dirty?: boolean;
}

interface OverflowTabsProps {
  items: OverflowTabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Minimum tabs to keep on the strip (besides the active one). Default 1. */
  minVisible?: number;
  /** Show the search box in the dropdown once hidden count reaches this. Default 5. */
  searchThreshold?: number;
  ariaLabel?: string;
  /**
   * Per-tab data-testid prefix — a visible tab is `${itemTestIdPrefix}-${id}`.
   * Lets a surface keep its historical testids (e.g. "developers-tab") when it
   * adopts this component, so existing QA selectors keep resolving. Default
   * "overflow-tab" (so `overflow-tab-<id>` is unchanged for the settings roll-out).
   */
  itemTestIdPrefix?: string;
  /** data-testid for the strip container. Default "overflow-tabs". */
  containerTestId?: string;
}

const GAP = 8;

/**
 * A tab strip that collapses tabs that don't fit into a single "N more tabs…"
 * pill with a searchable dropdown. The active tab is always kept on the strip.
 * MUI-free pills (custom styled) + MUI Popover for the dropdown.
 */
const OverflowTabs = ({
  items,
  value,
  onChange,
  minVisible = 1,
  searchThreshold = 5,
  ariaLabel = "Sections",
  itemTestIdPrefix = "overflow-tab",
  containerTestId = "overflow-tabs",
}: OverflowTabsProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");

  const stripRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const widthsRef = useRef<Map<string, number>>(new Map());
  const pillWidthRef = useRef<number>(90);

  const [visibleIds, setVisibleIds] = useState<string[]>(items.map((i) => i.id));
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const byId = useMemo(() => {
    const m = new Map<string, OverflowTabItem>();
    items.forEach((i) => m.set(i.id, i));
    return m;
  }, [items]);

  const computeLayout = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const available = strip.clientWidth;
    if (!available) return;

    const w = (id: string) => widthsRef.current.get(id) || 120;
    const totalAll = ids.reduce((sum, id, k) => sum + w(id) + (k > 0 ? GAP : 0), 0);

    let visible: string[] = [];
    let hidden: string[] = [];

    if (totalAll <= available) {
      visible = [...ids];
    } else {
      const reserve = pillWidthRef.current + GAP;
      let used = 0;
      ids.forEach((id, k) => {
        const need = w(id) + (k > 0 ? GAP : 0);
        if (used + need + reserve <= available) {
          used += need;
          visible.push(id);
        } else {
          hidden.push(id);
        }
      });
    }

    // Phone-first fallback: very narrow + many tabs => just the active pill.
    if (typeof window !== "undefined" && window.innerWidth < 480 && ids.length > 3) {
      const keep = ids.includes(value) ? value : ids[0];
      visible = [keep];
      hidden = ids.filter((id) => id !== keep);
    }

    if (visible.length === 0 && ids.length) {
      visible = [ids[0]];
      hidden = ids.slice(1);
    }

    // The active tab must never hide inside the pill: swap it onto the strip.
    if (value && hidden.includes(value)) {
      if (visible.length > Math.max(1, minVisible - 1)) {
        const dropped = visible.pop() as string;
        hidden = hidden.filter((id) => id !== value).concat(dropped);
      } else {
        hidden = hidden.filter((id) => id !== value);
      }
      visible.push(value);
      hidden = ids.filter((id) => hidden.includes(id)); // restore original order
    }

    setVisibleIds((prev) => (prev.join("|") === visible.join("|") ? prev : visible));
    setHiddenIds((prev) => (prev.join("|") === hidden.join("|") ? prev : hidden));
  }, [ids, value, minVisible]);

  const measure = useCallback(() => {
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.querySelectorAll<HTMLElement>("[data-ghost-id]").forEach((n) => {
        const id = n.getAttribute("data-ghost-id");
        if (id) widthsRef.current.set(id, n.getBoundingClientRect().width);
      });
      const pill = ghost.querySelector<HTMLElement>("[data-ghost-pill]");
      if (pill) pillWidthRef.current = pill.getBoundingClientRect().width;
    }
    computeLayout();
  }, [computeLayout]);

  useLayoutEffect(() => {
    measure();
  }, [items, value, measure]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(strip);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    setQuery("");
    setActiveIndex(0);
    setAnchorEl(e.currentTarget);
  };
  const closeMenu = () => setAnchorEl(null);

  const select = (id: string) => {
    onChange(id);
    closeMenu();
  };

  const filteredHidden = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = hiddenIds.map((id) => byId.get(id)!).filter(Boolean);
    if (!q) return list;
    return list.filter((it) => it.label.toLowerCase().includes(q));
  }, [hiddenIds, byId, query]);

  useEffect(() => {
    if (activeIndex > filteredHidden.length - 1) setActiveIndex(0);
  }, [filteredHidden.length, activeIndex]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filteredHidden.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filteredHidden[activeIndex];
      if (it) select(it.id);
    } else if (e.key === "Escape") {
      closeMenu();
    }
  };

  const pillBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    px: "14px",
    borderRadius: "10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    userSelect: "none" as const,
    transition: "background-color 0.15s ease, color 0.15s ease",
    border: "none",
    background: "transparent",
  };

  const pillSx = (isActive: boolean) => ({
    ...pillBase,
    fontWeight: isActive ? 600 : 500,
    bgcolor: isActive ? (isDark ? "rgba(255,255,255,0.1)" : "#111214") : isDark ? "rgba(255,255,255,0.04)" : "#F1F2F5",
    color: isActive ? (isDark ? theme.palette.text.primary : "#FFFFFF") : theme.palette.text.secondary,
    "&:hover": {
      bgcolor: isActive ? (isDark ? "rgba(255,255,255,0.1)" : "#111214") : isDark ? "rgba(255,255,255,0.08)" : "#E7E8EE",
    },
  });

  const dirtyDot = (
    <Box
      component="span"
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        backgroundColor: isDark ? "#FFB74D" : "#E65100",
      }}
    />
  );

  const showSearch = hiddenIds.length >= searchThreshold;

  const renderPillContent = (it: OverflowTabItem) => (
    <>
      {it.icon}
      <span>{it.label}</span>
      {it.badge}
      {it.dirty && dirtyDot}
    </>
  );

  return (
    <Box sx={{ position: "relative", width: "100%", minWidth: 0 }}>
      <Box
        ref={stripRef}
        data-testid={containerTestId}
        role="tablist"
        aria-label={ariaLabel}
        sx={{ display: "flex", gap: `${GAP}px`, alignItems: "center", width: "100%", minWidth: 0, overflow: "hidden" }}
      >
        {visibleIds.map((id) => {
          const it = byId.get(id);
          if (!it) return null;
          const isActive = id === value;
          return (
            <Box
              key={id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              data-testid={`${itemTestIdPrefix}-${id}`}
              onClick={() => onChange(id)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(id);
                }
              }}
              sx={pillSx(isActive)}
            >
              {renderPillContent(it)}
            </Box>
          );
        })}

        {hiddenIds.length > 0 && (
          <Box
            role="button"
            tabIndex={0}
            data-testid="overflow-tabs-more"
            data-count={hiddenIds.length}
            aria-haspopup="menu"
            aria-expanded={Boolean(anchorEl)}
            onClick={openMenu}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openMenu(e as unknown as React.MouseEvent<HTMLElement>);
              }
            }}
            sx={{ ...pillSx(false), color: theme.palette.text.primary }}
          >
            <span>{t("tabs.moreCount", { count: hiddenIds.length, defaultValue: `${hiddenIds.length} more tabs…` })}</span>
            <KeyboardArrowDownRounded sx={{ fontSize: 16, opacity: 0.7 }} />
          </Box>
        )}
      </Box>

      {/* Hidden ghost strip for stable width measurement of every item + the pill. */}
      <Box
        ref={ghostRef}
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          visibility: "hidden",
          pointerEvents: "none",
          display: "flex",
          gap: `${GAP}px`,
          whiteSpace: "nowrap",
        }}
      >
        {items.map((it) => (
          <Box key={it.id} data-ghost-id={it.id} sx={pillSx(it.id === value)}>
            {renderPillContent(it)}
          </Box>
        ))}
        <Box data-ghost-pill sx={{ ...pillSx(false) }}>
          <span>{t("tabs.moreCount", { count: 9, defaultValue: "9 more tabs…" })}</span>
          <KeyboardArrowDownRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            "data-testid": "overflow-tabs-menu",
            onKeyDown: onMenuKeyDown,
            sx: {
              mt: 1,
              width: "min(320px, calc(100vw - 32px))",
              borderRadius: "12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
              overflow: "hidden",
            },
          } as any,
        }}
      >
        {showSearch && (
          <Box sx={{ p: 1, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }}>
            <TextField
              inputProps={{ "data-testid": "overflow-tabs-search", "aria-label": "Search tabs" }}
              autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
              size="small"
              fullWidth
              placeholder={t("tabs.searchPlaceholder", { defaultValue: "Search…" })}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
            />
          </Box>
        )}
        <Box sx={{ py: 0.5, maxHeight: 320, overflowY: "auto" }}>
          {filteredHidden.length === 0 ? (
            <Typography
              data-testid="overflow-tabs-empty"
              sx={{ px: 2, py: 1.5, fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
            >
              {t("tabs.noMatch", { defaultValue: "No tab matches" })}
            </Typography>
          ) : (
            filteredHidden.map((it, idx) => {
              const isActive = it.id === value;
              const isCursor = idx === activeIndex;
              return (
                <Box
                  key={it.id}
                  role="menuitem"
                  data-testid={`overflow-tabs-item-${it.id}`}
                  onClick={() => select(it.id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: 2,
                    py: 1.1,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: theme.palette.text.primary,
                    bgcolor: isCursor ? (isDark ? "rgba(255,255,255,0.06)" : "#F5F6F8") : "transparent",
                  }}
                >
                  {it.icon}
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.badge}
                  {it.dirty && dirtyDot}
                </Box>
              );
            })
          )}
        </Box>
      </Popover>
    </Box>
  );
};

export default OverflowTabs;
