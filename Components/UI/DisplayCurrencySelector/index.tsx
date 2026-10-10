import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from "@mui/material";
import { PaidRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSWRConfig } from "swr";
import axiosBaseApi from "@/axiosConfig";
import useApiSWR from "@/hooks/useApiSWR";
import useToast from "@/hooks/useToast";
import { requestFiatRefresh } from "@/utils/fiatRefresh";

type SupportedCurrency = {
  code: string;
  symbol: string;
  display_format: string;
};


/**
 * Brand currency selector — ONE currency per brand (Stripe-style):
 *   • default pricing currency for new payment links / API charges (each charge may still pass its own `currency`)
 *   • reporting currency for the dashboard + wallet totals
 * Reads/writes /api/company/display-currency/:id.
 */
const DisplayCurrencySelector = ({ companyId }: { companyId: number | null }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { mutate: mutateSwr } = useSWRConfig();
  const { t } = useTranslation("common");

  // Read standardized onto the shared SWR hook (refactor item 5). `current`
  // stays local so the change handler can optimistically update + roll back.
  const { data: dcData, isLoading: loading } = useApiSWR<{
    display_currency?: string;
    supported?: SupportedCurrency[];
  }>(companyId ? `company/display-currency/${companyId}` : null, {
    select: (raw) => raw?.data ?? {},
  });
  const supported = dcData?.supported ?? [];

  const [current, setCurrent] = useState<string>("");
  useEffect(() => {
    if (dcData) setCurrent(dcData.display_currency || "USD");
  }, [dcData]);

  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleChange = async (next: string) => {
    if (!companyId || next === current || saving) return;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      await axiosBaseApi.patch(`company/display-currency/${companyId}`, {
        display_currency: next,
      });
      showToast({
        message: t("settingsPage.displayCurrencySaved", {
          defaultValue: "Brand currency updated",
        }),
        severity: "success",
      });
      // Flip every amount on screen to the new currency right away (all
      // amount-bearing SWR keys + redux dashboard/transactions) — see useFiatAutoRefresh.
      void mutateSwr(`company/display-currency/${companyId}`);
      requestFiatRefresh("currency");
    } catch {
      setCurrent(prev);
      showToast({
        message: t("settingsPage.displayCurrencyError", {
          defaultValue: "Could not update brand currency. Please try again.",
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
            bgcolor: isDark ? "rgba(255,209,0,0.16)" : "#F2F4F0",
            color: isDark ? "#FFD100" : "#4B5563",
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
          {t("settingsPage.displayCurrency", { defaultValue: "Brand currency" })}
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
            "The default currency for new payment links, API charges and your dashboard totals. Individual links and API calls can still set their own currency. Customers always pay in crypto.",
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
    </Box>
  );
};

export default DisplayCurrencySelector;
