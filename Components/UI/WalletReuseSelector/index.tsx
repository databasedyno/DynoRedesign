import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Checkbox,
  MenuItem,
  Select,
  CircularProgress,
  useTheme,
} from "@mui/material";
import {
  AccountBalanceWalletRounded,
  ContentCopyRounded,
  CloseRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";

interface ReusableWallet {
  currency: string;
  label: string | null;
  wallet_name: string | null;
  wallet_address_preview: string;
}
interface ReusableCompany {
  company_id: number;
  company_name: string;
  wallet_count: number;
  wallets: ReusableWallet[];
}

interface WalletReuseSelectorProps {
  /** The company the wallets will be copied INTO (excluded from the source list). */
  targetCompanyId?: string | number;
  /** Called after a successful copy with the number of wallets copied. */
  onCopied?: (count: number) => void;
}

const LIME = "#c2f200";

/**
 * "Reuse wallets from an existing company" card.
 * Renders nothing when the merchant has no other company with saved wallets, so
 * it can be dropped at the top of the Add-Wallet flow unconditionally.
 */
const WalletReuseSelector: React.FC<WalletReuseSelectorProps> = ({
  targetCompanyId,
  onCopied,
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<ReusableCompany[]>([]);
  const [sourceId, setSourceId] = useState<number | "">("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copying, setCopying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const activeCompany = useMemo(
    () => companies.find((c) => c.company_id === sourceId),
    [companies, sourceId],
  );

  const initSelection = useCallback((company?: ReusableCompany) => {
    const map: Record<string, boolean> = {};
    (company?.wallets || []).forEach((w) => {
      map[w.currency] = true;
    });
    setSelected(map);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const params = targetCompanyId ? { exclude_company_id: targetCompanyId } : {};
        const { data } = await axiosBaseApi.get("/wallet/reusable-wallets", { params });
        if (!active) return;
        const list: ReusableCompany[] = data?.data || [];
        setCompanies(list);
        if (list.length > 0) {
          setSourceId(list[0].company_id);
          initSelection(list[0]);
        }
      } catch {
        if (active) setCompanies([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [targetCompanyId, initSelection]);

  const handleSourceChange = (id: number) => {
    setSourceId(id);
    initSelection(companies.find((c) => c.company_id === id));
  };

  const toggle = (currency: string) =>
    setSelected((prev) => ({ ...prev, [currency]: !prev[currency] }));

  const allChecked = activeCompany
    ? activeCompany.wallets.every((w) => selected[w.currency])
    : false;
  const toggleAll = () => {
    if (!activeCompany) return;
    const next = !allChecked;
    const map: Record<string, boolean> = {};
    activeCompany.wallets.forEach((w) => {
      map[w.currency] = next;
    });
    setSelected(map);
  };

  const selectedCurrencies = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  const handleCopy = async () => {
    if (!activeCompany || !targetCompanyId || selectedCurrencies.length === 0) return;
    try {
      setCopying(true);
      const { data } = await axiosBaseApi.post("/wallet/copyWalletAddresses", {
        source_company_id: activeCompany.company_id,
        target_company_id: targetCompanyId,
        currencies: selectedCurrencies,
      });
      const copiedCount = data?.data?.copied?.length ?? 0;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: data?.message || `${copiedCount} wallet(s) copied`,
          severity: "success",
        },
      });
      dispatch(WalletAction(WALLET_FETCH, { force: true }));
      setDismissed(true);
      onCopied?.(copiedCount);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not copy wallets. Please try again.";
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setCopying(false);
    }
  };

  // Nothing to reuse — render nothing (progressive disclosure).
  if (loading || dismissed || companies.length === 0 || !activeCompany) return null;

  const rowBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const cardBg = isDark ? "rgba(194,242,0,0.06)" : "rgba(194,242,0,0.10)";
  const cardBorder = isDark ? "rgba(194,242,0,0.35)" : "rgba(120,150,0,0.35)";

  return (
    <Box
      data-testid="wallet-reuse-selector"
      sx={{
        border: `1px solid ${cardBorder}`,
        backgroundColor: cardBg,
        borderRadius: "12px",
        p: 2,
        mb: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "8px",
            backgroundColor: LIME,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AccountBalanceWalletRounded sx={{ fontSize: 16, color: "#0a0a0a" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            Reuse wallets from an existing company
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: theme.palette.text.secondary,
              fontFamily: "var(--font-sans)",
            }}
          >
            Skip re-entering addresses — copy them from another company.
          </Typography>
        </Box>
        <Box
          role="button"
          aria-label="Dismiss reuse suggestion"
          onClick={() => setDismissed(true)}
          sx={{ cursor: "pointer", color: theme.palette.text.secondary, display: "flex", p: 0.5 }}
        >
          <CloseRounded sx={{ fontSize: 18 }} />
        </Box>
      </Box>

      {/* Source company selector (only when >1 option) */}
      {companies.length > 1 && (
        <Select
          size="small"
          fullWidth
          value={sourceId}
          onChange={(e) => handleSourceChange(Number(e.target.value))}
          sx={{
            mb: 1.5,
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            backgroundColor: theme.palette.background.paper,
            borderRadius: "8px",
          }}
          data-testid="wallet-reuse-source-select"
        >
          {companies.map((c) => (
            <MenuItem key={c.company_id} value={c.company_id} sx={{ fontSize: 13 }}>
              {c.company_name} ({c.wallet_count})
            </MenuItem>
          ))}
        </Select>
      )}

      {/* Select-all row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={toggleAll}
          data-testid="wallet-reuse-select-all"
        >
          <Checkbox
            checked={allChecked}
            size="small"
            sx={{ p: 0.5, color: LIME, "&.Mui-checked": { color: LIME } }}
          />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: theme.palette.text.secondary }}>
            Select all ({activeCompany.wallets.length})
          </Typography>
        </Box>
      </Box>

      {/* Wallet checkbox list */}
      <Box
        sx={{
          maxHeight: 168,
          overflowY: "auto",
          border: `1px solid ${rowBorder}`,
          borderRadius: "8px",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {activeCompany.wallets.map((w, idx) => (
          <Box
            key={w.currency}
            onClick={() => toggle(w.currency)}
            data-testid={`wallet-reuse-row-${w.currency}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.75,
              cursor: "pointer",
              borderTop: idx === 0 ? "none" : `1px solid ${rowBorder}`,
              "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" },
            }}
          >
            <Checkbox
              checked={!!selected[w.currency]}
              size="small"
              sx={{ p: 0.25, color: LIME, "&.Mui-checked": { color: LIME } }}
            />
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.primary,
                minWidth: 96,
              }}
            >
              {w.currency}
            </Typography>
            <Typography
              sx={{
                fontSize: 12.5,
                fontFamily: "var(--font-mono, monospace)",
                color: theme.palette.text.secondary,
              }}
            >
              {w.wallet_address_preview}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Action */}
      <Box
        role="button"
        aria-label="Use these wallets"
        data-testid="wallet-reuse-apply"
        onClick={copying || selectedCurrencies.length === 0 ? undefined : handleCopy}
        sx={{
          mt: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          height: 40,
          borderRadius: "10px",
          backgroundColor: LIME,
          color: "#0a0a0a",
          fontWeight: 700,
          fontSize: 13.5,
          fontFamily: "var(--font-sans)",
          cursor: copying || selectedCurrencies.length === 0 ? "not-allowed" : "pointer",
          opacity: copying || selectedCurrencies.length === 0 ? 0.55 : 1,
          transition: "opacity .15s ease",
          userSelect: "none",
        }}
      >
        {copying ? (
          <CircularProgress size={16} sx={{ color: "#0a0a0a" }} />
        ) : (
          <ContentCopyRounded sx={{ fontSize: 16 }} />
        )}
        {copying
          ? "Copying…"
          : `Use ${selectedCurrencies.length} selected wallet${selectedCurrencies.length === 1 ? "" : "s"}`}
      </Box>
    </Box>
  );
};

export default WalletReuseSelector;
