import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Snackbar,
  Typography,
  useTheme,
} from "@mui/material";
import { PaidRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { DashboardAction } from "@/Redux/Actions";
import { DASHBOARD_FETCH_ALL } from "@/Redux/Actions/DashboardAction";
import { useWalletStore } from "@/contexts/WalletDataContext";

type SupportedCurrency = {
  code: string;
  symbol: string;
  display_format: string;
};

/**
 * Dashboard Display Currency selector (Session 39).
 * Presentation-only merchant preference — never changes pricing, stored data,
 * invoices, exports, or webhooks. Reads/writes /api/company/display-currency/:id.
 */
const DisplayCurrencySelector = ({ companyId }: { companyId: number | null }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { refetchWallets } = useWalletStore();
  const { t } = useTranslation("common");

  const [current, setCurrent] = useState<string>("");
  const [supported, setSupported] = useState<SupportedCurrency[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axiosBaseApi.get(`company/display-currency/${companyId}`);
        if (cancelled) return;
        setCurrent(data?.data?.display_currency || "USD");
        setSupported(data?.data?.supported || []);
      } catch {
        /* leave defaults; select stays empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleChange = async (next: string) => {
    if (!companyId || next === current || saving) return;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      await axiosBaseApi.patch(`company/display-currency/${companyId}`, {
        display_currency: next,
      });
      setToast({
        open: true,
        message: t("settingsPage.displayCurrencySaved", {
          defaultValue: "Dashboard currency updated",
        }),
        severity: "success",
      });
      // Refresh cached dashboard + wallet data so amounts re-render in the new currency.
      dispatch(DashboardAction(DASHBOARD_FETCH_ALL));
      refetchWallets();
    } catch {
      setCurrent(prev);
      setToast({
        open: true,
        message: t("settingsPage.displayCurrencyError", {
          defaultValue: "Could not update dashboard currency. Please try again.",
        }),
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "#E9ECF2";

  return (
    <Box
      data-testid="display-currency-selector"
      sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: "14px",
        p: { xs: 2, md: 2.5 },
        mb: 2.5,
        bgcolor: isDark ? "rgba(255,255,255,0.02)" : "#FCFCFD",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "rgba(204,255,0,0.14)" : "#F2F4F0",
            color: isDark ? "#CCFF00" : "#4B5563",
            flexShrink: 0,
          }}
        >
          <PaidRounded sx={{ fontSize: 19 }} />
        </Box>
        <Typography
          sx={{
            fontSize: { xs: "14px", md: "15px" },
            fontWeight: 600,
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
          }}
        >
          {t("settingsPage.displayCurrency", { defaultValue: "Dashboard display currency" })}
        </Typography>
      </Box>

      <Typography
        sx={{
          fontSize: "12.5px",
          color: theme.palette.text.secondary,
          fontFamily: "var(--font-sans)",
          mb: 1.75,
          maxWidth: 520,
        }}
      >
        {t("settingsPage.displayCurrencyHint", {
          defaultValue:
            "Choose the currency your dashboard and wallet balances are shown in. This is display-only — it does not change your payment pricing, payouts, invoices, or how customers are charged.",
        })}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Select
          value={supported.length && current ? current : ""}
          size="small"
          disabled={loading || saving || !companyId}
          data-testid="display-currency-select"
          onChange={(e) => handleChange(String(e.target.value))}
          displayEmpty
          sx={{
            minWidth: 200,
            borderRadius: "10px",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            bgcolor: theme.palette.background.paper,
            "& .MuiOutlinedInput-notchedOutline": { borderColor },
          }}
          MenuProps={{
            PaperProps: {
              sx: { borderRadius: "10px", mt: 0.5 },
            },
          }}
        >
          {supported.length === 0 && (
            <MenuItem value="" disabled sx={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>
              {loading ? t("loading", { defaultValue: "Loading…" }) : "—"}
            </MenuItem>
          )}
          {supported.map((c) => (
            <MenuItem
              key={c.code}
              value={c.code}
              data-testid={`display-currency-option-${c.code}`}
              sx={{ fontFamily: "var(--font-sans)", fontSize: 14 }}
            >
              <Box component="span" sx={{ fontWeight: 600, mr: 1 }}>
                {c.symbol}
              </Box>
              {c.code}
            </MenuItem>
          ))}
        </Select>
        {(loading || saving) && (
          <CircularProgress size={18} sx={{ color: theme.palette.text.disabled }} />
        )}
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((s) => ({ ...s, open: false }))}
          sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5 }}
          data-testid="display-currency-toast"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DisplayCurrencySelector;
