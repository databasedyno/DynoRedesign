import React from "react";
import { Box } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import type { MerchantVerifiedParams } from "../PublicVerifiedBadge/useMerchantVerified";

/**
 * MerchantTrustRow — a small, unobtrusive trust line for checkout footers:
 * "Payments secured by Dynopay". The merchant's verified status is shown ONCE
 * per page by PublicVerifiedBadge next to the merchant name, so this row no
 * longer repeats it (two "verified" marks read as if the *buyer* were verified).
 * Identifier props are kept for call-site compatibility.
 */
interface MerchantTrustRowProps extends MerchantVerifiedParams {
  color?: string;
  justify?: "flex-start" | "center" | "flex-end";
  sx?: Record<string, unknown>;
}

const MerchantTrustRow: React.FC<MerchantTrustRowProps> = ({ color = "#5D6B82", justify = "center", sx = {} }) => {
  const { t } = useTranslation("common");
  const securedBy = t("verifiedBadge.securedBy", { defaultValue: "Payments secured by Dynopay" });

  return (
    <Box
      data-testid="merchant-trust-row"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        gap: 0.5,
        fontSize: 11.5,
        lineHeight: 1.4,
        color,
        ...sx,
      }}
    >
      <Icon icon="mdi:shield-check-outline" width={14} height={14} />
      <span>{securedBy}</span>
    </Box>
  );
};

export default MerchantTrustRow;
