import React, { useCallback, useEffect, useState } from "react";
import { Box, CircularProgress, InputBase, Typography, useTheme } from "@mui/material";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import CustomButton from "@/Components/UI/Buttons";
import { formatDateI18n } from "@/utils/formatDate";
import { toFixedStr } from "@/utils/money";

interface LedgerEntry {
  id: string | null;
  direction: "credit" | "debit";
  amount: number;
  currency: string;
  description: string | null;
  reference: string;
  source: string;
  created_at: string;
}

interface LedgerData {
  customer_ids: number[];
  wallet: { amount: number; wallet_type: string };
  has_wallet: boolean;
  entries: LedgerEntry[];
}

interface Props {
  /** Directory key — the payer's e-mail (anonymous groups are not eligible). */
  customerKey: string;
  customerName: string | null;
  companyId: string | number | null | undefined;
  cardBorder: string;
  softBg: string;
  onChanged?: () => void;
}

/** Store-credit balance + credit/debit actions + ledger for one identified customer. */
export const CustomerWalletPanel: React.FC<Props> = ({ customerKey, customerName, companyId, cardBorder, softBg, onChanged }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const sans = { fontFamily: "var(--font-sans)" };
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"credit" | "debit" | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await axiosBaseApi.get(API_ENDPOINTS.userApi.customersWalletLedger, { params: { company_id: companyId, key: customerKey } });
      setData(res.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, customerKey]);

  useEffect(() => { void load(); }, [load]);

  const reset = () => { setMode(null); setAmount(""); setReason(""); setError(""); };

  const submit = async () => {
    if (!mode || !companyId) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError(t("customers.wallet.errAmount", { defaultValue: "Enter an amount greater than 0." })); return; }
    if (!reason.trim()) { setError(t("customers.wallet.errReason", { defaultValue: "Add a short reason — it appears in the ledger." })); return; }
    setBusy(true); setError("");
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.userApi.customersWalletAdjust, {
        company_id: companyId, key: customerKey, name: customerName, direction: mode, amount: value, description: reason.trim(),
      });
      const d = res.data?.data;
      setNotice(mode === "credit"
        ? t("customers.wallet.credited", { defaultValue: "Credited {{amount}} {{currency}} — new balance {{balance}}", amount: toFixedStr(value, 2), currency: d?.currency || "USD", balance: toFixedStr(Number(d?.new_balance || 0), 2) })
        : t("customers.wallet.debited", { defaultValue: "Debited {{amount}} {{currency}} — new balance {{balance}}", amount: toFixedStr(value, 2), currency: d?.currency || "USD", balance: toFixedStr(Number(d?.new_balance || 0), 2) }));
      reset();
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("customers.wallet.errGeneric", { defaultValue: "Could not update the balance. Please try again." }));
    } finally {
      setBusy(false);
    }
  };

  const currency = data?.wallet?.wallet_type || "USD";
  const balance = Number(data?.wallet?.amount || 0);
  const inputSx = { ...sans, fontSize: 13.5, px: 1.25, py: 0.75, borderRadius: "10px", border: `1px solid ${cardBorder}`, bgcolor: theme.palette.background.paper, width: "100%" };

  return (
    <Box data-testid="customer-wallet-panel" sx={{ mt: 1.5, p: "12px 14px", borderRadius: "12px", border: `1px solid ${cardBorder}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <AccountBalanceWalletRounded sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
        <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, ...sans, flexGrow: 1 }}>
          {t("customers.wallet.title", { defaultValue: "Store credit balance" })}
        </Typography>
        {loading ? <CircularProgress size={14} /> : (
          <Typography data-testid="customer-wallet-balance" className="tabular-nums" sx={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {toFixedStr(balance, 2)} {currency}
          </Typography>
        )}
      </Box>

      {!companyId ? (
        <Typography data-testid="customer-wallet-select-brand" sx={{ mt: 1, fontSize: 12.5, color: theme.palette.text.secondary, ...sans }}>
          {t("customers.wallet.selectBrand", { defaultValue: "Select a single brand in the header to credit or debit this customer." })}
        </Typography>
      ) : (
        <>
          <Typography sx={{ mt: 0.75, fontSize: 12, color: theme.palette.text.secondary, ...sans, lineHeight: 1.45 }}>
            {t("customers.wallet.help", { defaultValue: "Credit is spendable through your API (useWallet) and shows in the customer's ledger. Balances are per brand." })}
          </Typography>
          {!mode && (
            <Box sx={{ mt: 1.25, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <CustomButton label={t("customers.wallet.creditBtn", { defaultValue: "Add credit" })} variant="primary" onClick={() => { setNotice(""); setMode("credit"); }} data-testid="customer-wallet-credit-btn" />
              <CustomButton label={t("customers.wallet.debitBtn", { defaultValue: "Debit" })} variant="secondary" disabled={balance <= 0} onClick={() => { setNotice(""); setMode("debit"); }} data-testid="customer-wallet-debit-btn" />
            </Box>
          )}
          {mode && (
            <Box data-testid="customer-wallet-form" data-mode={mode} sx={{ mt: 1.25, p: 1.25, borderRadius: "10px", bgcolor: softBg, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, ...sans }}>
                {mode === "credit" ? t("customers.wallet.creditTitle", { defaultValue: "Add credit" }) : t("customers.wallet.debitTitle", { defaultValue: "Debit balance" })}
              </Typography>
              <InputBase value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={`0.00 ${currency}`} inputProps={{ "data-testid": "customer-wallet-amount", "aria-label": t("customers.wallet.amount", { defaultValue: "Amount" }) }} sx={inputSx} />
              <InputBase value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder={t("customers.wallet.reasonPlaceholder", { defaultValue: "Reason (e.g. refund for order #123)" })} inputProps={{ "data-testid": "customer-wallet-reason", "aria-label": t("customers.wallet.reason", { defaultValue: "Reason" }) }} sx={inputSx} />
              {error && <Typography data-testid="customer-wallet-error" sx={{ fontSize: 12.5, color: theme.palette.error.main, ...sans }}>{error}</Typography>}
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <CustomButton label={t("customers.wallet.cancel", { defaultValue: "Cancel" })} variant="secondary" onClick={reset} disabled={busy} data-testid="customer-wallet-cancel" />
                <CustomButton label={busy ? t("customers.wallet.saving", { defaultValue: "Saving…" }) : t("customers.wallet.confirm", { defaultValue: "Confirm" })} variant="primary" onClick={submit} disabled={busy} data-testid="customer-wallet-submit" />
              </Box>
            </Box>
          )}
          {notice && <Typography data-testid="customer-wallet-notice" sx={{ mt: 1, fontSize: 12.5, color: theme.palette.success.main, ...sans }}>{notice}</Typography>}

          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: theme.palette.text.secondary, ...sans }}>
              {t("customers.wallet.ledger", { defaultValue: "Ledger" })}
            </Typography>
            {!loading && (data?.entries?.length ?? 0) === 0 && (
              <Typography data-testid="customer-wallet-ledger-empty" sx={{ mt: 0.5, fontSize: 12.5, color: theme.palette.text.secondary, ...sans }}>
                {t("customers.wallet.noEntries", { defaultValue: "No adjustments yet." })}
              </Typography>
            )}
            {(data?.entries || []).slice(0, 10).map((e) => (
              <Box key={e.reference || e.id || e.created_at} data-testid="customer-wallet-ledger-row" data-direction={e.direction} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: `1px solid ${cardBorder}` }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, ...sans }}>{e.description || (e.direction === "credit" ? t("customers.wallet.creditTitle", { defaultValue: "Add credit" }) : t("customers.wallet.debitTitle", { defaultValue: "Debit balance" }))}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, ...sans }}>
                    {formatDateI18n(e.created_at, { year: "numeric", month: "short", day: "numeric" })} · {e.source === "ADMIN" ? "API" : e.source === "MERCHANT" ? t("customers.wallet.sourceDashboard", { defaultValue: "Dashboard" }) : e.source}
                  </Typography>
                </Box>
                <Typography className="tabular-nums" sx={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: e.direction === "credit" ? theme.palette.success.main : theme.palette.text.primary }}>
                  {e.direction === "credit" ? "+" : "−"}{toFixedStr(e.amount, 2)} {e.currency}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default CustomerWalletPanel;
