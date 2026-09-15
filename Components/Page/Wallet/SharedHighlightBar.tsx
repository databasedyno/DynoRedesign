import { Icon, MONO } from "@/styles/uiKit";
import type { WalletDataType } from "@/utils/types/wallet";
import { shortAddress } from "@/utils/walletAddressType";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  wallets: WalletDataType[];
  onJump: (id: string | number) => void;
  onClear: () => void;
}

/** Floating "N payout addresses share this address" bar shown while a shared-address highlight is active. */
const SharedHighlightBar: React.FC<Props> = ({ wallets, onJump, onClear }) => {
  const theme = useTheme();
  const { t } = useTranslation("walletScreen");
  const dark = theme.palette.mode === "dark";
  const indigo = dark ? "#818CF8" : "#4338CA";
  if (wallets.length === 0) return null;

  return (
    <Box
      role="status"
      data-testid="wallet-highlight-bar"
      sx={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: { xs: "calc(96px + env(safe-area-inset-bottom, 0px))", md: 24 },
        zIndex: 1100,
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 1.5,
        pr: 0.5,
        py: 0.75,
        borderRadius: 999,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${dark ? "rgba(129,140,248,0.45)" : "rgba(67,56,202,0.35)"}`,
        boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(15,23,42,0.18)",
        animation: "sharedBarIn 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "@keyframes sharedBarIn": {
          from: { opacity: 0, transform: "translate(-50%, 12px)" },
          to: { opacity: 1, transform: "translate(-50%, 0)" },
        },
      }}
    >
      <Icon name="link" size={14} color={indigo} />
      <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }} data-testid="wallet-highlight-title">
        {t("sharedHighlightTitle", { defaultValue: "{{n}} payout addresses share", n: wallets.length })}{" "}
        <Box component="span" sx={{ fontFamily: MONO, fontWeight: 500, color: theme.palette.text.secondary }}>
          {shortAddress(wallets[0].walletAddress, 6, 4)}
        </Box>
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, overflowX: "auto", maxWidth: { xs: 140, sm: 320, md: 560 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {wallets.map((w) => (
          <Box
            key={w.id}
            component="button"
            type="button"
            onClick={() => onJump(w.id)}
            data-testid={`wallet-highlight-jump-${w.id}`}
            sx={{ appearance: "none", m: 0, cursor: "pointer", height: 24, px: 1, borderRadius: 999, border: `1px solid ${indigo}`, backgroundColor: dark ? "rgba(129,140,248,0.14)" : "rgba(67,56,202,0.08)", color: indigo, fontFamily: MONO, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", "&:hover": { backgroundColor: indigo, color: dark ? "#0A0A0B" : "#fff" } }}
          >
            {w.walletTitle}
          </Box>
        ))}
      </Box>
      <Tooltip title={t("sharedHighlightClear", { defaultValue: "Clear highlight" })}>
        <IconButton size="small" onClick={onClear} aria-label={t("sharedHighlightClear", { defaultValue: "Clear highlight" })} data-testid="wallet-highlight-clear">
          <Icon name="x" size={16} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default SharedHighlightBar;
