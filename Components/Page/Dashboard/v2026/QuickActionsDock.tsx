import React, { useMemo, useState } from "react";
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
import { useRouter } from "next/router";
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

/**
 * QuickActionsDock — a compact 2×2 tile grid of the merchant's most-used
 * destinations, rendered as real Next <Link> anchors. Merchants can pin ANY
 * 4 shortcuts from the catalog via the "Customize" (pencil) button; the picks
 * persist to their account (PUT /api/user/dashboard-quick-actions).
 */
const QuickActionsDock: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
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

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(DEFAULT_SLUGS);
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setDraft(pinned);
    setOpen(true);
  };

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // enforce exactly 4
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

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}>
        {pinned.map((id) => {
          const s = CATALOG_BY_ID[id];
          if (!s) return null;
          return (
            <Box
              key={s.id}
              component={Link}
              href={s.href}
              data-testid={`dash2026-qa-${s.id}`}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: 1.5,
                borderRadius: "14px",
                textDecoration: "none",
                border: `1px solid ${border}`,
                cursor: "pointer",
                outline: "none",
                transition:
                  "transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
                "&:hover, &:focus-visible": {
                  transform: "translateY(-2px)",
                  borderColor: indigo,
                  backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)",
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
                  color: indigo,
                  backgroundColor: indigoGlow,
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
                  color: inkPrimary,
                }}
              >
                {t(s.key, { defaultValue: s.def })}
              </Box>
            </Box>
          );
        })}
      </Box>

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
            {t("qaCustomizeSubtitle", {
              defaultValue: "Pick exactly 4 shortcuts for your dashboard.",
            })}{" "}
            <Box component="span" data-testid="dash2026-qa-count" sx={{ color: indigo, fontWeight: 600 }}>
              {draft.length}/4
            </Box>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {CATALOG.map((c) => {
              const checked = draft.includes(c.id);
              const disabled = !checked && draft.length >= 4;
              return (
                <Box
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`dash2026-qa-option-${c.id}`}
                  onClick={() => !disabled && toggle(c.id)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) toggle(c.id);
                  }}
                  aria-pressed={checked}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: "12px",
                    border: `1px solid ${checked ? indigo : border}`,
                    backgroundColor: checked ? indigoGlow : "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.45 : 1,
                    outline: "none",
                    transition: "border-color 140ms ease, background-color 140ms ease",
                  }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: checked ? indigo : inkMuted,
                      backgroundColor: checked ? "transparent" : (isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.03)"),
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={c.icon} size={16} />
                  </Box>
                  <Box sx={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: inkPrimary }}>
                    {t(c.key, { defaultValue: c.def })}
                  </Box>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${checked ? indigo : border}`,
                      backgroundColor: checked ? indigo : "transparent",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {checked && <Icon name="check" size={13} color="#fff" />}
                  </Box>
                </Box>
              );
            })}
          </Box>
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
