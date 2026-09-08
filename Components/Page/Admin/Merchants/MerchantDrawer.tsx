import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CloseRounded,
  BlockRounded,
  PauseCircleRounded,
  CheckCircleRounded,
  LockOpenRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { AdminStatusChip, formatDate, formatUSD } from "../adminUi";

export interface Merchant {
  user_id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  fee_tier?: string;
  cumulative_volume_usd?: string | number;
  settled_usd?: string | number;
  settled_count?: number;
  login_type?: string;
  createdAt?: string;
  signup_country?: string;
  merchant_country_code?: string | null;
  referral_count?: number;
  referral_code?: string;
  email_verified?: boolean;
  handle?: string;
  mobile?: string;
  language?: string;
  last_login_ip?: string;
  transaction_count?: number;
  companies?: {
    company_id: number;
    company_name: string;
    account_type?: string;
    country?: string | null;
    handle?: string | null;
    creator_page_enabled?: boolean;
    createdAt?: string;
  }[];
  wallets?: {
    wallet_type: string;
    wallet_address: string;
    wallet_name?: string | null;
    destination_tag?: string | null;
    company_id?: number | null;
    amount?: string | number;
  }[];
}

type ActionKind = "ban" | "suspend" | "activate" | "unlock";

const ACTION_META: Record<ActionKind, { title: string; body: string; confirm: string; needsReason: boolean }> = {
  ban: {
    title: "Ban this merchant?",
    body: "The account will be marked as banned and will no longer be able to sign in or process payments.",
    confirm: "Ban merchant",
    needsReason: true,
  },
  suspend: {
    title: "Suspend this merchant?",
    body: "The account will be temporarily suspended. You can re-activate it at any time.",
    confirm: "Suspend merchant",
    needsReason: true,
  },
  activate: {
    title: "Re-activate this merchant?",
    body: "The account will be restored to active status.",
    confirm: "Activate merchant",
    needsReason: false,
  },
  unlock: {
    title: "Unlock this account?",
    body: "Clears the failed-login lockout so the merchant can sign in again immediately.",
    confirm: "Unlock login",
    needsReason: false,
  },
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.75 }}>
    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: 12.5, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>
      {value}
    </Typography>
  </Box>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: "text.secondary",
      mt: 2,
      mb: 0.5,
    }}
  >
    {children}
  </Typography>
);

const shortAddr = (a?: string) => (a ? `${a.slice(0, 10)}…${a.slice(-6)}` : "—");

const MerchantDrawer: React.FC<{
  merchant: Merchant | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ merchant, onClose, onChanged }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const [detail, setDetail] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const toast = useCallback(
    (message: string, severity: "success" | "error" = "success") =>
      dispatch({ type: TOAST_SHOW, payload: { message, severity } }),
    [dispatch]
  );

  useEffect(() => {
    if (!merchant) {
      setDetail(null);
      return;
    }
    setDetail(merchant);
    setLoading(true);
    adminBaseApi
      .get(`/admin/users/${merchant.user_id}`)
      .then((res) => setDetail({ ...merchant, ...(res.data?.data || {}) }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [merchant]);

  const runAction = async () => {
    if (!merchant || !pending) return;
    setBusy(true);
    try {
      if (pending === "unlock") {
        await adminBaseApi.post(`/admin/users/unlock`, { email: merchant.email });
        toast(`Login unlocked for ${merchant.email}.`);
      } else {
        await adminBaseApi.put(`/admin/users/${merchant.user_id}/ban`, {
          action: pending,
          reason: reason.trim() || undefined,
        });
        toast(`Merchant ${pending === "activate" ? "re-activated" : `${pending}ned`} successfully.`);
      }
      setPending(null);
      setReason("");
      onChanged();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const m = detail;
  const statusLower = (m?.status || "active").toLowerCase();
  const isActive = statusLower === "active";
  const meta = pending ? ACTION_META[pending] : null;

  const viewBrandTransactions = (companyName?: string) => {
    if (!companyName) return;
    onClose();
    router.push(`/admin/transactions?brand=${encodeURIComponent(companyName)}`);
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(merchant)}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 0 } }}
        data-testid="merchant-drawer"
      >
        {m && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <Box
              sx={{
                p: 2.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 800 }} noWrap>
                  {m.name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "Merchant"}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                  {m.email || "—"}
                </Typography>
                <Box sx={{ mt: 1, display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                  <AdminStatusChip status={m.status || "active"} testid="merchant-drawer-status" />
                  <Chip size="small" variant="outlined" label={`#${m.user_id}`} sx={{ height: 22, fontSize: 11 }} />
                  {m.email_verified && (
                    <Chip size="small" color="success" variant="outlined" label="Email verified" sx={{ height: 22, fontSize: 11 }} />
                  )}
                </Box>
              </Box>
              <IconButton onClick={onClose} size="small" data-testid="merchant-drawer-close">
                <CloseRounded />
              </IconButton>
            </Box>

            {/* Body */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
              {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              )}

              <SectionLabel>Financials</SectionLabel>
              <InfoRow label="Lifetime volume" value={formatUSD(m.cumulative_volume_usd)} />
              <InfoRow
                label="Settled received"
                value={`${formatUSD(m.settled_usd)}${m.settled_count != null ? ` · ${m.settled_count} paid` : ""}`}
              />
              <InfoRow label="Transactions" value={(m.transaction_count ?? 0).toLocaleString()} />
              <InfoRow label="Fee tier" value={<span style={{ textTransform: "capitalize" }}>{m.fee_tier || "—"}</span>} />

              <SectionLabel>Identity</SectionLabel>
              <InfoRow label="Login method" value={m.login_type || "EMAIL"} />
              <InfoRow label="Mobile" value={m.mobile || "—"} />
              <InfoRow label="Country" value={m.signup_country || m.merchant_country_code || "—"} />
              <InfoRow label="Language" value={(m.language || "en").toUpperCase()} />
              <InfoRow label="Last login IP" value={m.last_login_ip || "—"} />
              <InfoRow label="Referral code" value={m.referral_code || "—"} />
              <InfoRow label="Joined" value={formatDate(m.createdAt)} />

              <SectionLabel>Brands ({(m.companies || []).length})</SectionLabel>
              {(m.companies || []).length === 0 ? (
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 0.5 }}>
                  No brands yet.
                </Typography>
              ) : (
                (m.companies || []).map((co) => (
                  <Box
                    key={co.company_id}
                    data-testid={`merchant-brand-${co.company_id}`}
                    onClick={() => viewBrandTransactions(co.company_name)}
                    role="button"
                    title={`View ${co.company_name} transactions`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      py: 0.85,
                      px: 0.5,
                      mx: -0.5,
                      borderRadius: "8px",
                      cursor: "pointer",
                      borderBottom: `1px dashed ${theme.palette.divider}`,
                      "&:hover": { backgroundColor: theme.palette.action.hover },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "primary.main" }} noWrap>
                        {co.company_name}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                        <span style={{ textTransform: "capitalize" }}>{co.account_type || "business"}</span>
                        {co.country ? ` · ${co.country}` : ""}
                        {co.creator_page_enabled && co.handle ? ` · @${co.handle}` : ""}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                      <Chip size="small" variant="outlined" label={`#${co.company_id}`} sx={{ height: 20, fontSize: 10.5 }} />
                      <ChevronRightRounded sx={{ fontSize: 18, color: "text.secondary" }} />
                    </Box>
                  </Box>
                ))
              )}

              <SectionLabel>Payout wallets</SectionLabel>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>
                Amounts are the lifetime crypto received (forwarded) per address — not a spendable balance.
              </Typography>
              {(() => {
                const all = m.wallets || [];
                // Hide legacy account-level (company_id NULL) rows unless the
                // merchant has no company-scoped wallets at all.
                const scoped = all.filter((w) => w.company_id != null);
                const source = scoped.length > 0 ? scoped : all;
                if (source.length === 0) {
                  return (
                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 0.5 }}>
                      No payout wallets configured.
                    </Typography>
                  );
                }
                const groups: Record<string, typeof source> = {};
                for (const w of source) {
                  const key = w.company_id != null ? String(w.company_id) : "account";
                  (groups[key] = groups[key] || []).push(w);
                }
                const brandName = (key: string) => {
                  if (key === "account") return "Account-level";
                  const co = (m.companies || []).find((c) => String(c.company_id) === key);
                  return co?.company_name || `Brand #${key}`;
                };
                const companyOrder = (m.companies || [])
                  .map((c) => String(c.company_id))
                  .filter((k) => groups[k]);
                const rest = Object.keys(groups).filter((k) => !companyOrder.includes(k));
                const orderedKeys = [...companyOrder, ...rest];
                return (
                  <>
                    {orderedKeys.map((key) => {
                      const list = groups[key] || [];
                      const funded = list.filter((w) => Number(w.amount) > 0);
                      return (
                        <Box key={key} sx={{ mb: 1 }} data-testid={`merchant-wallet-group-${key}`}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mt: 1 }}>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }} noWrap>
                              {brandName(key)}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "text.secondary", flexShrink: 0 }}>
                              {list.length} wallet{list.length === 1 ? "" : "s"}
                              {funded.length ? ` · ${funded.length} funded` : ""}
                            </Typography>
                          </Box>
                          {funded.length === 0 ? (
                            <Typography sx={{ fontSize: 11.5, color: "text.secondary", py: 0.5 }}>
                              No settlements received yet.
                            </Typography>
                          ) : (
                            funded.slice(0, 12).map((w, i) => (
                              <Box
                                key={`${key}-${w.wallet_type}-${i}`}
                                data-testid={`merchant-wallet-${key}-${w.wallet_type}`}
                                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, py: 0.5 }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{w.wallet_type}</Typography>
                                  <Typography sx={{ fontSize: 11, color: "text.secondary", fontFamily: "var(--font-mono)" }}>
                                    {shortAddr(w.wallet_address)}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 12.5, fontFamily: "var(--font-mono)", fontWeight: 600, textAlign: "right" }}>
                                  {Number(w.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} {w.wallet_type}
                                </Typography>
                              </Box>
                            ))
                          )}
                        </Box>
                      );
                    })}
                  </>
                );
              })()}
            </Box>

            {/* Actions */}
            <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {isActive ? (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<PauseCircleRounded />}
                    onClick={() => setPending("suspend")}
                    data-testid="merchant-action-suspend"
                  >
                    Suspend
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<BlockRounded />}
                    onClick={() => setPending("ban")}
                    data-testid="merchant-action-ban"
                  >
                    Ban
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleRounded />}
                  onClick={() => setPending("activate")}
                  data-testid="merchant-action-activate"
                >
                  Re-activate
                </Button>
              )}
              <Button
                size="small"
                variant="text"
                startIcon={<LockOpenRounded />}
                onClick={() => setPending("unlock")}
                disabled={!m.email}
                data-testid="merchant-action-unlock"
              >
                Unlock login
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Confirm dialog */}
      <Dialog open={Boolean(pending)} onClose={() => (busy ? null : setPending(null))} fullWidth maxWidth="xs">
        {meta && (
          <>
            <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{meta.title}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ fontSize: 13.5, mb: meta.needsReason ? 2 : 0 }}>
                {meta.body}
              </DialogContentText>
              {meta.needsReason && (
                <TextField
                  fullWidth
                  size="small"
                  label="Reason (optional)"
                  multiline
                  minRows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="merchant-action-reason"
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color={pending === "ban" ? "error" : pending === "suspend" ? "warning" : "primary"}
                onClick={runAction}
                disabled={busy}
                data-testid="merchant-action-confirm"
              >
                {busy ? <CircularProgress size={18} color="inherit" /> : meta.confirm}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default MerchantDrawer;
