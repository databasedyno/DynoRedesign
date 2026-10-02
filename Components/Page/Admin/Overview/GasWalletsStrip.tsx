import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Paper, Skeleton, Typography } from "@mui/material";
import { ArrowForwardRounded, LocalGasStationRounded } from "@mui/icons-material";
import { ChainReadinessReport, chainReadinessApi } from "@/api/chainReadiness";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import { formatCrypto } from "../adminUi";
import { GAS_LEVEL_CHIP } from "../ChainReadiness/GasWalletCard";

/** Admin › Overview — one-line gas wallet health; red when any wallet needs funding. Links to the full readiness page. */
const GasWalletsStrip: React.FC = () => {
  const [data, setData] = useState<ChainReadinessReport | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try { setData(await chainReadinessApi.report()); setFailed(false); } catch { setFailed(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefetchOnVisible(load);

  if (failed) return null;

  const needsFunding = data?.gas_wallets.filter((w) => w.level !== "healthy" && w.level !== "unknown") ?? [];
  const blocked = data?.summary.blocked ?? 0;
  const alert = needsFunding.length > 0 || blocked > 0;

  return (
    <Paper variant="outlined" data-testid="admin-gas-strip" data-alert={alert} sx={{ p: 1.75, borderRadius: "16px", mb: 2.5, borderColor: alert ? "error.main" : "divider", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <LocalGasStationRounded sx={{ color: alert ? "error.main" : "text.secondary" }} />
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} data-testid="admin-gas-strip-title">
          {!data ? "Checking gas wallets…" : alert
            ? `${needsFunding.length} gas wallet${needsFunding.length === 1 ? "" : "s"} need funding · ${blocked} currenc${blocked === 1 ? "y" : "ies"} blocked`
            : "All gas wallets funded · every currency can settle"}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.75 }}>
          {!data
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" width={120} height={22} />)
            : data.gas_wallets.map((w) => (
              <Chip
                key={w.id}
                size="small"
                color={GAS_LEVEL_CHIP[w.level].color}
                variant={w.level === "healthy" ? "outlined" : "filled"}
                label={`${w.id === "XRP_MASTER" ? "XRP master" : w.symbol} · ${w.balance === null ? "?" : formatCrypto(w.balance)} ${w.symbol}`}
                data-testid={`admin-gas-strip-${w.id}`}
                data-level={w.level}
                sx={{ height: 22, fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}
              />
            ))}
        </Box>
      </Box>
      <Button component={Link} href="/admin/chain-readiness" size="small" variant={alert ? "contained" : "outlined"} color={alert ? "error" : "primary"} endIcon={<ArrowForwardRounded sx={{ fontSize: 16 }} />} data-testid="admin-gas-strip-link" sx={{ textTransform: "none", fontSize: 12.5, whiteSpace: "nowrap" }}>
        Chain readiness
      </Button>
    </Paper>
  );
};

export default GasWalletsStrip;
