/**
 * SandboxSimulatorCard — Developers → API keys testing helper.
 *
 * Lets a merchant drive a SANDBOX (test-mode) payment through
 * pending → confirmed → settled and receive the real signed webhooks, without
 * any actual crypto. Calls the session-authed wrapper
 *   POST /api/userApi/transactions/:id/simulate  { company_id }
 * which reuses runSandboxSimulation() with the same server-side safety gates:
 * only a payment stamped environment='development' can ever be simulated (a live
 * payment is refused with 403), so this is safe to expose in the dashboard.
 *
 * Only mounted when the merchant already has an active sandbox (dpk_test_) key.
 */
import { useMemo, useState } from "react";
import { Box, TextField, Typography, useTheme } from "@mui/material";
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

const SandboxSimulatorCard = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { t } = useTranslation("apiScreen");
  const tt = (key: string, defaultValue: string) =>
    t(key, { ns: "apiScreen", defaultValue });
  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  const [paymentId, setPaymentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(
    () => !!paymentId.trim() && !loading,
    [paymentId, loading],
  );

  const handleSimulate = async () => {
    const id = paymentId.trim();
    if (!id) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await axiosBaseApi.post(
        `userApi/transactions/${encodeURIComponent(id)}/simulate`,
        selectedCompanyId ? { company_id: selectedCompanyId } : {},
      );
      const data: SimResult = res?.data?.data || {};
      setResult(data);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: data.already_settled
            ? tt(
                "sandboxSim.alreadySettled",
                "This sandbox payment is already settled.",
              )
            : tt(
                "sandboxSim.success",
                "Sandbox payment simulated — walked to settled.",
              ),
          severity: "success",
        },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        tt("sandboxSim.failed", "Could not simulate this payment.");
      setError(msg);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: msg, severity: "error" },
      });
    } finally {
      setLoading(false);
    }
  };

  const subtleBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const okBg = isDark ? "rgba(46,160,67,0.12)" : "rgba(46,160,67,0.08)";
  const okBorder = isDark ? "rgba(46,160,67,0.4)" : "rgba(46,160,67,0.35)";
  const errBg = isDark ? "rgba(232,72,74,0.12)" : "rgba(232,72,74,0.08)";
  const errBorder = isDark ? "rgba(232,72,74,0.4)" : "rgba(232,72,74,0.35)";
  const mono = "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

  return (
    <PanelCard
      title={tt("sandboxSim.title", "Simulate a sandbox payment")}
      subTitle={tt(
        "sandboxSim.subtitle",
        "Walk a test-mode payment through pending → confirmed → settled and fire the signed webhooks — no real crypto.",
      )}
      headerIcon={<Icon name="flask-conical" size={20} />}
    >
      <Box data-testid="sandbox-simulator-card" sx={{ pt: 0.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            lineHeight: 1.6,
            color: theme.palette.text.secondary,
            mb: 2,
          }}
        >
          {tt(
            "sandboxSim.help",
            "Create a checkout with your test (dpk_test_) key, paste the returned payment_id below, then simulate it. Your webhook endpoint receives real, signed payment.pending / payment.confirmed / payment.settled events. Live payments can never be simulated.",
          )}
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
              "Sandbox payment_id (e.g. from /cryptoPayment)",
            )}
            disabled={loading}
            inputProps={{
              "data-testid": "sandbox-sim-payment-id-input",
              style: { fontFamily: mono, fontSize: 13 },
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSimulate();
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: subtleBg,
                borderRadius: "8px",
              },
            }}
          />
          <CustomButton
            label={tt("sandboxSim.button", "Simulate payment")}
            variant="primary"
            loading={loading}
            disabled={!canSubmit}
            onClick={handleSimulate}
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
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, fontFamily: mono, fontSize: 12 }}>
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
      </Box>
    </PanelCard>
  );
};

export default SandboxSimulatorCard;
