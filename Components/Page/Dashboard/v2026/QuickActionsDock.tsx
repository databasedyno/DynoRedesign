import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  useTheme,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import { Reorder, motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import axios from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { getSuggestedShortcuts } from "@/helpers/shortcutUsage";
import { Icon } from "@/styles/uiKit";
import { UserAction, USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import CustomButton from "@/Components/UI/Buttons";

/**
 * Canonical catalog of pinnable dashboard shortcuts. `id` MUST stay in sync
 * with the backend ALLOWED_QUICK_ACTIONS list (userController.ts).
 */
interface CatalogItem {
  id: string;
  icon: string;
  href: string;
  key: string;
  def: string;
}

const CATALOG: CatalogItem[] = [
  { id: "create-paylink", icon: "circle-plus", href: "/create-pay-link", key: "qaCatCreatePaylink", def: "Create payment link" },
  { id: "paylinks", icon: "link", href: "/pay-links", key: "qaShortcutPayLinks", def: "Payment links" },
  { id: "invoice", icon: "receipt-text", href: "/invoices", key: "qaShortcutInvoice", def: "Create invoice" },
  { id: "wallet", icon: "wallet", href: "/wallet", key: "qaShortcutWallet", def: "Open wallet" },
  { id: "transactions", icon: "arrow-left-right", href: "/transactions", key: "qaCatTransactions", def: "Transactions" },
  { id: "creator", icon: "store", href: "/creator", key: "qaShortcutCreator", def: "Creator page" },
  { id: "products", icon: "package", href: "/pay-links/products", key: "qaCatProducts", def: "Products" },
  { id: "fees", icon: "percent", href: "/fees", key: "qaCatFees", def: "Fees & tiers" },
  { id: "api", icon: "code", href: "/developer-keys", key: "qaCatApi", def: "Developer / API" },
  { id: "referrals", icon: "gift", href: "/referrals", key: "qaCatReferrals", def: "Referrals" },
];

const CATALOG_BY_ID: Record<string, CatalogItem> = CATALOG.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<string, CatalogItem>,
);

const DEFAULT_SLUGS = ["paylinks", "invoice", "wallet", "creator"];

interface TileColors {
  border: string;
  indigo: string;
  indigoGlow: string;
  inkPrimary: string;
  isDark: boolean;
  /** Badge tones (see TileBadge.tone). */
  attention: string;
  critical: string;
  /** Tile surface, used as the badge's outer ring so the pill reads as "floating". */
  surface: string;
}

/**
 * A tiny live count rendered on the top-right of a tile's icon. Only ever shown
 * when count > 0 — a merchant with nothing outstanding sees a clean dock.
 *
 * tone:
 *  - critical  → something is actively broken/blocking (a live product nobody can buy)
 *  - attention → something is waiting on the merchant (unpaid invoice, pending payment)
 *  - info      → neutral "how many" (active payment links)
 */
interface TileBadge {
  count: number;
  tone: "critical" | "attention" | "info";
  /** Human sentence used for the native tooltip AND screen readers. */
  title: string;
}

/** Response payload of GET /api/dashboard/action-counts. */
interface ActionCounts {
  transactions_pending: number;
  paylinks_active: number;
  paylinks_expired: number;
  products_out_of_stock: number;
  referrals_pending: number;
}

/**
 * A single Quick Action tile that is BOTH a navigable Next <Link> AND a
 * dnd-kit sortable item. Tap navigates; press-and-hold (long-press on mobile)
 * then drag reorders. A shared `suppressClickRef` cancels the navigation click
 * that would otherwise fire at the end of a hold/drag gesture.
 */
const SortableTile: React.FC<{
  id: string;
  colors: TileColors;
  label: string;
  suppressClickRef: React.MutableRefObject<boolean>;
  badge?: TileBadge | null;
}> = ({ id, colors, label, suppressClickRef, badge }) => {
  const s = CATALOG_BY_ID[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  if (!s) return null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 3 : 1,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      component={Link}
      href={s.href}
      data-testid={`dash2026-qa-${s.id}`}
      {...attributes}
      {...listeners}
      onClick={(e: React.MouseEvent) => {
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={style}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: 1.5,
        borderRadius: "14px",
        textDecoration: "none",
        border: `1px solid ${isDragging ? colors.indigo : colors.border}`,
        cursor: isDragging ? "grabbing" : "pointer",
        outline: "none",
        touchAction: "manipulation",
        backgroundColor: isDragging
          ? colors.isDark
            ? "rgba(255,255,255,0.03)"
            : "#fff"
          : "transparent",
        boxShadow: isDragging
          ? "0 12px 30px -10px rgba(10,10,25,0.35)"
          : "none",
        transition:
          "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
        "&:hover, &:focus-visible": {
          borderColor: colors.indigo,
          backgroundColor: colors.isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)",
        },
      }}
    >
      <Box sx={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.indigo,
            backgroundColor: colors.indigoGlow,
          }}
        >
          <Icon name={s.icon} size={18} />
        </Box>

        {/* Action badge — live "needs attention" count. Rendered only when > 0.
            No onClick of its own: pointer events bubble to the parent tile so a
            tap still navigates and a press-and-hold still starts a drag. */}
        {badge && badge.count > 0 && (
          <Box
            data-testid={`dash2026-qa-badge-${s.id}`}
            title={badge.title}
            aria-label={badge.title}
            sx={{
              position: "absolute",
              top: -5,
              right: -6,
              minWidth: 18,
              height: 18,
              px: 0.5,
              borderRadius: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: "#fff",
              backgroundColor:
                badge.tone === "critical"
                  ? colors.critical
                  : badge.tone === "attention"
                    ? colors.attention
                    : colors.indigo,
              border: `2px solid ${colors.surface}`,
              boxShadow: "0 2px 6px -1px rgba(10,10,25,0.35)",
            }}
          >
            {badge.count > 99 ? "99+" : badge.count}
          </Box>
        )}
      </Box>
      <Box
        sx={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: 1.2,
          color: colors.inkPrimary,
        }}
      >
        {label}
      </Box>
    </Box>
  );
};

/**
 * QuickActionsDock — a compact 2×2 tile grid of the merchant's most-used
 * destinations. Tiles can be dragged directly on the dashboard to reorder
 * (long-press on mobile), and merchants can pick WHICH 4 + reorder via the
 * "Customize" (pencil) dialog. Picks + order persist to their account
 * (PUT /api/user/dashboard-quick-actions).
 */
const QuickActionsDock: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const profile = useSelector((s: any) => s?.userReducer?.profile);
  const saved = profile?.dashboard_quick_actions;

  // ── Action badges ────────────────────────────────────────────────────────
  // Live "needs attention" counts for the tiles. Fetched ONCE per company when
  // the dashboard mounts (no polling — these are cheap but they still hit the
  // production DB, and the backend already Redis-caches them for 60s).
  // Badges are purely additive: any failure is swallowed so a hiccup here can
  // never break or block the dock itself.
  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const [counts, setCounts] = useState<ActionCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("dashboard/action-counts", {
          params: selectedCompanyId ? { company_id: selectedCompanyId } : {},
        });
        const data = (res?.data?.data ?? res?.data) as ActionCounts | undefined;
        if (!cancelled && data && typeof data === "object") setCounts(data);
      } catch {
        /* badges are optional garnish — never surface an error for them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  /**
   * Map a catalog id to its badge. Only tiles where a number is genuinely
   * actionable get one — the rest deliberately stay bare so the badges keep
   * their meaning ("this needs me") instead of becoming decoration.
   */
  const badgeFor = (id: string): TileBadge | null => {
    if (!counts) return null;

    switch (id) {
      // NOTE: the "invoice" tile deliberately has NO badge. In DynoPay an invoice
      // is a RECEIPT, not a receivable — rows are auto-generated only after a
      // transaction settles, and the UI hardcodes a "Paid" pill for every one of
      // them. An "unpaid invoices" count would be permanently wrong. The real
      // receivable signal lives on the paylinks tile (expired-unpaid links).
      case "transactions": {
        const count = counts.transactions_pending;
        return count > 0
          ? {
              count,
              tone: "attention",
              title: t("qaBadgeTransactionsPending", {
                count,
                defaultValue_one: "1 payment still pending",
                defaultValue_other: "{{count}} payments still pending",
              }),
            }
          : null;
      }
      case "paylinks": {
        const count = counts.paylinks_active;
        if (count <= 0) return null;
        const expired = counts.paylinks_expired;
        return {
          count,
          tone: "info",
          title:
            expired > 0
              ? t("qaBadgePaylinksActiveWithExpired", {
                  count,
                  expired,
                  defaultValue_one: "1 active payment link · {{expired}} expired unpaid",
                  defaultValue_other: "{{count}} active payment links · {{expired}} expired unpaid",
                })
              : t("qaBadgePaylinksActive", {
                  count,
                  defaultValue_one: "1 active payment link",
                  defaultValue_other: "{{count}} active payment links",
                }),
        };
      }
      case "products": {
        const count = counts.products_out_of_stock;
        return count > 0
          ? {
              count,
              tone: "critical",
              title: t("qaBadgeProductsOutOfStock", {
                count,
                defaultValue_one: "1 live product is out of stock",
                defaultValue_other: "{{count}} live products are out of stock",
              }),
            }
          : null;
      }
      case "referrals": {
        const count = counts.referrals_pending;
        return count > 0
          ? {
              count,
              tone: "attention",
              title: t("qaBadgeReferralsPending", {
                count,
                defaultValue_one: "1 referral reward pending",
                defaultValue_other: "{{count}} referral rewards pending",
              }),
            }
          : null;
      }
      default:
        return null;
    }
  };

  const pinned = useMemo(() => {
    const arr = Array.isArray(saved)
      ? saved.map(String).filter((id) => CATALOG_BY_ID[id])
      : [];
    return arr.length === 4 ? arr : DEFAULT_SLUGS;
  }, [saved]);

  // Live order for the dashboard grid (drag-to-reorder). Stays in sync with the
  // saved order whenever the profile changes.
  const [order, setOrder] = useState<string[]>(pinned);
  const pinnedKey = pinned.join(",");
  useEffect(() => {
    setOrder(pinned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedKey]);

  const suppressClickRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  const persistOrder = async (next: string[]) => {
    try {
      await axios.put("user/dashboard-quick-actions", { actions: next });
      dispatch(UserAction(USER_PROFILE_FETCH));
    } catch (e: any) {
      setOrder(pinned); // revert
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            e?.response?.data?.message ||
            t("qaReorderFailed", { defaultValue: "Couldn't save the new order" }),
          severity: "error",
        },
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // Suppress the navigation click that fires right after a hold/drag.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 80);
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        persistOrder(next);
        return next;
      });
    }
  };

  // ── One-time onboarding hints (per-device via localStorage) ─────────────
  const SPOTLIGHT_KEY = "dp_qa_customize_spotlight_v1";
  const REORDER_HINT_KEY = "dp_qa_reorder_hint_v1";
  const lsGet = (k: string) => {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
    } catch {
      return null;
    }
  };
  const lsSet = (k: string, v: string) => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [reorderHintOpen, setReorderHintOpen] = useState(false);
  const reorderHintSeenRef = useRef(true);

  const dismissSpotlight = () => {
    setSpotlightOpen(false);
    lsSet(SPOTLIGHT_KEY, "1");
  };

  const maybeShowReorderHint = () => {
    if (reorderHintSeenRef.current || spotlightOpen) return;
    reorderHintSeenRef.current = true;
    lsSet(REORDER_HINT_KEY, "1");
    setReorderHintOpen(true);
    setTimeout(() => setReorderHintOpen(false), 3500);
  };

  useEffect(() => {
    reorderHintSeenRef.current = Boolean(lsGet(REORDER_HINT_KEY));
    if (!lsGet(SPOTLIGHT_KEY)) {
      setSpotlightOpen(true);
      const timer = setTimeout(() => dismissSpotlight(), 8000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Smart suggested shortcuts ───────────────────────────────────────────
  // Which pages does this merchant actually live in? Route visits are counted
  // locally (helpers/shortcutUsage — localStorage, no request, no DB write) and
  // the top 4 are offered as their dock in one tap. Only appears once there is
  // real signal (8+ visits) and the suggestion differs from what's pinned; the
  // dismissal is remembered per device so it never nags.
  const SUGGEST_DISMISS_KEY = "dp_qa_suggest_dismissed_v1";
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggestDismissed, setSuggestDismissed] = useState(true);

  useEffect(() => {
    setSuggested(getSuggestedShortcuts(4).filter((id) => CATALOG_BY_ID[id]));
    setSuggestDismissed(Boolean(lsGet(SUGGEST_DISMISS_KEY)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestionDiffers =
    suggested.length === 4 && suggested.some((id) => !order.includes(id));

  const dismissSuggestion = () => {
    setSuggestDismissed(true);
    lsSet(SUGGEST_DISMISS_KEY, "1");
  };

  const applySuggestion = () => {
    if (suggested.length !== 4) return;
    dismissSuggestion();
    setOrder(suggested);
    void persistOrder(suggested);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: t("qaSuggestApplied", {
          defaultValue: "Pinned the shortcuts you use most",
        }),
      },
    });
  };

  // ── Customize dialog state ──────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(DEFAULT_SLUGS);
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    dismissSpotlight();
    setReorderHintOpen(false);
    setDraft(order);
    setOpen(true);
  };

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (draft.length !== 4 || saving) return;
    setSaving(true);
    try {
      await axios.put("user/dashboard-quick-actions", { actions: draft });
      dispatch(UserAction(USER_PROFILE_FETCH));
      dispatch({
        type: TOAST_SHOW,
        payload: { message: t("qaSaved", { defaultValue: "Quick actions updated" }) },
      });
      setOpen(false);
    } catch (e: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            e?.response?.data?.message ||
            t("qaSaveFailed", { defaultValue: "Couldn't update quick actions" }),
          severity: "error",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const indigoGlow = isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow;
  const inkPrimary = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const inkMuted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const available = CATALOG.filter((c) => !draft.includes(c.id));
  const tileColors: TileColors = {
    border,
    indigo,
    indigoGlow,
    inkPrimary,
    isDark,
    attention: theme.palette.warning.main,
    critical: theme.palette.error.main,
    surface: theme.palette.background.paper,
  };

  const sectionLabelSx = {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: inkMuted,
  };
  const iconBadgeSx = {
    width: 30,
    height: 30,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <SurfaceCard
      data-testid="dash2026-quick-actions"
      sx={{ display: "flex", flexDirection: "column", gap: 2, p: { xs: 2.25, md: 2.5 } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>{t("quickActions", { defaultValue: "Quick actions" })}</Eyebrow>
        <Tooltip
          open={spotlightOpen}
          title={t("qaSpotlight", { defaultValue: "Personalize & reorder your shortcuts" })}
          arrow
          placement="left"
          slotProps={{ tooltip: { sx: { fontSize: 12.5, fontWeight: 600, px: 1.5, py: 1 } } }}
        >
          <Box sx={{ position: "relative", display: "inline-flex" }} data-testid="dash2026-qa-spotlight">
            {spotlightOpen && (
              <Box
                component={motion.span}
                aria-hidden
                animate={{
                  boxShadow: [
                    `0 0 0 0 ${isDark ? "rgba(129,140,248,0.5)" : "rgba(79,70,229,0.4)"}`,
                    `0 0 0 9px ${isDark ? "rgba(129,140,248,0)" : "rgba(79,70,229,0)"}`,
                  ],
                }}
                transition={{ duration: 1.7, repeat: Infinity, ease: "easeOut" }}
                sx={{ position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none" }}
              />
            )}
            <IconButton
              size="small"
              onClick={openDialog}
              data-testid="dash2026-qa-customize"
              aria-label={t("qaCustomize", { defaultValue: "Customize" })}
              sx={{
                width: 28,
                height: 28,
                color: spotlightOpen ? indigo : inkMuted,
                backgroundColor: spotlightOpen ? indigoGlow : "transparent",
                "&:hover": { color: indigo, backgroundColor: indigoGlow },
              }}
            >
              <Icon name="pencil" size={15} />
            </IconButton>
          </Box>
        </Tooltip>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          suppressClickRef.current = true;
          setReorderHintOpen(false);
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 80);
        }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <Tooltip
            open={reorderHintOpen}
            title={t("qaReorderHint", { defaultValue: "Hold & drag to reorder" })}
            placement="top"
            arrow
            slotProps={{ tooltip: { sx: { fontSize: 12.5, fontWeight: 600, px: 1.5, py: 1 } } }}
          >
            <Box
              onMouseEnter={maybeShowReorderHint}
              sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}
            >
              {order.map((id) => {
                const c = CATALOG_BY_ID[id];
                if (!c) return null;
                return (
                  <SortableTile
                    key={id}
                    id={id}
                    colors={tileColors}
                    label={t(c.key, { defaultValue: c.def })}
                    suppressClickRef={suppressClickRef}
                    badge={badgeFor(id)}
                  />
                );
              })}
            </Box>
          </Tooltip>
        </SortableContext>
      </DndContext>

      {/* Smart suggestion — "pin what you actually use" */}
      {!suggestDismissed && suggestionDiffers && !open && (
        <Box
          data-testid="dash2026-qa-suggestion"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 1.25,
            borderRadius: "12px",
            border: `1px dashed ${indigo}`,
            backgroundColor: indigoGlow,
          }}
        >
          <Box sx={{ display: "flex", color: indigo, flexShrink: 0 }}>
            <Icon name="sparkles" size={15} />
          </Box>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.35,
              color: inkPrimary,
            }}
          >
            {t("qaSuggestTitle", {
              defaultValue: "Pin the 4 pages you open most?",
            })}
          </Box>
          <Box
            role="button"
            tabIndex={0}
            data-testid="dash2026-qa-suggest-apply"
            onClick={applySuggestion}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applySuggestion();
              }
            }}
            sx={{
              flexShrink: 0,
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              cursor: "pointer",
              outline: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: indigo,
              "&:hover, &:focus-visible": { filter: "brightness(1.08)" },
            }}
          >
            {t("qaSuggestApply", { defaultValue: "Use these" })}
          </Box>
          <IconButton
            size="small"
            data-testid="dash2026-qa-suggest-dismiss"
            aria-label={t("qaSuggestDismiss", { defaultValue: "Not now" })}
            onClick={dismissSuggestion}
            sx={{ width: 24, height: 24, color: inkMuted, flexShrink: 0 }}
          >
            <Icon name="x" size={13} />
          </IconButton>
        </Box>
      )}

      {/* Customize dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        data-testid="dash2026-qa-dialog"
        PaperProps={{ sx: { borderRadius: "18px" } }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: inkPrimary }}>
            {t("qaCustomizeTitle", { defaultValue: "Customize quick actions" })}
          </Box>
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: inkMuted, mt: 0.5 }}>
            {t("qaCustomizeSubtitle2", { defaultValue: "Pick 4 shortcuts and drag to reorder." })}{" "}
            <Box component="span" data-testid="dash2026-qa-count" sx={{ color: indigo, fontWeight: 600 }}>
              {draft.length}/4
            </Box>
          </Box>
        </Box>

        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ ...sectionLabelSx, mb: 1 }}>
            {t("qaPinnedLabel", { defaultValue: "Your shortcuts · drag to reorder" })}
          </Box>
          <Reorder.Group
            axis="y"
            values={draft}
            onReorder={setDraft}
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
          >
            {draft.map((id) => {
              const c = CATALOG_BY_ID[id];
              if (!c) return null;
              return (
                <Reorder.Item
                  key={id}
                  value={id}
                  as="div"
                  data-testid={`dash2026-qa-pinned-${id}`}
                  whileDrag={{ scale: 1.02 }}
                  style={{ listStyle: "none" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: "12px",
                      border: `1px solid ${indigo}`,
                      backgroundColor: indigoGlow,
                      cursor: "grab",
                      userSelect: "none",
                      touchAction: "none",
                      "&:active": { cursor: "grabbing" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", color: inkMuted, flexShrink: 0 }}>
                      <Icon name="grip-vertical" size={16} />
                    </Box>
                    <Box sx={{ ...iconBadgeSx, color: indigo }}>
                      <Icon name={c.icon} size={16} />
                    </Box>
                    <Box sx={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: inkPrimary }}>
                      {t(c.key, { defaultValue: c.def })}
                    </Box>
                    <IconButton
                      size="small"
                      data-testid={`dash2026-qa-remove-${id}`}
                      aria-label={t("qaRemove", { defaultValue: "Remove" })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggle(id)}
                      sx={{ width: 26, height: 26, color: inkMuted, "&:hover": { color: theme.palette.error.main } }}
                    >
                      <Icon name="x" size={15} />
                    </IconButton>
                  </Box>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          {available.length > 0 && draft.length < 4 && (
            <>
              <Box sx={{ ...sectionLabelSx, mt: 2.5, mb: 1 }}>
                {t("qaAddLabel", { defaultValue: "Add a shortcut" })} · {4 - draft.length}{" "}
                {t("qaAddLeft", { defaultValue: "left" })}
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {available.map((c) => (
                  <Box
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`dash2026-qa-add-${c.id}`}
                    onClick={() => toggle(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggle(c.id);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: "12px",
                      border: `1px solid ${border}`,
                      cursor: "pointer",
                      outline: "none",
                      transition: "border-color 140ms ease, background-color 140ms ease",
                      "&:hover, &:focus-visible": {
                        borderColor: indigo,
                        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)",
                      },
                    }}
                  >
                    <Box sx={{ ...iconBadgeSx, color: inkMuted, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.03)" }}>
                      <Icon name={c.icon} size={16} />
                    </Box>
                    <Box sx={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: inkPrimary }}>
                      {t(c.key, { defaultValue: c.def })}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", color: indigo, flexShrink: 0 }}>
                      <Icon name="plus" size={16} />
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <CustomButton
              label={t("qaReset", { defaultValue: "Reset to default" })}
              variant="outlined"
              size="small"
              data-testid="dash2026-qa-reset"
              onClick={() => setDraft(DEFAULT_SLUGS)}
            />
            {suggested.length === 4 && (
              <CustomButton
                label={t("qaUseSuggested", { defaultValue: "Use most visited" })}
                variant="outlined"
                size="small"
                data-testid="dash2026-qa-suggest-dialog-apply"
                onClick={() => setDraft(suggested)}
              />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CustomButton
              label={t("cancel", { defaultValue: "Cancel", ns: "common" })}
              variant="outlined"
              size="small"
              onClick={() => setOpen(false)}
            />
            <CustomButton
              label={saving ? t("saving", { defaultValue: "Saving…" }) : t("save", { defaultValue: "Save", ns: "common" })}
              variant="primary"
              size="small"
              data-testid="dash2026-qa-save"
              disabled={draft.length !== 4 || saving}
              onClick={handleSave}
            />
          </Box>
        </DialogActions>
      </Dialog>
    </SurfaceCard>
  );
};

export default QuickActionsDock;
