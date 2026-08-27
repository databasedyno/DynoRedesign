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
import { PersonOutlineRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { revalidateDashboardData } from "@/hooks/useDashboardData";
import { useWalletStore } from "@/contexts/WalletDataContext";
import useApiSWR from "@/hooks/useApiSWR";

type SupportedCurrency = { code: string; symbol: string; display_format: string };

/**
 * Per-USER Display Currency selector (Doc-3 workstream E).
 *
 * Overrides the team/company display currency for THIS logged-in user only.
 * When set, it wins over `tbl_company.display_currency`. When cleared
 * (option "Use company default"), the user inherits the company preference.
 *
 * Endpoint: GET/PATCH /api/user/display-currency (no :id — the JWT identifies
 * the user). Same list of supported currencies as the company-scope selector.
 *
 * NEVER affects pricing, invoices, exports, webhooks, or stored data —
 * display transformation only.
 */
const UserDisplayCurrencySelector: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { refetchWallets } = useWalletStore();
  const { t } = useTranslation("common");

  // Read standardized onto the shared SWR hook (refactor item 5). The resolved
  // currency / override / source stay local so the change handler can update
  // them from the PATCH response without a refetch.
  const { data: ucData, isLoading: loading } = useApiSWR<{
    display_currency?: string;
    user_override?: string | null;
    source?: "user" | "company" | "default";
    supported?: SupportedCurrency[];
  }>("user/display-currency", { select: (raw) => raw?.data ?? {} });
  const supported = ucData?.supported ?? [];

  const [resolved, setResolved] = useState<string>("");
  const [override, setOverride] = useState<string | null>(null); // "" means inherit; a code means user override
  const [source, setSource] = useState<"user" | "company" | "default">("company");
  useEffect(() => {
    if (!ucData) return;
    setResolved(ucData.display_currency || "USD");
    setOverride(ucData.user_override || null);
    setSource(ucData.source || "default");
  }, [ucData]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleChange = async (raw: string) => {
    // raw === "" → user picked "Use company default" (clear override)
    // raw === "<code>" → set override
    if (saving) return;
    const nextOverride: string | null = raw === "" ? null : raw;
    if (nextOverride === override) return;
    setSaving(true);
    try {
      const { data } = await axiosBaseApi.patch("user/display-currency", {
        display_currency: nextOverride,
      });
      setResolved(data?.data?.display_currency || resolved);
      setOverride(data?.data?.user_override || null);
      setSource((data?.data?.source as any) || "default");
      setToast({
        open: true,
        severity: "success",
        message: t("settingsPage.displayCurrencySaved", {
          defaultValue: "Personal display currency updated",
        }),
      });
      // Trigger dashboard + wallet re-render so amounts flip immediately
      try { revalidateDashboardData(); } catch { /* best-effort */ }
      try { refetchWallets(); } catch { /* best-effort */ }
    } catch (e: any) {
      setToast({
        open: true,
        severity: "error",
        message: e?.response?.data?.message || "Could not save",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      data-testid="user-display-currency-selector"
      sx={{
        p: 2.5,
        borderRadius: "14px",
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flex: 1 }}>
        <PersonOutlineRounded sx={{ color: theme.palette.text.secondary }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} fontSize={14} color={theme.palette.text.primary}>
            {t("settingsPage.userDisplayCurrencyTitle", {
              defaultValue: "My display currency",
            })}
          </Typography>
          <Typography fontSize={12.5} color={theme.palette.text.secondary} sx={{ mt: 0.25 }}>
            {t("settingsPage.userDisplayCurrencyHint", {
              defaultValue:
                "Overrides your team's display currency just for you. Never affects pricing or exports.",
            })}
            {source === "user" && (
              <>
                {" "}
                <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                  ({t("settingsPage.currentlyOverriding", { defaultValue: "overriding team default" })})
                </Box>
              </>
            )}
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Select
          value={override || ""}
          onChange={(e) => handleChange(String(e.target.value || ""))}
          size="small"
          disabled={saving}
          data-testid="user-display-currency-select"
          sx={{ minWidth: 220, fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}
        >
          <MenuItem value="" data-testid="user-display-currency-inherit">
            {t("settingsPage.useCompanyDefault", {
              defaultValue: "Use team default ({{code}})",
              code: source === "user" ? "team" : resolved,
            })}
          </MenuItem>
          {supported.map((c) => (
            <MenuItem key={c.code} value={c.code} data-testid={`user-display-currency-option-${c.code}`}>
              {c.symbol} {c.code}
            </MenuItem>
          ))}
        </Select>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ fontSize: 13 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserDisplayCurrencySelector;
