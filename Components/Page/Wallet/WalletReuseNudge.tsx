import React, { useMemo, useState } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { useReusableWallets } from "@/hooks/useReusableWallets";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

interface Props {
  /** Fallback for merchants who'd rather enter a brand-new address. */
  onAddWallet?: () => void;
}

/**
 * Wallet Sharing Nudge.
 *
 * Wallets are scoped per Account, so a merchant who adds a second account
 * (e.g. an individual creator who registers a business) lands on an EMPTY
 * wallets page even though they already have addresses saved elsewhere. This
 * card catches exactly that moment and copies them over in one tap — the same
 * idempotent `copyWalletAddresses` call the Add-Wallet reuse picker uses, so
 * each account keeps its own row for the same address and nothing about
 * settlement scoping changes.
 *
 * Renders nothing when there is no other account with wallets.
 */
const WalletReuseNudge: React.FC<Props> = ({ onAddWallet }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { selectedCompanyId, companyList } = useCompanyStore();
  const { refetchWallets } = useWalletStore();
  const { companies, loading } = useReusableWallets(selectedCompanyId ?? undefined);
  const [copying, setCopying] = useState(false);
  const [done, setDone] = useState(false);

  // Offer the richest source account — most addresses ready in one tap.
  const source = useMemo(
    () =>
      [...companies].sort(
        (a, b) => (b.wallet_count || 0) - (a.wallet_count || 0),
      )[0],
    [companies],
  );

  const targetName = useMemo(() => {
    const match = (companyList || []).find(
      (c: any) => c.company_id === selectedCompanyId,
    );
    return match?.company_name || "this account";
  }, [companyList, selectedCompanyId]);

  const copyAll = async () => {
    if (!source || !selectedCompanyId) return;
    try {
      setCopying(true);
      const { data } = await axiosBaseApi.post(
        API_ENDPOINTS.wallet.copyWalletAddresses,
        {
          source_company_id: source.company_id,
          target_company_id: selectedCompanyId,
          currencies: source.wallets.map((w) => w.currency),
        },
      );
      const count = data?.data?.copied?.length ?? 0;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            count > 0
              ? `${count} wallet${count === 1 ? "" : "s"} copied to ${targetName}`
              : data?.message || "Nothing new to copy",
          severity: "success",
        },
      });
      setDone(true);
      refetchWallets();
    } catch (e) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            (e as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || "Could not copy the wallets. Please try again.",
          severity: "error",
        },
      });
    } finally {
      setCopying(false);
    }
  };

  if (loading || done || !source || source.wallet_count < 1) return null;

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const glow = isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow;

  return (
    <Box
      data-testid="wallet-reuse-nudge"
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        gap: { xs: 1.5, sm: 2 },
        p: { xs: 2, sm: 2.25 },
        mb: 2,
        borderRadius: "16px",
        border: `1px solid ${indigo}`,
        backgroundColor: glow,
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          backgroundColor: indigo,
        }}
      >
        <Icon name="wallet" size={20} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 700,
            color: theme.palette.text.primary,
          }}
        >
          Use the same wallets as {source.company_name}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            lineHeight: 1.5,
            color: theme.palette.text.secondary,
            mt: 0.25,
          }}
        >
          {source.wallet_count} address{source.wallet_count === 1 ? "" : "es"} (
          {source.wallets
            .slice(0, 4)
            .map((w) => w.currency)
            .join(", ")}
          {source.wallet_count > 4 ? "…" : ""}) are already saved on your other
          account — copy them to {targetName} and start accepting payments now.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexShrink: 0,
          width: { xs: "100%", sm: "auto" },
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          data-testid="wallet-reuse-nudge-copy"
          onClick={copying ? undefined : copyAll}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (!copying && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              copyAll();
            }
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            px: 2.25,
            height: 42,
            borderRadius: 999,
            cursor: copying ? "default" : "pointer",
            opacity: copying ? 0.7 : 1,
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
            color: "#fff",
            backgroundColor: indigo,
            "&:hover": { filter: "brightness(1.08)" },
          }}
        >
          {copying ? (
            <CircularProgress size={15} sx={{ color: "#fff" }} />
          ) : (
            <Icon name="copy" size={15} />
          )}
          Copy {source.wallet_count} wallet{source.wallet_count === 1 ? "" : "s"}
        </Box>
        {onAddWallet && (
          <Box
            role="button"
            tabIndex={0}
            data-testid="wallet-reuse-nudge-add-new"
            onClick={onAddWallet}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAddWallet();
              }
            }}
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              color: theme.palette.text.secondary,
              "&:hover": { color: theme.palette.text.primary },
            }}
          >
            Add a different one
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default WalletReuseNudge;
