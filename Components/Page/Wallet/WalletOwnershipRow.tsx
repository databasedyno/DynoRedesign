import React from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import type { WalletDataType } from "@/utils/types/wallet";

interface Props {
  wallet: WalletDataType;
  onVerified: () => void;
}

/** "Verified with a wallet" chip for addresses verified historically. The active
 *  "Verify ownership by signing" (WalletConnect / Reown AppKit) action has been
 *  removed per request — see the note in the render below. */
const WalletOwnershipRow: React.FC<Props> = ({ wallet: w }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("walletScreen");
  const id = String(w.id);

  if (w.ownershipVerifiedAt) {
    const when = new Date(w.ownershipVerifiedAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });
    const tone = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
    const glow = isDark ? CB_TOKENS.semantic.positive.glowDark : CB_TOKENS.semantic.positive.glowLight;
    return (
      <Tooltip arrow placement="top" title={t("ownershipVerifiedTip", { defaultValue: "The owner signed a message from this address on {{when}} — it's under your control.", when })}>
        <Box
          component="span"
          data-testid={`wallet-ownership-verified-${id}`}
          sx={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.3, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: tone, backgroundColor: glow, whiteSpace: "nowrap" }}
        >
          <Icon name="shield-check" size={12} />
          {t("ownershipVerified", { defaultValue: "Ownership verified · {{via}}", via: w.ownershipVerifiedVia || "wallet" })}
        </Box>
      </Tooltip>
    );
  }

  // HIDDEN per request — WalletConnect "Verify ownership by signing" / "Connect
  // wallet & sign" ownership check removed. Payout addresses are secured by the
  // OTP step-up on add + address-format validation; on-chain wallet-signature
  // verification is no longer required. (Matches SafeDeal PayoutSettings and the
  // checkout / SafeDeal "Pay with wallet" removals.)
  return null;
};

export default WalletOwnershipRow;
