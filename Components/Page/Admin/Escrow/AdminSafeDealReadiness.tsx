import React, { useCallback, useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Grid, Stack, Typography, useTheme } from "@mui/material";
import { CheckCircleRounded, ErrorRounded, WarningAmberRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import { BRAND_ACCENT } from "@/constants/theme";
import { money } from "@/Components/Page/Escrow/escrowUtils";

interface Check { key: string; ok: boolean; warn?: boolean; label: string; detail: string }
interface Readiness {
  ready: boolean;
  live_settlement: boolean;
  safedeal_url: string | null;
  brand: { company_id: number; name: string; owner_user_id: number; auto_convert: { enabled: boolean; currency: string | null; chain: string | null; address: string | null } } | null;
  wallets: { coin: string; address: string; custody: boolean; pool_ready?: number }[];
  api_key?: { configured: boolean; resolves: boolean; company_match: boolean; active: boolean; key_hint: string | null; api_name: string | null; webhook_secret_synced: boolean; webhook_url: string } | null;
  totals: { available_total?: number; held_total?: number; customers?: number; fees_earned?: number; pending_approvals: number } | null;
  deals: { count: number; total?: number; open?: number; closed_unfunded?: number; volume?: number; active: number; disputed: number; in_custody: number; realized?: number } | null;
  checks: Check[];
}

/** Ops checklist: is the SafeDeal brand wired for production (URL, custody wallets, auto-convert, live flag)? */
export default function AdminSafeDealReadiness() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminBaseApi.get("/safedeal/admin/readiness");
      setData(r.data?.data || null);
    } catch (e: any) {
      dispatch({ type: "TOAST_SHOW", payload: { message: e?.response?.data?.message || "Could not load SafeDeal readiness.", severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);
  useEffect(() => { void load(); }, [load]);
  useRefetchOnVisible(load);

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress size={28} sx={{ color: BRAND_ACCENT }} /></Box>;
  if (!data) return null;

  const tile = (label: string, value: string, testid: string) => (
    <Grid item xs={6} md={3} key={testid}>
      <Box sx={{ p: 1.6, borderRadius: 2.5, border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper }} data-testid={testid}>
        <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.3 }}>{value}</Typography>
      </Box>
    </Grid>
  );

  return (
    <Box data-testid="escrow-admin-readiness">
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          icon={data.ready ? <CheckCircleRounded /> : <WarningAmberRounded />}
          label={data.ready ? "Ready for live traffic" : "Setup incomplete"}
          color={data.ready ? "success" : "warning"}
          data-testid="escrow-admin-readiness-state"
          sx={{ fontWeight: 700 }}
        />
        <Chip size="small" label={data.live_settlement ? "LIVE settlement" : "Simulated settlement"} variant="outlined" data-testid="escrow-admin-readiness-live" sx={{ fontWeight: 700 }} />
        {data.brand && <Chip size="small" label={`Brand #${data.brand.company_id} · ${data.brand.name}`} variant="outlined" />}
        {data.safedeal_url && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{data.safedeal_url}</Typography>}
      </Stack>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {tile("Customers", String(data.totals?.customers ?? "—"), "escrow-admin-readiness-customers")}
        {tile("Held in escrow", money(Number(data.totals?.held_total ?? data.deals?.in_custody ?? 0)), "escrow-admin-readiness-held")}
        {tile("Available balances", money(Number(data.totals?.available_total ?? 0)), "escrow-admin-readiness-available")}
        {tile("Pending approvals", String(data.totals?.pending_approvals ?? 0), "escrow-admin-readiness-pending")}
        {tile("SafeDeal profit (escrow fees, on Binance)", money(Number(data.totals?.fees_earned ?? 0)), "escrow-admin-readiness-profit")}
        {tile("Active / funded deals", `${data.deals?.active ?? 0} / ${data.deals?.count ?? 0}${data.deals?.open ? ` · ${data.deals.open} awaiting funding` : ""}`, "escrow-admin-readiness-deals")}
        {tile("Funded volume (deal prices)", money(Number(data.deals?.volume ?? 0)), "escrow-admin-readiness-volume")}
        {tile("Realised custody (after conversion)", money(Number(data.deals?.realized ?? 0)), "escrow-admin-readiness-realized")}
        {tile("API key", data.api_key?.key_hint ? `${data.api_key.key_hint}` : "not set", "escrow-admin-readiness-apikey")}
      </Grid>

      <Stack spacing={1}>
        {data.checks.map((c) => {
          const Icon = c.ok && !c.warn ? CheckCircleRounded : c.ok ? WarningAmberRounded : ErrorRounded;
          const color = c.ok && !c.warn ? theme.palette.success.main : c.ok ? theme.palette.warning.main : theme.palette.error.main;
          return (
            <Box key={c.key} sx={{ p: 1.6, borderRadius: 2.5, border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, display: "flex", gap: 1.5, alignItems: "flex-start" }} data-testid={`escrow-admin-readiness-check-${c.key}`} data-ok={c.ok ? "1" : "0"}>
              <Icon sx={{ color, mt: 0.2 }} fontSize="small" />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{c.label}</Typography>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", wordBreak: "break-word" }}>{c.detail}</Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>

      {data.wallets.length > 0 && (
        <Box sx={{ mt: 2.5 }} data-testid="escrow-admin-readiness-wallets">
          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Funding coins on the brand (wallet = Dynopay custody · pool = ready deposit addresses)</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {data.wallets.map((w) => (
              <Chip key={w.coin} size="small" label={`${w.coin} · ${w.address}${w.custody ? " · custody" : ""}${w.pool_ready != null ? ` · pool ${w.pool_ready}` : ""}`} color={w.custody ? "success" : "default"} variant="outlined" sx={{ fontFamily: "monospace", fontSize: 11.5 }} />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
