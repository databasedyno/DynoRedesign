import { Chip, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdAddress } from "@/api/safedeal";

/** "Verified with a wallet" chip for a saved cashout address that was verified
 *  historically. The interactive WalletConnect "Verify it's yours" action was
 *  removed when WalletConnect was retired. */
export function AddressVerifyChip({ address: a }: { address: SdAddress }) {
  if (!a.ownership_verified_at) return null;
  return (
    <Tooltip title={`Signed from this address with ${a.ownership_verified_via || "a wallet"} on ${new Date(a.ownership_verified_at).toLocaleDateString()}`}>
      <Chip size="small" icon={<Icon icon="mdi:shield-check" width={14} />} label="Verified" data-testid={`sd-address-verified-${a.address_id}`} sx={{ fontWeight: 800, fontSize: 10.5, backgroundColor: "#ECFDF5", color: "#047857", "& .MuiChip-icon": { color: "#047857" } }} />
    </Tooltip>
  );
}

