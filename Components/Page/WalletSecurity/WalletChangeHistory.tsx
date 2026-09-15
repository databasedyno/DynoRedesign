import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import { formatDateTimeI18n } from "@/utils/formatDate";
import type { WalletActivity } from "./useWalletSecurity";

interface Props {
  rows?: WalletActivity[] | "forbidden";
  loading: boolean;
}

const ICON_FOR: Record<string, string> = { "wallet.add": "lucide:plus", "wallet.update": "lucide:pencil", "wallet.change": "lucide:pencil", "wallet.delete": "lucide:trash-2" };

/** Every payout-wallet change on this brand, newest first (from the team activity log). */
const WalletChangeHistory: React.FC<Props> = ({ rows, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("walletScreen");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  const labelFor = (action: string, fallback: string | null) => {
    const key = action.replace("wallet.", "");
    const map: Record<string, string> = {
      add: t("security.historyAdd", { defaultValue: "Added a payout address" }),
      update: t("security.historyUpdate", { defaultValue: "Updated a payout address" }),
      change: t("security.historyChange", { defaultValue: "Changed a payout address" }),
      delete: t("security.historyDelete", { defaultValue: "Removed a payout address" }),
    };
    return map[key] || fallback || action;
  };

  let body: React.ReactNode;
  if (loading) {
    body = <Box sx={{ display: "grid", gap: 1 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={52} />)}</Box>;
  } else if (rows === "forbidden") {
    body = (
      <Typography data-testid="wallet-security-history-forbidden" sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
        {t("security.historyOwnerOnly", { defaultValue: "Only the brand owner can see payout address change history." })}
      </Typography>
    );
  } else if (!rows || rows.length === 0) {
    body = (
      <Box data-testid="wallet-security-history-empty" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: 1.5, p: 2, borderRadius: "12px", border: `1px dashed ${border}` }}>
        <Icon name="clipboard-clock" size={20} style={{ color: muted, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
          {t("security.historyEmpty", { defaultValue: "No payout address changes yet. Every add, edit or removal will show up here with who did it and when." })}
        </Typography>
        <CustomButton label={t("security.goToWallets", { defaultValue: "Payout addresses" })} variant="outlined" size="small" onClick={() => router.push("/wallet")} data-testid="wallet-security-history-go-wallets" />
      </Box>
    );
  } else {
    body = (
      <Box component="ol" data-testid="wallet-security-history-list" sx={{ listStyle: "none", m: 0, p: 0, display: "grid" }}>
        {rows.slice(0, 20).map((r) => (
          <Box component="li" key={r.id} data-testid="wallet-security-history-row" sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: `1px solid ${border}`, "&:last-of-type": { borderBottom: 0 } }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: theme.palette.text.secondary, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" }}>
              <Icon name={ICON_FOR[r.action] || "lucide:wallet"} size={15} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>{labelFor(r.action, r.description)}</Typography>
              <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
                {t("security.historyBy", { name: r.actor_name, defaultValue: "by {{name}}" })}
              </Typography>
            </Box>
            <Typography sx={{ flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 12, color: muted, textAlign: "right" }}>
              {formatDateTimeI18n(r.created_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <PanelCard title={t("security.historyTitle", { defaultValue: "Payout address change history" })} subTitle={t("security.historySubtitle", { defaultValue: "Who changed what, and when — for the selected brand." })} showHeaderBorder={false}>
      {body}
    </PanelCard>
  );
};

export default WalletChangeHistory;
