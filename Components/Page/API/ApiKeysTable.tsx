import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Select, Tooltip, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import CopyInline from "@/Components/UX/CopyInline";
import { ApiAction } from "@/Redux/Actions";
import { API_FETCH } from "@/Redux/Actions/ApiAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { formatDate, getTime } from "@/helpers/dateTimeFormatter";
import { stringShorten } from "@/helpers";
import { Icon, MONO } from "@/styles/uiKit";
import { IApi } from "@/utils/types";
import { tapY } from "@/styles/tapTarget";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "NGN", "BRL", "INR", "JPY", "CNY", "AUD", "CAD", "CHF", "ZAR", "MXN", "AED", "SGD", "HKD", "SEK", "NZD", "BTC"];
const COLS = "minmax(150px, 1fr) minmax(220px, 1.6fr) 110px minmax(120px, 0.9fr) minmax(150px, 1fr) 44px";

type KeyRow = IApi & { environment?: string; last_used_at?: string; expires_at?: string; created_at?: string; createdAt?: string; test_mode_restrictions?: unknown; id?: number };

interface Handlers {
  onCopy: (value: string) => void;
  onDelete: (id: number) => void;
  onRegenerate: (id: string | number) => void;
  onToggleStatus: (id: string | number, status: string) => void;
}

const parseSandbox = (raw: unknown): { max_amount?: number; allowed_currencies?: string[]; sandbox_mode?: boolean } | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as never;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

/** Settlement-currency select — money-affecting, so every change goes through a confirm dialog. */
const CurrencyCell: React.FC<{ row: KeyRow }> = ({ row }) => {
  const { t } = useTranslation("apiScreen");
  const theme = useTheme();
  const dispatch = useDispatch();
  const [value, setValue] = useState(row.base_currency || "USD");
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(row.base_currency || "USD"), [row.base_currency]);
  const options = useMemo(() => Array.from(new Set([...SUPPORTED_CURRENCIES, value.toUpperCase()])), [value]);

  const apply = async () => {
    const next = pending;
    setPending(null);
    if (!next || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await axiosBaseApi.put(`userApi/updateApi/${row.api_id || row.id}`, { base_currency: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      dispatch({ type: TOAST_SHOW, payload: { message: t("currency.updated", { currency: next, defaultValue: "Settlement currency updated to {{currency}}" }), severity: "success" } });
      dispatch(ApiAction(API_FETCH));
    } catch (err: any) {
      setValue(previous);
      dispatch({ type: TOAST_SHOW, payload: { message: err?.response?.data?.message || t("currency.updateFailed", { defaultValue: "Failed to update currency" }), severity: "error" } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Select
        size="small"
        value={value}
        disabled={saving}
        onChange={(e) => String(e.target.value).toUpperCase() !== value && setPending(String(e.target.value).toUpperCase())}
        data-testid="settlement-currency-select"
        inputProps={{ "aria-label": t("currency.settlementCurrency", { defaultValue: "Settlement currency" }) as string }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 320, mt: 0.5, borderRadius: "10px" } } }}
        sx={{ height: 30, fontFamily: MONO, fontSize: 12.5, borderRadius: "8px", "& .MuiSelect-select": { py: 0.5, pl: 1.25, pr: "28px !important" }, "& fieldset": { borderColor: theme.palette.border.main } }}
      >
        {options.map((c) => (
          <MenuItem key={c} value={c} sx={{ fontFamily: MONO, fontSize: 13 }}>
            {c}
          </MenuItem>
        ))}
      </Select>
      {saving && <CircularProgress size={14} />}
      {saved && !saving && <Icon name="check" size={15} color={theme.palette.success.main} />}
      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" fullWidth data-testid="settlement-currency-confirm-dialog">
        <DialogTitle sx={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{t("currency.confirmTitle", { defaultValue: "Change settlement currency?" })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>
            {t("currency.confirmBody", {
              currency: pending || "",
              defaultValue: "Setting the settlement currency to {{currency}} affects real settlement: new payments will be priced and receipted in {{currency}}. It does not change past payments. Your paired development (test) key will be updated to match.",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" onClick={() => setPending(null)} label={t("common.cancel", { defaultValue: "Cancel" })} data-testid="settlement-currency-cancel-btn" />
          <CustomButton onClick={apply} label={t("currency.confirmCta", { currency: pending || "", defaultValue: "Change to {{currency}}" })} data-testid="settlement-currency-confirm-btn" />
        </DialogActions>
      </Dialog>
    </Box>
  );
};

/** ⋯ menu: Regenerate · Disable/Enable · Delete. */
const RowMenu: React.FC<{ row: KeyRow } & Handlers> = ({ row, onDelete, onRegenerate, onToggleStatus }) => {
  const { t } = useTranslation("apiScreen");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = row.api_id || row.id || 0;
  const active = row.status === "active";
  const run = (fn: () => void) => () => {
    setAnchor(null);
    fn();
  };
  return (
    <>
      <IconButton size="small" data-testid={`api-key-menu-${id}`} aria-label={t("keys.moreActions", { defaultValue: "Key actions" }) as string} aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        <Icon name="ellipsis" size={18} />
      </IconButton>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} slotProps={{ paper: { sx: { minWidth: 220, borderRadius: "12px", mt: 0.5 } } }}>
        <MenuItem data-testid="api-regenerate-btn" onClick={run(() => onRegenerate(id))}>
          <ListItemIcon><Icon name="refresh-cw" size={16} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 14 }}>{t("actions.regenerate", { defaultValue: "Regenerate" })}</ListItemText>
        </MenuItem>
        <MenuItem data-testid="api-toggle-status-btn" onClick={run(() => onToggleStatus(id, active ? "inactive" : "active"))}>
          <ListItemIcon><Icon name="power" size={16} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 14 }}>{active ? t("actions.disable", { defaultValue: "Disable" }) : t("actions.enable", { defaultValue: "Enable" })}</ListItemText>
        </MenuItem>
        <MenuItem data-testid="api-delete-btn" onClick={run(() => onDelete(Number(id)))} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ color: "inherit" }}><Icon name="trash-2" size={16} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 14 }}>{t("actions.delete", { defaultValue: "Delete" })}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ display: { xs: "block", md: "none" }, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", mb: 0.25 }}>
    {children}
  </Box>
);

const KeyRowView: React.FC<{ row: KeyRow; revealedKey?: string } & Handlers> = ({ row, revealedKey, ...handlers }) => {
  const { t } = useTranslation("apiScreen");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [show, setShow] = useState(false);
  const isDev = row.environment === "development";
  const sandbox = parseSandbox(row.test_mode_restrictions);
  const isSandbox = isDev && !!sandbox?.sandbox_mode;
  const active = row.status === "active";
  const createdAt = row.created_at || row.createdAt || "";
  const expiresAt = row.expires_at || "";
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  const keyText = revealedKey ? (show ? revealedKey : stringShorten(revealedKey, 12, 4)) : row.key_hint || "";
  const muted = theme.palette.text.secondary;
  const dot = active ? theme.palette.success.main : theme.palette.text.disabled;

  return (
    <Box component="li" data-testid={`api-key-row-${row.api_id}`} data-env={isDev ? "test" : "live"} sx={{ listStyle: "none", borderTop: `1px solid ${theme.palette.divider}` }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", md: COLS }, columnGap: 2, rowGap: 1.25, alignItems: "center", px: { xs: 2, md: 2.5 }, py: 1.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box data-testid="api-key-env" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1, py: 0.25, borderRadius: 999, border: `1px solid ${theme.palette.divider}`, fontSize: 12.5, fontWeight: 700, color: theme.palette.text.primary }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: isDev ? (isDark ? "#FBBF24" : "#D97706") : (isDark ? "#34D399" : "#059669") }} />
            {isDev ? t("keys.envTest", { defaultValue: "Test" }) : t("keys.envLive", { defaultValue: "Live" })}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5, fontSize: 12, color: muted, flexWrap: "wrap" }}>
            <Box component="span" data-testid="api-key-status" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dot }} />
              {active ? t("status.active", { defaultValue: "Active" }) : t("status.disabled", { defaultValue: "Disabled" })}
            </Box>
            {isSandbox && (
              <Tooltip arrow enterTouchDelay={0} title={t("keys.autoCreatedTooltip", { max: sandbox?.max_amount ?? 100, defaultValue: "Created automatically when your account was set up — no action needed. Use it to try the API safely: test payments are simulated and capped at ${{max}}." })}>
                <Box component="span" data-testid="sandbox-badge" tabIndex={0} sx={{ ...tapY(19), cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>
                  · {t("keys.sandboxShort", { defaultValue: "Sandbox" })}
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{ gridColumn: { xs: "2", md: "auto" }, gridRow: { xs: "1", md: "auto" }, justifySelf: { xs: "end", md: "stretch" }, order: { md: 6 } }}>
          <RowMenu row={row} {...handlers} />
        </Box>

        <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", md: "auto" }, order: { md: 1 } }}>
          <Label>{t("keys.colKey", { defaultValue: "Key" })}</Label>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            <Box component="code" data-testid="api-key-display" sx={{ fontFamily: MONO, fontSize: 13, color: theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {keyText}
            </Box>
            {revealedKey && (
              <>
                <CopyInline value={revealedKey} size={15} testId="api-key-copy" copyLabel={t("icons.copyAlt")} />
                <IconButton size="small" data-testid="api-key-toggle-visibility" aria-label={t("icons.eyeAlt") as string} onClick={() => setShow((v) => !v)}>
                  <Icon name={show ? "eye-off" : "eye"} size={15} />
                </IconButton>
              </>
            )}
          </Box>
          {isSandbox && (
            <Typography data-testid="sandbox-limits" sx={{ mt: 0.25, fontSize: 12, color: muted }}>
              {t("keys.sandboxLimits", { max: sandbox?.max_amount ?? 100, currencies: (sandbox?.allowed_currencies || []).join(" · "), defaultValue: "Max ${{max}} · {{currencies}} · sandbox mode" })}
            </Typography>
          )}
        </Box>

        <Box sx={{ order: { md: 2 } }}>
          <Label>{t("currency.settlementCurrencyShort", { defaultValue: "Currency" })}</Label>
          <CurrencyCell row={row} />
        </Box>

        <Box data-testid="api-key-meta" sx={{ order: { md: 3 }, fontSize: 13, color: theme.palette.text.primary }}>
          <Label>{t("keys.colLastUsed", { defaultValue: "Last used" })}</Label>
          <Box component="span" data-testid="api-last-used">
            {row.last_used_at ? formatDate(row.last_used_at) : <Box component="span" sx={{ color: muted }}>{t("keys.neverUsed", { defaultValue: "Never used" })}</Box>}
          </Box>
        </Box>

        <Box sx={{ order: { md: 4 }, fontSize: 13, color: theme.palette.text.primary, gridColumn: { xs: "1 / -1", md: "auto" } }}>
          <Label>{t("keys.colCreated", { defaultValue: "Created" })}</Label>
          <Box component="span" data-testid="api-key-created">
            {createdAt ? `${formatDate(createdAt)} · ${getTime(createdAt)}` : "—"}
          </Box>
          <Box data-testid="api-expires" sx={{ fontSize: 12, color: expired ? theme.palette.error.main : muted, fontWeight: expired ? 600 : 400 }}>
            {!expiresAt
              ? t("keys.noExpiry", { defaultValue: "No expiry" })
              : expired
                ? t("keys.expired", { date: formatDate(expiresAt), defaultValue: "Expired {{date}}" })
                : t("keys.expiresOn", { date: formatDate(expiresAt), defaultValue: "Expires {{date}}" })}
          </Box>
        </Box>
      </Box>

      {revealedKey && (
        <Box sx={{ mx: { xs: 2, md: 2.5 }, mb: 1.75, display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 1.5, py: 1, borderRadius: "10px", fontSize: 12.5, color: isDark ? "#FCD34D" : "#92400E", background: isDark ? "rgba(251,191,36,0.10)" : "#FFFBEB", border: `1px solid ${isDark ? "rgba(251,191,36,0.35)" : "#FDE68A"}` }} data-testid="api-key-copy-now-notice">
          <Icon name="triangle-alert" size={15} />
          <Box component="span" sx={{ flex: "1 1 240px" }}>
            {t("keys.copyNowNotice", { defaultValue: "Copy this key now — for security it will not be shown again once you leave this page." })}
          </Box>
          {isSandbox && (
            <CustomButton data-testid="copy-sandbox-key-btn" variant="secondary" size="small" label={t("keys.copySandboxKey", { defaultValue: "Copy sandbox key" })} onClick={() => handlers.onCopy(revealedKey)} />
          )}
        </Box>
      )}
    </Box>
  );
};

/** Developers → Keys as ONE compact table: environment · key · currency · last used · created · ⋯. */
const ApiKeysTable: React.FC<{ rows: KeyRow[]; revealedKeys?: Record<string | number, string> } & Handlers> = ({ rows, revealedKeys, ...handlers }) => {
  const { t } = useTranslation("apiScreen");
  const theme = useTheme();
  const anyHidden = rows.some((r) => !revealedKeys?.[r.api_id]);
  const head = [t("keys.colEnvironment", { defaultValue: "Environment" }), t("keys.colKey", { defaultValue: "Key" }), t("currency.settlementCurrencyShort", { defaultValue: "Currency" }), t("keys.colLastUsed", { defaultValue: "Last used" }), t("keys.colCreated", { defaultValue: "Created" }), ""];
  return (
    <Box data-testid="api-keys-table" sx={{ mb: 2.5, borderRadius: "14px", border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, overflow: "hidden" }}>
      <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: COLS, columnGap: 2, px: 2.5, py: 1.25 }}>
        {head.map((h, i) => (
          <Box key={i} sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
            {h}
          </Box>
        ))}
      </Box>
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {rows.map((row) => (
          <KeyRowView key={row.api_id} row={row} revealedKey={revealedKeys?.[row.api_id]} {...handlers} />
        ))}
      </Box>
      <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, px: { xs: 2, md: 2.5 }, py: 1.25, display: "flex", flexDirection: "column", gap: 0.5, fontSize: 12, color: theme.palette.text.secondary, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFB" }}>
        {anyHidden && (
          <Box data-testid="api-key-shown-once-notice" sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
            <Icon name="lock" size={13} style={{ marginTop: 2 }} />
            {t("keys.shownOnceNotice", { defaultValue: "Keys are shown once. Only a one-way hash is stored, so this key can't be revealed — press Regenerate to get a new one you can copy." })}
          </Box>
        )}
        <Box data-testid="api-base-currency-helper" sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
          <Icon name="info" size={13} style={{ marginTop: 2 }} />
          {t("currency.baseCurrencyHelper", { defaultValue: "The currency your payments settle in — it prices new payments and is the amount on receipts. Buyers still pay in Bitcoin, Ethereum or stablecoins. Changing it also updates your paired test key." })}
        </Box>
      </Box>
    </Box>
  );
};

export default ApiKeysTable;
