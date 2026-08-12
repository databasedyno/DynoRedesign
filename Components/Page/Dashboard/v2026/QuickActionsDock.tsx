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
import { Reorder } from "framer-motion";
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
}> = ({ id, colors, label, suppressClickRef }) => {
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
          flexShrink: 0,
        }}
      >
        <Icon name={s.icon} size={18} />
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

  // ── Customize dialog state ──────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(DEFAULT_SLUGS);
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
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
  const tileColors: TileColors = { border, indigo, indigoGlow, inkPrimary, isDark };

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
        <Tooltip title={t("qaCustomize", { defaultValue: "Customize" })} arrow>
          <IconButton
            size="small"
            onClick={openDialog}
            data-testid="dash2026-qa-customize"
            aria-label={t("qaCustomize", { defaultValue: "Customize" })}
            sx={{
              width: 28,
              height: 28,
              color: inkMuted,
              "&:hover": { color: indigo, backgroundColor: indigoGlow },
            }}
          >
            <Icon name="pencil" size={15} />
          </IconButton>
        </Tooltip>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          suppressClickRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 80);
        }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}>
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
                />
              );
            })}
          </Box>
        </SortableContext>
      </DndContext>

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
          <CustomButton
            label={t("qaReset", { defaultValue: "Reset to default" })}
            variant="outlined"
            size="small"
            data-testid="dash2026-qa-reset"
            onClick={() => setDraft(DEFAULT_SLUGS)}
          />
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
