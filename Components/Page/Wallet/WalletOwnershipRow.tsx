import React, { useState } from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import WalletActionButton from "@/Components/Wallet/WalletActionButton";
import { isWalletPayable } from "@/lib/wallet/rails";
import { isWalletKitConfigured } from "@/lib/wallet/appkit";
import type { WalletDataType } from "@/utils/types/wallet";

interface Props {
  wallet: WalletDataType;
  onVerified: () => void;
}

/** "Verified with MetaMask" chip, or a small "Verify ownership" action (EVM / Tron / Solana). */
const WalletOwnershipRow: React.FC<Props> = ({ wallet: w, onVerified }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("walletScreen");
  const [open, setOpen] = useState(false);
  const id = String(w.id);

  if (!isWalletKitConfigured() || !isWalletPayable(w.walletTitle)) return null;

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

  if (!open) {
    return (
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`wallet-ownership-verify-open-${id}`}
        sx={{ all: "unset", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, "&:hover": { textDecoration: "underline" } }}
      >
        <Icon name="shield" size={13} />
        {t("ownershipVerifyCta", { defaultValue: "Verify ownership by signing" })}
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 360 }} data-testid={`wallet-ownership-verify-wrap-${id}`}>
      <WalletActionButton
        mode="verify"
        compact
        code={w.walletTitle}
        address={w.walletAddress}
        testId={`wallet-ownership-verify-${id}`}
        hint={t("ownershipVerifyHint", { defaultValue: "Free — signing a message never moves funds." })}
        labels={{ verify: t("ownershipVerifyBtn", { defaultValue: "Connect wallet & sign" }) }}
        requestNonce={async () => {
          const res: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.ownershipNonce, { wallet_id: w.id });
          return { nonce: res?.data?.data?.nonce, message: res?.data?.data?.message };
        }}
        submitSignature={async ({ nonce, signature, wallet_name }) => {
          await axiosBaseApi.post(API_ENDPOINTS.wallet.ownershipVerify, { wallet_id: w.id, nonce, signature, wallet_name });
        }}
        onVerified={onVerified}
      />
    </Box>
  );
};

export default WalletOwnershipRow;
