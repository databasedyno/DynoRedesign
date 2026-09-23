import React, { useState } from "react";
import { Box, Button, Chip, Collapse, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdAddress } from "@/api/safedeal";
import WalletActionButton, { SAFEDEAL_WALLET_BRAND } from "@/Components/Wallet/WalletActionButton";
import { isWalletPayable } from "@/lib/wallet/rails";
import { isWalletKitConfigured } from "@/lib/wallet/appkit";
import { SD_GOLD_DEEP, SD_TEXT_MUTED } from "../sdTheme";

interface Props {
  address: SdAddress;
  onVerified: () => void;
}

/** Verified chip / "Verify" action for a saved cashout address (EVM + Tron + Solana). */
export function AddressVerifyChip({ address: a }: { address: SdAddress }) {
  if (!a.ownership_verified_at) return null;
  return (
    <Tooltip title={`Signed from this address with ${a.ownership_verified_via || "a wallet"} on ${new Date(a.ownership_verified_at).toLocaleDateString()}`}>
      <Chip size="small" icon={<Icon icon="mdi:shield-check" width={14} />} label="Verified" data-testid={`sd-address-verified-${a.address_id}`} sx={{ fontWeight: 800, fontSize: 10.5, backgroundColor: "#ECFDF5", color: "#047857", "& .MuiChip-icon": { color: "#047857" } }} />
    </Tooltip>
  );
}

export function AddressVerifyAction({ address: a, onVerified }: Props) {
  const [open, setOpen] = useState(false);
  if (!isWalletKitConfigured() || a.ownership_verified_at || !isWalletPayable(a.payout_key)) return null;
  return (
    <Box sx={{ width: "100%" }}>
      {!open ? (
        <Button size="small" onClick={() => setOpen(true)} data-testid={`sd-address-verify-open-${a.address_id}`} startIcon={<Icon icon="mdi:shield-outline" width={15} />} sx={{ textTransform: "none", fontWeight: 800, fontSize: 12, borderRadius: 99, color: SD_GOLD_DEEP, px: 1, minHeight: 28 }}>
          Verify it&apos;s yours
        </Button>
      ) : null}
      <Collapse in={open} unmountOnExit>
        <Stack spacing={0.6} sx={{ mt: 0.8, maxWidth: 380 }} data-testid={`sd-address-verify-wrap-${a.address_id}`}>
          <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED }}>Connect the wallet that owns this address and sign a free message — nothing is sent.</Typography>
          <WalletActionButton
            mode="verify"
            compact
            brand={SAFEDEAL_WALLET_BRAND}
            code={a.payout_key}
            address={a.address}
            testId={`sd-address-verify-${a.address_id}`}
            labels={{ verify: "Connect wallet & sign" }}
            requestNonce={async () => {
              const n = await safedealApi.addressVerifyNonce(a.address_id);
              return { nonce: n.nonce, message: n.message };
            }}
            submitSignature={async ({ nonce, signature, wallet_name }) => {
              await safedealApi.addressVerify(a.address_id, { nonce, signature, wallet_name });
            }}
            onVerified={onVerified}
          />
        </Stack>
      </Collapse>
    </Box>
  );
}
