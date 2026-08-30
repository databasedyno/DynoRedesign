import { Box, Typography, useTheme, Skeleton, TextField, CircularProgress } from "@mui/material";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import { useApiSWR } from "@/hooks/useApiSWR";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

type PayoutWallet = {
  wallet_id: number;
  wallet_name: string | null;
  wallet_type: string;
  company_name: string | null;
  address: string;
  address_masked: string;
  label: string;
};

type PayoutOverview = {
  mode: "credit" | "cash";
  trc20_address: string | null;
  trc20_address_masked: string | null;
  address_verified_at: string | null;
  min_payout_usd: number;
  unpaid_balance_usd: number;
  has_verified_address: boolean;
  can_withdraw: boolean;
  pending_payout: { payout_id: number; amount_usd: number; status: string; requested_at: string } | null;
  wallets: PayoutWallet[];
};

type PayoutHistoryItem = {
  payout_id: number;
  amount_usd: number;
  status: string;
  trc20_address_masked: string;
  tx_hash: string | null;
  tx_url: string | null;
  withdrawal_fee_usdt: number | null;
  requested_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type Props = {
  isMobile: boolean;
  onToast: (message: string, severity: "success" | "error") => void;
};

export const PayoutCard = ({ isMobile, onToast }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  const dark = theme.palette.mode === "dark";

  const { data, isLoading, mutate } = useApiSWR<PayoutOverview>(API_ENDPOINTS.referral.payoutOverview, {
    unwrap: true,
  });
  const { data: history, mutate: mutateHistory } = useApiSWR<PayoutHistoryItem[]>(
    API_ENDPOINTS.referral.payoutHistory,
    { unwrap: true }
  );

  const [busy, setBusy] = useState<string | null>(null); // action id currently in-flight
  const [showAddNew, setShowAddNew] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newOtpSent, setNewOtpSent] = useState(false);
  const [newOtp, setNewOtp] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawOtp, setWithdrawOtp] = useState("");

  const post = useCallback(async (url: string, body: Record<string, unknown>) => {
    try {
      const res = await axiosBaseApi.post(url, body);
      return { ok: true as const, data: res.data };
    } catch (e: any) {
      return {
        ok: false as const,
        message: e?.response?.data?.message || t("payoutErrorGeneric", { defaultValue: "Something went wrong. Please try again." }),
      };
    }
  }, [t]);

  const resetForms = () => {
    setShowAddNew(false);
    setNewAddr("");
    setNewOtpSent(false);
    setNewOtp("");
    setShowWithdraw(false);
    setWithdrawOtp("");
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const useSavedWallet = useCallback(async (address: string) => {
    setBusy(`save-${address}`);
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "cash", address });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCash", { defaultValue: "Cash-out enabled" }), "success"); resetForms(); mutate(); }
    else onToast(r.message, "error");
  }, [post, onToast, t, mutate]);

  const sendNewAddrOtp = useCallback(async () => {
    if (!newAddr.trim()) return;
    setBusy("send-new-otp");
    const r = await post(API_ENDPOINTS.referral.payoutOtp, { address: newAddr.trim() });
    setBusy(null);
    if (r.ok) { setNewOtpSent(true); onToast(r.data?.message || t("payoutCodeSent", { defaultValue: "Code sent", email: "" }), "success"); }
    else onToast(r.message, "error");
  }, [newAddr, post, onToast, t]);

  const verifyNewAddr = useCallback(async () => {
    setBusy("verify-new");
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "cash", address: newAddr.trim(), otp: newOtp.trim() });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCash", { defaultValue: "Cash-out enabled" }), "success"); resetForms(); mutate(); }
    else onToast(r.message, "error");
  }, [newAddr, newOtp, post, onToast, t, mutate]);

  const switchToCredit = useCallback(async () => {
    setBusy("credit");
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "credit" });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCredit", { defaultValue: "Switched to fee credit" }), "success"); resetForms(); mutate(); }
    else onToast(r.message, "error");
  }, [post, onToast, t, mutate]);

  const startWithdraw = useCallback(async () => {
    setBusy("start-withdraw");
    const r = await post(API_ENDPOINTS.referral.payoutOtp, {});
    setBusy(null);
    if (r.ok) { setShowWithdraw(true); onToast(r.data?.message || t("payoutCodeSent", { defaultValue: "Code sent", email: "" }), "success"); }
    else onToast(r.message, "error");
  }, [post, onToast, t]);

  const confirmWithdraw = useCallback(async () => {
    setBusy("confirm-withdraw");
    const idem = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const r = await post(API_ENDPOINTS.referral.payoutRequest, { otp: withdrawOtp.trim(), idempotency_key: idem });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutRequested", { defaultValue: "Payout requested" }), "success"); resetForms(); mutate(); mutateHistory(); }
    else onToast(r.message, "error");
  }, [withdrawOtp, post, onToast, t, mutate, mutateHistory]);

  const downloadCsv = useCallback(async () => {
    try {
      const res = await axiosBaseApi.get(API_ENDPOINTS.referral.payoutHistoryExport, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "dynopay-referral-payouts.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      onToast(t("payoutErrorGeneric", { defaultValue: "Something went wrong. Please try again." }), "error");
    }
  }, [onToast, t]);

  // ── Style helpers ─────────────────────────────────────────────────────
  const pillBtn = (variant: "primary" | "ghost") => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1,
    px: 2.25, py: 1, borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap" as const,
    fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600,
    border: variant === "ghost" ? `1px solid ${theme.palette.border.main}` : "none",
    bgcolor: variant === "primary" ? theme.palette.primary.main : theme.palette.background.paper,
    color: variant === "primary" ? ((theme.palette.primary as any).contrastText || "#fff") : theme.palette.text.primary,
    "&:hover": { opacity: 0.9, bgcolor: variant === "ghost" ? theme.palette.secondary.main : undefined },
    transition: "opacity .15s ease, background-color .15s ease",
    opacity: busy ? 0.7 : 1, pointerEvents: busy ? ("none" as const) : ("auto" as const),
  });

  const otpField = (value: string, setValue: (v: string) => void, testid: string) => (
    <TextField
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder={t("payoutOtpPlaceholder", { defaultValue: "6-digit code" })}
      size="small"
      inputProps={{ "data-testid": testid, inputMode: "numeric", style: { fontFamily: MONO, letterSpacing: "3px" } }}
      sx={{ width: 160 }}
    />
  );

  const min = data?.min_payout_usd ?? 25;
  const balance = data?.unpaid_balance_usd ?? 0;

  return (
    <Box
      data-testid="payout-card"
      sx={{
        mt: 2.5, p: isMobile ? 2 : 2.5, borderRadius: "12px",
        border: `1px solid ${theme.palette.border.main}`, bgcolor: theme.palette.background.paper,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Icon name="wallet" size={20} color={brandFg(dark)} />
        <Typography sx={{ fontSize: isMobile ? "14px" : "16px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
          {t("payoutHeading", { defaultValue: "Cash out — USDT (TRC-20)" })}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 2 }}>
        {t("payoutAccountLevelNote", { defaultValue: "Referral earnings belong to your account, not a single business. Pick one USDT (TRC-20) wallet for all your referral payouts." })}
      </Typography>

      {isLoading ? (
        <Skeleton width="100%" height={90} />
      ) : (
        <>
          {/* Method toggle */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            {[
              { key: "credit", label: t("payoutCredit", { defaultValue: "Fee credit" }), desc: t("payoutCreditDesc", { defaultValue: "Reduces your own Dynopay fees. No wallet needed." }) },
              { key: "cash", label: t("payoutCash", { defaultValue: "Cash out (USDT-TRC20)" }), desc: t("payoutCashDesc", { defaultValue: "Get paid in USDT on Tron to a wallet you choose." }) },
            ].map((m) => {
              const activeMode = data?.mode === m.key;
              return (
                <Box
                  key={m.key}
                  data-testid={`payout-method-${m.key}`}
                  onClick={() => { if (m.key === "credit" && data?.mode !== "credit") switchToCredit(); }}
                  sx={{
                    flex: 1, minWidth: isMobile ? "100%" : 220, p: 1.75, borderRadius: "10px",
                    cursor: m.key === "credit" ? "pointer" : "default",
                    border: `1.5px solid ${activeMode ? theme.palette.primary.main : theme.palette.border.main}`,
                    bgcolor: activeMode ? `${theme.palette.primary.main}0A` : theme.palette.background.paper,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Icon name={activeMode ? "circle-check-big" : "circle"} size={16} color={activeMode ? brandFg(dark) : theme.palette.text.disabled} />
                    <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>{m.label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mt: 0.5 }}>{m.desc}</Typography>
                </Box>
              );
            })}
          </Box>

          {/* Pending payout */}
          {data?.pending_payout ? (
            <Box data-testid="payout-pending-status" sx={{ p: 1.75, borderRadius: "10px", bgcolor: `${theme.palette.warning?.main || "#F59E0B"}12`, border: `1px solid ${theme.palette.warning?.main || "#F59E0B"}40`, display: "flex", alignItems: "center", gap: 1.25 }}>
              <CircularProgress size={16} sx={{ color: "#F59E0B" }} />
              <Box>
                <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                  {t("payoutPendingTitle", { defaultValue: "Payout in progress" })}
                </Typography>
                <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                  {t("payoutPendingDesc", { defaultValue: "We're sending {{amount}} to your USDT (TRC-20) wallet.", amount: `$${Number(data.pending_payout.amount_usd).toFixed(2)}` })}
                </Typography>
              </Box>
            </Box>
          ) : data?.mode === "cash" && data?.has_verified_address ? (
            /* Cash enabled → show address + withdraw */
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.5, borderRadius: "10px", bgcolor: theme.palette.secondary.main, mb: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("payoutCurrentMethod", { defaultValue: "Payout address" })}
                  </Typography>
                  <Typography data-testid="payout-current-address" sx={{ fontSize: "14px", fontFamily: MONO, fontWeight: 600, color: theme.palette.text.primary }}>
                    {data.trc20_address_masked}
                  </Typography>
                </Box>
                <Box data-testid="payout-switch-to-credit-btn" onClick={switchToCredit} sx={pillBtn("ghost")}>
                  {busy === "credit" ? <CircularProgress size={16} /> : null}
                  {t("payoutTurnOff", { defaultValue: "Turn off cash-out" })}
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                    {t("payoutBalanceLabel", { defaultValue: "Available to cash out" })}
                  </Typography>
                  <Typography sx={{ fontSize: "22px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
                    {`$${balance.toFixed(2)}`}
                  </Typography>
                </Box>
                {data.can_withdraw && !showWithdraw ? (
                  <Box data-testid="payout-withdraw-btn" onClick={startWithdraw} sx={pillBtn("primary")}>
                    {busy === "start-withdraw" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <Icon name="arrow-up-right" size={16} />}
                    {t("payoutWithdraw", { defaultValue: "Cash out {{amount}}", amount: `$${balance.toFixed(2)}` })}
                  </Box>
                ) : !data.can_withdraw && !showWithdraw ? (
                  <Typography data-testid="payout-min-notice" sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.disabled, maxWidth: 260 }}>
                    {t("payoutMinNotice", { defaultValue: "Minimum cash-out is ${{min}}. Keep earning to unlock.", min: min.toFixed(0) })}
                  </Typography>
                ) : null}
              </Box>

              {/* Withdraw OTP confirm */}
              {showWithdraw && (
                <Box sx={{ mt: 2, p: 1.75, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` }}>
                  <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}>
                    {t("payoutWithdrawConfirm", { defaultValue: "Confirm cash-out" })}
                  </Typography>
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 1.5 }}>
                    {t("payoutOtpIntro", { defaultValue: "Enter the 6-digit code we emailed you." })}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    {otpField(withdrawOtp, setWithdrawOtp, "payout-withdraw-otp-input")}
                    <Box data-testid="payout-confirm-withdraw-btn" onClick={() => withdrawOtp.length === 6 && confirmWithdraw()} sx={{ ...pillBtn("primary"), opacity: withdrawOtp.length === 6 && !busy ? 1 : 0.6, pointerEvents: withdrawOtp.length === 6 && !busy ? "auto" : "none" }}>
                      {busy === "confirm-withdraw" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                      {t("payoutConfirmWithdraw", { defaultValue: "Confirm & send" })}
                    </Box>
                    <Box data-testid="payout-withdraw-cancel-btn" onClick={resetForms} sx={pillBtn("ghost")}>
                      {t("payoutCancel", { defaultValue: "Cancel" })}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            /* Not yet on cash → re-enable saved / wallet picker / add new */
            <Box>
              {data?.has_verified_address && data?.trc20_address && (
                <Box data-testid="payout-reenable-block" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.5, borderRadius: "10px", border: `1.5px solid ${theme.palette.primary.main}`, bgcolor: `${theme.palette.primary.main}0A`, mb: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                      {t("payoutSavedWallet", { defaultValue: "Your saved payout wallet" })}
                    </Typography>
                    <Typography sx={{ fontSize: "13px", fontFamily: MONO, color: theme.palette.text.secondary }}>
                      {data.trc20_address_masked}
                    </Typography>
                  </Box>
                  <Box data-testid="payout-reenable-btn" onClick={() => data.trc20_address && useSavedWallet(data.trc20_address)} sx={pillBtn("primary")}>
                    {busy === `save-${data.trc20_address}` ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                    {t("payoutReEnable", { defaultValue: "Re-enable cash-out" })}
                  </Box>
                </Box>
              )}

              {(data?.wallets?.length ?? 0) > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.secondary, mb: 1 }}>
                    {t("payoutUseSaved", { defaultValue: "Use a wallet you've already saved" })}
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {(data?.wallets ?? []).map((w) => (
                      <Box key={w.wallet_id} data-testid={`payout-wallet-option-${w.wallet_id}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.25, borderRadius: "10px", bgcolor: theme.palette.secondary.main }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                            {w.label}
                          </Typography>
                          <Typography sx={{ fontSize: "12px", fontFamily: MONO, color: theme.palette.text.secondary }}>
                            {w.address_masked} · {w.wallet_type}
                          </Typography>
                        </Box>
                        <Box data-testid={`payout-use-wallet-${w.wallet_id}`} onClick={() => useSavedWallet(w.address)} sx={pillBtn("primary")}>
                          {busy === `save-${w.address}` ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                          {t("payoutUse", { defaultValue: "Use" })}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {!showAddNew ? (
                <Box data-testid="payout-add-new-btn" onClick={() => setShowAddNew(true)} sx={{ ...pillBtn("ghost"), width: isMobile ? "100%" : "auto" }}>
                  <Icon name="plus" size={16} />
                  {t("payoutAddNew", { defaultValue: "Add a new USDT (TRC-20) address" })}
                </Box>
              ) : (
                <Box sx={{ p: 1.75, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` }}>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <TextField
                      value={newAddr}
                      onChange={(e) => setNewAddr(e.target.value.trim())}
                      placeholder={t("payoutNewAddressPlaceholder", { defaultValue: "Enter USDT (TRC-20) address (starts with T)" })}
                      size="small"
                      disabled={newOtpSent}
                      inputProps={{ "data-testid": "payout-new-address-input", style: { fontFamily: MONO, fontSize: "13px" } }}
                      sx={{ flex: 1, minWidth: 240 }}
                    />
                    {!newOtpSent && (
                      <Box data-testid="payout-send-otp-btn" onClick={() => newAddr && sendNewAddrOtp()} sx={{ ...pillBtn("primary"), opacity: newAddr && !busy ? 1 : 0.6, pointerEvents: newAddr && !busy ? "auto" : "none" }}>
                        {busy === "send-new-otp" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                        {t("payoutSendCode", { defaultValue: "Send code" })}
                      </Box>
                    )}
                  </Box>

                  {newOtpSent && (
                    <Box sx={{ mt: 1.5, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                      {otpField(newOtp, setNewOtp, "payout-new-otp-input")}
                      <Box data-testid="payout-verify-btn" onClick={() => newOtp.length === 6 && verifyNewAddr()} sx={{ ...pillBtn("primary"), opacity: newOtp.length === 6 && !busy ? 1 : 0.6, pointerEvents: newOtp.length === 6 && !busy ? "auto" : "none" }}>
                        {busy === "verify-new" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                        {t("payoutVerifyEnable", { defaultValue: "Verify & enable" })}
                      </Box>
                    </Box>
                  )}

                  <Typography sx={{ mt: 1.5, fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.disabled }}>
                    {t("payoutTronWarning", { defaultValue: "Sent on Tron (TRC-20). Double-check it — crypto sent to a wrong address can't be recovered." })}
                  </Typography>
                  <Box data-testid="payout-add-cancel-btn" onClick={resetForms} sx={{ ...pillBtn("ghost"), mt: 1.5 }}>
                    {t("payoutCancel", { defaultValue: "Cancel" })}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Cash-out history */}
          {(history?.length ?? 0) > 0 && (
            <Box data-testid="payout-history" sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${theme.palette.border.main}` }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
                <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                  {t("payoutHistoryTitle", { defaultValue: "Cash-out history" })}
                </Typography>
                <Box data-testid="payout-history-csv-btn" onClick={downloadCsv} sx={{ ...pillBtn("ghost"), px: 1.5, py: 0.5, fontSize: "12px" }}>
                  <Icon name="download" size={14} />
                  {t("payoutDownloadCsv", { defaultValue: "Download CSV" })}
                </Box>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {(history ?? []).map((h) => {
                  const color =
                    h.status === "completed" ? theme.palette.success?.main || "#16A34A"
                    : h.status === "failed" ? theme.palette.error?.main || "#DC2626"
                    : "#F59E0B";
                  return (
                    <Box key={h.payout_id} data-testid={`payout-history-row-${h.payout_id}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.25, borderRadius: "8px", bgcolor: theme.palette.secondary.main }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontWeight: 700, color: theme.palette.text.primary }}>
                          {`$${Number(h.amount_usd).toFixed(2)}`}
                        </Typography>
                        <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                          {h.completed_at
                            ? new Date(h.completed_at).toLocaleDateString()
                            : h.requested_at
                              ? new Date(h.requested_at).toLocaleDateString()
                              : ""}
                          {" · "}{h.trc20_address_masked}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {h.tx_url && (
                          <a href={h.tx_url} target="_blank" rel="noopener noreferrer" data-testid={`payout-history-tx-${h.payout_id}`} style={{ display: "inline-flex" }}>
                            <Icon name="external-link" size={14} color={theme.palette.text.secondary} />
                          </a>
                        )}
                        <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 600, color, textTransform: "capitalize", px: 1, py: 0.25, borderRadius: "6px", bgcolor: `${color}18` }}>
                          {t(`payoutStatus_${h.status}`, { defaultValue: h.status })}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default PayoutCard;
