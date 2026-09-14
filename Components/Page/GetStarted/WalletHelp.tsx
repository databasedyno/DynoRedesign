import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

const WALLETS = [
  { name: "Trust Wallet", coins: "BTC · ETH · USDT · TRX · SOL · more", url: "https://trustwallet.com", icon: "wallet" },
  { name: "MetaMask", coins: "ETH · USDT/USDC (ERC-20, Polygon)", url: "https://metamask.io", icon: "wallet" },
  { name: "TronLink", coins: "TRX · USDT (TRC-20)", url: "https://www.tronlink.org", icon: "wallet" },
  { name: "Phantom", coins: "SOL", url: "https://phantom.app", icon: "wallet" },
  { name: "Exodus", coins: "BTC · LTC · DOGE · XRP · more", url: "https://www.exodus.com", icon: "wallet" },
];

/** A2 — "Don't have a wallet yet?" helper: 60-second setup path + the one-stablecoin shortcut. */
const WalletHelp: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const [open, setOpen] = useState(false);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  return (
    <Box data-testid="gs-wallet-help" sx={{ mt: 1.5 }}>
      <Box
        component="button"
        type="button"
        data-testid="gs-wallet-help-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, border: 0, background: "transparent", cursor: "pointer", p: 0.5, borderRadius: 6, fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 700, color: indigo, "&:focus-visible": { outline: `2px solid ${indigo}` } }}
      >
        <Icon name="circle-help" size={16} />
        {t("gs.noWalletQ", { defaultValue: "Don't have a crypto wallet yet?" })}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={15} />
      </Box>

      {open && (
        <Box data-testid="gs-wallet-help-body" sx={{ mt: 1.25, p: { xs: 1.75, md: 2 }, borderRadius: "14px", border: `1px solid ${border}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)" }}>
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.55, color: ink }}>
            {t("gs.noWalletIntro", { defaultValue: "A wallet is a free app that holds your coins — you keep the keys, Dynopay only forwards payments to it. Installing one takes about a minute." })}
          </Box>

          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: "12px", border: `1px solid ${indigo}`, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow, display: "flex", gap: 1.25, alignItems: "flex-start" }}>
            <Box sx={{ color: indigo, mt: "1px" }}><Icon name="zap" size={18} /></Box>
            <Box>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 700, color: ink }}>
                {t("gs.quickPathTitle", { defaultValue: "Fastest path: one stablecoin address" })}
              </Box>
              <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
                {t("gs.quickPathBody", { defaultValue: "Add a single USDT (Tron) address — fees are cents and it settles in seconds. You can accept every other coin later, or turn on auto-convert so everything lands as USDT." })}
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: 1.5, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
            {t("gs.recommendedWallets", { defaultValue: "Popular wallets" })}
          </Box>
          <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 0.75, p: 0, display: "grid", gap: 0.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {WALLETS.map((w) => (
              <Box component="li" key={w.name}>
                <Box
                  component="a"
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`gs-wallet-link-${w.name.toLowerCase().replace(/\s+/g, "-")}`}
                  sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 1, borderRadius: "10px", border: `1px solid ${border}`, textDecoration: "none", color: ink, "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)" } }}
                >
                  <Box sx={{ color: indigo, display: "flex" }}><Icon name={w.icon} size={16} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 700 }}>{w.name}</Box>
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.coins}</Box>
                  </Box>
                  <Icon name="external-link" size={14} color={muted} />
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 1.25, fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.5, color: muted }}>
            {t("gs.noWalletSteps", { defaultValue: "Install → create a wallet → write down the recovery phrase → tap Receive, pick the coin, copy the address → paste it here." })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default WalletHelp;
