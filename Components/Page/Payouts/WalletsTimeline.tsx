import React from "react";
import { Box, Button, Skeleton, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { ALLCRYPTOCURRENCIES } from "@/hooks/useWalletData";
import { getAssetColor } from "@/helpers/assetColor";
import { explorerTxUrl } from "@/helpers/explorerUrl";
import { getNetworkLabel } from "@/utils/networkLabels";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { money, relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";
import type { PayoutsData } from "./useDashboardPayouts";

interface Props {
  data: PayoutsData | null | undefined;
  loading: boolean;
  rangeLabel: string;
}

const iconOf = (code: string) => ALLCRYPTOCURRENCIES.find((c) => c.code === code)?.icon;

/** Per-wallet timeline: every payout wallet with its forwarding activity, most recent first. */
const WalletsTimeline: React.FC<Props> = ({ data, loading, rangeLabel }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t, i18n } = useTranslation("common");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const hairline = isDark ? "rgba(255,255,255,0.06)" : "#EEF1F6";
  const sym = data?.currency_symbol || "$";
  const cur = data?.currency || "USD";
  const wallets = data?.wallets || [];
  const active = wallets.filter((w) => w.last_forward_at);
  const idle = wallets.filter((w) => !w.last_forward_at);

  return (
    <SurfaceCard data-testid="payouts-wallets" sx={{ p: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 2.5 }, pt: { xs: 1.75, md: 2 }, pb: 1 }}>
        <Eyebrow>{t("payouts.byWallet", { defaultValue: "By wallet" })} · {rangeLabel}</Eyebrow>
        <Button size="small" variant="text" data-testid="payouts-manage-wallets" onClick={() => router.push("/wallet")} endIcon={<Icon name="arrow-right" size={14} />} sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, color: muted }}>
          {t("payouts.manage", { defaultValue: "Manage" })}
        </Button>
      </Box>
      {loading && wallets.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}</Box>
      ) : wallets.length === 0 ? (
        <Box data-testid="payouts-wallets-empty" sx={{ px: 2.5, pb: 2.5, fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
          {t("payouts.noWallets", { defaultValue: "No payout wallets yet — add one so settled payments have somewhere to land." })}
        </Box>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {[...active, ...idle].map((w, i) => {
            const isIdle = !w.last_forward_at;
            const icon = iconOf(w.wallet_type);
            const href = `/transactions?wallet=${encodeURIComponent(w.wallet_type)}&status=settled&range=all`;
            return (
              <Box
                component="li"
                key={w.wallet_id}
                data-testid={`payouts-wallet-row-${w.wallet_type}`}
                data-idle={isIdle ? "1" : "0"}
                role="link"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") router.push(href); }}
                sx={{ display: "grid", gridTemplateColumns: { xs: "34px 1fr auto", sm: "34px 1.2fr 1fr auto" }, alignItems: "center", gap: 1.5, px: { xs: 2, md: 2.5 }, py: 1.25, borderTop: i === 0 ? "none" : `1px solid ${hairline}`, opacity: isIdle ? 0.6 : 1, cursor: "pointer", transition: "background-color 150ms ease", "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(10,10,15,0.02)" } }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: `${getAssetColor(w.wallet_type)}${isDark ? "26" : "14"}` }}>
                  {icon ? <Image src={icon} alt={w.wallet_type} width={20} height={20} draggable={false} /> : <Icon name="wallet" size={16} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: ink, whiteSpace: "nowrap" }}>{w.wallet_type}</Box>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getNetworkLabel(w.wallet_type)}</Box>
                  </Box>
                  <Box sx={{ fontFamily: MONO, fontSize: 11.5, color: muted }}>{w.address_masked}</Box>
                </Box>
                <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}>
                  <Box data-testid="payouts-wallet-amount" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 600, color: w.forwarded_count > 0 ? ink : muted }}>
                    {w.forwarded_count > 0 ? money(w.forwarded_amount, sym, cur) : "—"}
                  </Box>
                  <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted }}>
                    {w.forwarded_count > 0 ? t("payouts.walletCount", { count: w.forwarded_count, defaultValue: "{{count}} payouts in range" }) : t("payouts.walletNoneRange", { defaultValue: "none in range" })}
                  </Box>
                </Box>
                <Box sx={{ textAlign: "right", display: "flex", alignItems: "center", gap: 1 }}>
                  <Box>
                    <Box data-testid="payouts-wallet-last" sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: ink, whiteSpace: "nowrap" }}>
                      {isIdle ? t("payouts.walletIdle", { defaultValue: "No payouts yet" }) : relativeTime(w.last_forward_at, t as any, i18n.language)}
                    </Box>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>{isIdle ? "" : t("payouts.lastPayout", { defaultValue: "last payout" })}</Box>
                  </Box>
                  {w.last_tx_hash && (
                    <Box
                      component="a"
                      href={explorerTxUrl(w.wallet_type, w.last_tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      aria-label={t("payouts.viewOnExplorer", { defaultValue: "View on explorer" }) as string}
                      data-testid="payouts-wallet-explorer"
                      sx={{ display: "flex", color: muted, "&:hover": { color: ink } }}
                    >
                      <Icon name="external-link" size={14} />
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </SurfaceCard>
  );
};

export default WalletsTimeline;
