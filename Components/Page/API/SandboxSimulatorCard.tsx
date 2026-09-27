/**
 * SandboxSimulatorCard — Developers → API keys testing helper.
 *
 * Three things in one card, so a merchant can test their integration without curl:
 *   1. Create a test-mode payment (one tap) → gets a payment_id.
 *   2. Simulate any sandbox payment_id → walks pending → confirmed → settled and
 *      fires the real signed webhooks (no crypto).
 *   3. Recent test payments list, each with a one-click Simulate.
 *
 * All calls are session-authed wrappers:
 *   POST /api/userApi/transactions/sandbox/create   { company_id, amount }
 *   GET  /api/userApi/transactions/sandbox/recent    ?company_id&limit
 *   POST /api/userApi/transactions/:id/simulate      { company_id }
 * The simulator's Gate 2 refuses any non-sandbox txn, so this can never touch a
 * live payment. Only mounted when the merchant has an active dpk_test_ key.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Divider,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { Icon } from "@/styles/uiKit";

interface WebhookResult {
  event: string;
  mode?: string;
  delivered?: boolean;
}

interface SimResult {
  payment_id?: string;
  final_status?: string;
  already_settled?: boolean;
  payment_status?: string;
  settlement_tx_id?: string;
  events_fired?: string[];
  webhook_results?: WebhookResult[];
  note?: string;
}

interface RecentPayment {
  payment_id: string;
  status: string;
  base_amount: number | string;
  base_currency: string;
  crypto_amount: number | string;
  crypto_currency: string;
  created_at: string;
  can_simulate: boolean;
}

const statusColor = (status: string, isDark: boolean) => {
  const s = (status || "").toLowerCase();
  if (s === "settled" || s === "completed") return "#2ea043";
  if (s === "waiting" || s === "pending" || s === "underpaid")
    return isDark ? "#e3b341" : "#b7860b";
  if (s === "confirmed" || s === "processing") return "#3b82f6";
  if (s === "failed" || s === "expired" || s === "cancelled" || s === "refunded")
    return "#e8484a";
  return isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
};

const SandboxSimulatorCard = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { t } = useTranslation("apiScreen");
  const tt = (key: string, defaultValue: string) =>
    t(key, { ns: "apiScreen", defaultValue });
  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("19.99");
  const [creating, setCreating] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string>("");
  const [recent, setRecent] = useState<RecentPayment[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const toast = (message: string, severity: "success" | "error" | "info") =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const canSimulateManual = useMemo(
    () => !!paymentId.trim() && !simulatingId,
    [paymentId, simulatingId],
  );

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await axiosBaseApi.get(
        `userApi/transactions/sandbox/recent`,
        { params: selectedCompanyId ? { company_id: selectedCompanyId, limit: 10 } : { limit: 10 } },
      );
      setRecent(res?.data?.data?.payments || []);
    } catch {
      /* non-fatal: the list is a convenience */
    } finally {
      setRecentLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    setResult(null);
    try {
      const amt = Number(amount);
      const res = await axiosBaseApi.post(`userApi/transactions/sandbox/create`, {
        ...(selectedCompanyId ? { company_id: selectedCompanyId } : {}),
        amount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
      });
      const data = res?.data?.data || {};
      if (data.payment_id) {
        setPaymentId(data.payment_id);
        toast(
          tt("sandboxSim.created", "Test payment created — ready to simulate."),
          "success",
        );
        fetchRecent();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        tt("sandboxSim.createFailed", "Could not create a test payment.");
      setError(msg);
      toast(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const runSimulate = async (id: string) => {
    const target = (id || "").trim();
    if (!target || simulatingId) return;
    setSimulatingId(target);
    setResult(null);
    setError("");
    try {
      const res = await axiosBaseApi.post(
        `userApi/transactions/${encodeURIComponent(target)}/simulate`,
        selectedCompanyId ? { company_id: selectedCompanyId } : {},
      );
      const data: SimResult = res?.data?.data || {};
      setResult(data);
      setPaymentId(target);
      toast(
        data.already_settled
          ? tt("sandboxSim.alreadySettled", "This sandbox payment is already settled.")
          : tt("sandboxSim.success", "Sandbox payment simulated — walked to settled."),
        "success",
      );
      fetchRecent();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        tt("sandboxSim.failed", "Could not simulate this payment.");
      setError(msg);
      toast(msg, "error");
    } finally {
      setSimulatingId(null);
    }
  };

  const subtleBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const okBg = isDark ? "rgba(46,160,67,0.12)" : "rgba(46,160,67,0.08)";
  const okBorder = isDark ? "rgba(46,160,67,0.4)" : "rgba(46,160,67,0.35)";
  const errBg = isDark ? "rgba(232,72,74,0.12)" : "rgba(232,72,74,0.08)";
  const errBorder = isDark ? "rgba(232,72,74,0.4)" : "rgba(232,72,74,0.35)";
  const rowBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const mono = "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

  const shortId = (id: string) =>
    id && id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;

  const fmtAmount = (v: number | string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v);
  };

  return (
    <PanelCard
      title={tt("sandboxSim.title", "Sandbox testing")}
      subTitle={tt(
        "sandboxSim.subtitle",
        "Create a test-mode payment and walk it through pending → confirmed → settled, firing the signed webhooks — no real crypto.",
      )}
      headerIcon={<Icon name="flask-conical" size={20} />}
    >
      <Box data-testid="sandbox-simulator-card" sx={{ pt: 0.5 }}>
        {/* 1) Create a test payment */}
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            mb: 1,
          }}
        >
          {tt("sandboxSim.createHeading", "Create a test payment")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.25,
            alignItems: { xs: "stretch", sm: "center" },
            mb: 0.75,
          }}
        >
          <TextField
            size="small"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={creating}
            inputProps={{
              "data-testid": "sandbox-create-amount-input",
              min: 0.5,
              step: "0.01",
              style: { fontFamily: mono, fontSize: 13, width: 110 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary }}>$</Typography>
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": { bgcolor: subtleBg, borderRadius: "8px" },
            }}
          />
          <CustomButton
            label={tt("sandboxSim.createBtn", "Create test payment")}
            variant="secondary"
            size="medium"
            loading={creating}
            disabled={creating}
            onClick={handleCreate}
            data-testid="sandbox-create-btn"
            startIcon={<Icon name="plus" size={16} />}
            sx={{ flexShrink: 0 }}
          />
          <Typography
            sx={{
              fontSize: 12,
              color: theme.palette.text.secondary,
              lineHeight: 1.4,
            }}
          >
            {tt(
              "sandboxSim.createHint",
              "No crypto, no real address — just a test-mode payment you can simulate.",
            )}
          </Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: rowBorder }} />

        {/* 2) Simulate a payment id */}
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            mb: 1,
          }}
        >
          {tt("sandboxSim.simulateHeading", "Simulate a payment")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.25,
            alignItems: { xs: "stretch", sm: "flex-start" },
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder={tt(
              "sandboxSim.placeholder",
              "Sandbox payment_id (create one above, or paste from /cryptoPayment)",
            )}
            disabled={!!simulatingId}
            inputProps={{
              "data-testid": "sandbox-sim-payment-id-input",
              style: { fontFamily: mono, fontSize: 13 },
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSimulateManual) runSimulate(paymentId);
            }}
            sx={{
              "& .MuiOutlinedInput-root": { bgcolor: subtleBg, borderRadius: "8px" },
            }}
          />
          <CustomButton
            label={tt("sandboxSim.button", "Simulate payment")}
            variant="primary"
            loading={!!simulatingId && simulatingId === paymentId}
            disabled={!canSimulateManual}
            onClick={() => runSimulate(paymentId)}
            data-testid="sandbox-sim-submit-btn"
            sx={{ minWidth: 170, flexShrink: 0 }}
          />
        </Box>

        {result && (
          <Box
            data-testid="sandbox-sim-result"
            sx={{
              mt: 2,
              p: 1.75,
              borderRadius: "10px",
              bgcolor: okBg,
              border: `1px solid ${okBorder}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
              <Icon name="circle-check" size={16} color="#2ea043" />
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary }}
              >
                {result.note ||
                  tt("sandboxSim.done", "Sandbox payment advanced to settled.")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <Typography component="span" sx={{ fontFamily: mono, fontSize: 12, color: theme.palette.text.secondary }}>
                {tt("sandboxSim.status", "status")}:{" "}
                <b style={{ color: theme.palette.text.primary }}>
                  {result.final_status || result.payment_status || "settled"}
                </b>
              </Typography>
              {result.settlement_tx_id && (
                <Typography component="span" sx={{ fontFamily: mono, fontSize: 12, color: theme.palette.text.secondary, wordBreak: "break-all" }}>
                  tx: <b style={{ color: theme.palette.text.primary }}>{result.settlement_tx_id}</b>
                </Typography>
              )}
            </Box>
            {Array.isArray(result.webhook_results) && result.webhook_results.length > 0 && (
              <Box sx={{ mt: 1.25, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {result.webhook_results.map((w) => (
                  <Box key={w.event} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Icon
                      name={w.delivered ? "check" : "circle-alert"}
                      size={13}
                      color={w.delivered ? "#2ea043" : theme.palette.text.secondary}
                    />
                    <Typography component="span" sx={{ fontFamily: mono, fontSize: 12, color: theme.palette.text.secondary }}>
                      {w.event}
                      {w.mode ? ` · ${w.mode}` : ""}
                      {w.delivered ? " · delivered" : " · not delivered"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {error && (
          <Box
            data-testid="sandbox-sim-error"
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: "10px",
              bgcolor: errBg,
              border: `1px solid ${errBorder}`,
              display: "flex",
              alignItems: "flex-start",
              gap: 0.75,
            }}
          >
            <Icon name="circle-alert" size={16} color="#e8484a" style={{ flexShrink: 0, marginTop: 2 }} />
            <Typography sx={{ fontSize: 13, color: theme.palette.text.primary, lineHeight: 1.5 }}>
              {error}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2, borderColor: rowBorder }} />

        {/* 3) Recent test payments */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: theme.palette.text.secondary,
            }}
          >
            {tt("sandboxSim.recentHeading", "Recent test payments")}
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={fetchRecent}
            data-testid="sandbox-recent-refresh"
            aria-label="Refresh"
            sx={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              p: 0.5,
              borderRadius: "6px",
              color: theme.palette.text.secondary,
              display: "inline-flex",
              "&:hover": { color: theme.palette.text.primary },
            }}
          >
            <Icon name="refresh-cw" size={15} />
          </Box>
        </Box>

        {recent.length === 0 ? (
          <Typography
            data-testid="sandbox-recent-empty"
            sx={{ fontSize: 13, color: theme.palette.text.secondary, py: 1 }}
          >
            {recentLoading
              ? tt("sandboxSim.recentLoading", "Loading…")
              : tt("sandboxSim.recentEmpty", "No test payments yet — create one above.")}
          </Typography>
        ) : (
          <Box
            data-testid="sandbox-recent-list"
            sx={{
              border: `1px solid ${rowBorder}`,
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {recent.map((p, i) => (
              <Box
                key={p.payment_id}
                data-testid="sandbox-recent-row"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.5,
                  py: 1.1,
                  borderTop: i === 0 ? "none" : `1px solid ${rowBorder}`,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  component="button"
                  type="button"
                  onClick={() => setPaymentId(p.payment_id)}
                  title={p.payment_id}
                  sx={{
                    fontFamily: mono,
                    fontSize: 12,
                    color: theme.palette.text.primary,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    p: 0,
                    textAlign: "left",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {shortId(p.payment_id)}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: 12, color: theme.palette.text.secondary }}>
                  {fmtAmount(p.base_amount)} {p.base_currency}
                </Typography>
                <Box
                  sx={{
                    fontFamily: mono,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    color: statusColor(p.status, isDark),
                    border: `1px solid ${statusColor(p.status, isDark)}55`,
                    borderRadius: "6px",
                    px: 0.75,
                    py: 0.15,
                  }}
                >
                  {p.status}
                </Box>
                <Box sx={{ flex: 1 }} />
                {p.can_simulate ? (
                  <CustomButton
                    label={tt("sandboxSim.rowSimulate", "Simulate")}
                    variant="outlined"
                    size="small"
                    loading={simulatingId === p.payment_id}
                    disabled={!!simulatingId}
                    onClick={() => runSimulate(p.payment_id)}
                    data-testid={`sandbox-recent-simulate-${p.payment_id}`}
                    sx={{ minWidth: 96, flexShrink: 0 }}
                  />
                ) : (
                  <Typography
                    sx={{ fontSize: 12, color: "#2ea043", display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
                  >
                    <Icon name="circle-check" size={14} color="#2ea043" />
                    {tt("sandboxSim.settled", "settled")}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </PanelCard>
  );
};

export default SandboxSimulatorCard;
