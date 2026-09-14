import { Box, Typography, useTheme, Skeleton, TextField, CircularProgress } from "@mui/material";
import { PayoutHistoryItem, PayoutOverview, makePillBtn } from "./payoutShared";
import { PayoutCreditStats, PayoutHistory } from "./PayoutSections";
import { PayoutAutoSection } from "./PayoutAutoSection";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import { useApiSWR } from "@/hooks/useApiSWR";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { toFixedStr } from "@/utils/money";


type Props = {
  isMobile: boolean;
  onToast: (message: string, severity: "success" | "error") => void;
};

/**
 * Referral cash-out card. Every payout-method mutation is step-up gated on the
 * backend (`payout` scope); the shared "Verify it's you" dialog is raised by
 * the axios interceptor, so there are no inline OTP fields here anymore.
 */
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
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAutoSetup, setShowAutoSetup] = useState(false);
  const [autoMin, setAutoMin] = useState("");

  const post = useCallback(async (url: string, body: Record<string, unknown>) => {
    try {
      const res = await axiosBaseApi.post(url, body);
      return { ok: true as const, data: res.data };
    } catch (e: any) {
      return {
        ok: false as const,
        cancelled: !!e?.stepUpCancelled,
        message: e?.response?.data?.message || t("payoutErrorGeneric", { defaultValue: "Something went wrong. Please try again." }),
      };
    }
  }, [t]);

  const fail = useCallback((r: { cancelled?: boolean; message: string }) => {
    if (!r.cancelled) onToast(r.message, "error");
  }, [onToast]);

  const resetForms = () => {
    setShowAddNew(false);
    setNewAddr("");
    setShowWithdraw(false);
    setShowAutoSetup(false);
    setAutoMin("");
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const applySavedWallet = useCallback(async (address: string) => {
    setBusy(`save-${address}`);
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "cash", address });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCash", { defaultValue: "Cash-out enabled" }), "success"); resetForms(); mutate(); }
    else fail(r);
  }, [post, onToast, t, mutate, fail]);

  const enableNewAddr = useCallback(async () => {
    if (!newAddr.trim()) return;
    setBusy("verify-new");
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "cash", address: newAddr.trim() });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCash", { defaultValue: "Cash-out enabled" }), "success"); resetForms(); mutate(); }
    else fail(r);
  }, [newAddr, post, onToast, t, mutate, fail]);

  const switchToCredit = useCallback(async () => {
    setBusy("credit");
    const r = await post(API_ENDPOINTS.referral.payoutOptIn, { mode: "credit" });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutEnabledCredit", { defaultValue: "Switched to fee credit" }), "success"); resetForms(); mutate(); }
    else fail(r);
  }, [post, onToast, t, mutate, fail]);

  const confirmWithdraw = useCallback(async () => {
    setBusy("confirm-withdraw");
    const idem = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const r = await post(API_ENDPOINTS.referral.payoutRequest, { idempotency_key: idem });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutRequested", { defaultValue: "Payout requested" }), "success"); resetForms(); mutate(); mutateHistory(); }
    else fail(r);
  }, [post, onToast, t, mutate, mutateHistory, fail]);

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

  const enableAuto = useCallback(async () => {
    setBusy("enable-auto");
    const amt = parseFloat(autoMin) || (data?.min_payout_usd ?? 25);
    const r = await post(API_ENDPOINTS.referral.payoutAuto, { enabled: true, auto_min_usd: amt });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutAutoEnabled", { defaultValue: "Auto cash-out on" }), "success"); resetForms(); mutate(); }
    else fail(r);
  }, [autoMin, data, post, onToast, t, mutate, fail]);

  const disableAuto = useCallback(async () => {
    setBusy("disable-auto");
    const r = await post(API_ENDPOINTS.referral.payoutAuto, { enabled: false });
    setBusy(null);
    if (r.ok) { onToast(r.data?.message || t("payoutAutoDisabled", { defaultValue: "Auto cash-out off" }), "success"); resetForms(); mutate(); }
    else fail(r);
  }, [post, onToast, t, mutate, fail]);
  const pillBtn = makePillBtn(theme, busy);

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
          <Box role="radiogroup" aria-label={t("payoutMethod", { defaultValue: "Payout method" })} sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            {[
              { key: "credit", label: t("payoutCredit", { defaultValue: "Fee credit" }), desc: t("payoutCreditDesc", { defaultValue: "Reduces your own Dynopay fees. No wallet needed." }) },
              { key: "cash", label: t("payoutCash", { defaultValue: "Cash out (USDT-TRC20)" }), desc: t("payoutCashDesc", { defaultValue: "Get paid in USDT on Tron to a wallet you choose." }) },
            ].map((m) => {
              const activeMode = data?.mode === m.key;
              return (
                <Box
                  key={m.key}
                  data-testid={`payout-method-${m.key}`}
                  role="radio"
                  aria-checked={activeMode}
                  tabIndex={m.key === "credit" ? 0 : -1}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && m.key === "credit" && data?.mode !== "credit") { e.preventDefault(); switchToCredit(); } }}
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
          {data?.mode === "credit" && <PayoutCreditStats data={data} isMobile={isMobile} />}

          {/* Pending payout */}
          {data?.pending_payout ? (
            <Box data-testid="payout-pending-status" sx={{ p: 1.75, borderRadius: "10px", bgcolor: `${theme.palette.warning?.main || "#F59E0B"}12`, border: `1px solid ${theme.palette.warning?.main || "#F59E0B"}40`, display: "flex", alignItems: "center", gap: 1.25 }}>
              <CircularProgress size={16} sx={{ color: "#F59E0B" }} />
              <Box>
                <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                  {t("payoutPendingTitle", { defaultValue: "Payout in progress" })}
                </Typography>
                <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                  {t("payoutPendingDesc", { defaultValue: "We're sending {{amount}} to your USDT (TRC-20) wallet.", amount: `$${toFixedStr(data.pending_payout.amount_usd, 2)}` })}
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
                <Box component="button" type="button" data-testid="payout-switch-to-credit-btn" onClick={switchToCredit} sx={pillBtn("ghost")}>
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
                    {`$${toFixedStr(balance, 2)}`}
                  </Typography>
                </Box>
                {data.can_withdraw && !showWithdraw ? (
                  <Box component="button" type="button" data-testid="payout-withdraw-btn" onClick={() => setShowWithdraw(true)} sx={pillBtn("primary")}>
                    <Icon name="arrow-up-right" size={16} />
                    {t("payoutWithdraw", { defaultValue: "Cash out {{amount}}", amount: `$${toFixedStr(balance, 2)}` })}
                  </Box>
                ) : !data.can_withdraw && !showWithdraw ? (
                  <Typography data-testid="payout-min-notice" sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.disabled, maxWidth: 260 }}>
                    {t("payoutMinNotice", { defaultValue: "Minimum cash-out is ${{min}}. Keep earning to unlock.", min: toFixedStr(min, 0) })}
                  </Typography>
                ) : null}
              </Box>

              {/* Withdraw confirm (identity check = shared step-up dialog) */}
              {showWithdraw && (
                <Box data-testid="payout-withdraw-confirm" sx={{ mt: 2, p: 1.75, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` }}>
                  <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}>
                    {t("payoutWithdrawConfirm", { defaultValue: "Confirm cash-out" })}
                  </Typography>
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 1.5 }}>
                    {t("payoutWithdrawIntro", { defaultValue: "We'll send {{amount}} in USDT (TRC-20) to {{address}}. You'll be asked to verify it's you.", amount: `$${toFixedStr(balance, 2)}`, address: data.trc20_address_masked })}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Box component="button" type="button" data-testid="payout-confirm-withdraw-btn" onClick={confirmWithdraw} sx={pillBtn("primary")}>
                      {busy === "confirm-withdraw" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                      {t("payoutConfirmWithdraw", { defaultValue: "Confirm & send" })}
                    </Box>
                    <Box component="button" type="button" data-testid="payout-withdraw-cancel-btn" onClick={resetForms} sx={pillBtn("ghost")}>
                      {t("payoutCancel", { defaultValue: "Cancel" })}
                    </Box>
                  </Box>
                </Box>
              )}
              <PayoutAutoSection
                data={data}
                min={min}
                busy={busy}
                pillBtn={pillBtn}
                showSetup={showAutoSetup}
                openSetup={() => { setShowAutoSetup(true); setAutoMin(String(min)); }}
                autoMin={autoMin}
                setAutoMin={setAutoMin}
                onEnable={() => enableAuto()}
                onDisable={disableAuto}
                onCancel={resetForms}
              />
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
                  <Box component="button" type="button" data-testid="payout-reenable-btn" onClick={() => data.trc20_address && applySavedWallet(data.trc20_address)} sx={pillBtn("primary")}>
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
                        <Box component="button" type="button" data-testid={`payout-use-wallet-${w.wallet_id}`} onClick={() => applySavedWallet(w.address)} sx={pillBtn("primary")}>
                          {busy === `save-${w.address}` ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                          {t("payoutUse", { defaultValue: "Use" })}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {!showAddNew ? (
                <Box component="button" type="button" data-testid="payout-add-new-btn" onClick={() => setShowAddNew(true)} sx={{ ...pillBtn("ghost"), width: isMobile ? "100%" : "auto" }}>
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
                      data-testid="payout-new-address-field"
                      inputProps={{ "data-testid": "payout-new-address-input", style: { fontFamily: MONO, fontSize: "13px" } }}
                      sx={{ flex: 1, minWidth: 240 }}
                    />
                    <Box component="button" type="button" data-testid="payout-verify-btn" onClick={() => newAddr && enableNewAddr()} sx={{ ...pillBtn("primary"), opacity: newAddr && !busy ? 1 : 0.6, pointerEvents: newAddr && !busy ? "auto" : "none" }}>
                      {busy === "verify-new" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                      {t("payoutVerifyEnable", { defaultValue: "Verify & enable" })}
                    </Box>
                  </Box>

                  <Typography sx={{ mt: 1.5, fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.disabled }}>
                    {t("payoutTronWarning", { defaultValue: "Sent on Tron (TRC-20). Double-check it — crypto sent to a wrong address can't be recovered." })}
                  </Typography>
                  <Box component="button" type="button" data-testid="payout-add-cancel-btn" onClick={resetForms} sx={{ ...pillBtn("ghost"), mt: 1.5 }}>
                    {t("payoutCancel", { defaultValue: "Cancel" })}
                  </Box>
                </Box>
              )}
            </Box>
          )}
          <PayoutHistory history={history ?? []} onDownload={downloadCsv} pillBtn={pillBtn} />
        </>
      )}
    </Box>
  );
};

export default PayoutCard;
