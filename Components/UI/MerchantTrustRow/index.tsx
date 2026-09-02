import React from "react";
import { Box } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useMerchantVerified, MerchantVerifiedParams } from "../PublicVerifiedBadge/useMerchantVerified";

/**
 * MerchantTrustRow — a small, unobtrusive trust line for checkout footers:
 *
 *   🔒 Payments secured by Dynopay  ·  ✓ Verified merchant
 *
 * The "Verified merchant" segment (and its separator) only appears once the
 * merchant behind the checkout is KYC-identity-verified, resolved read-only
 * from a PUBLIC identifier (handle / linkRef / orderId) via the same endpoint
 * that powers PublicVerifiedBadge. The "secured by Dynopay" part always shows.
 */
interface MerchantTrustRowProps extends MerchantVerifiedParams {
  /** Muted color for the "secured by" text (theme-aware). */
  color?: string;
  justify?: "center" | "flex-start" | "flex-end";
  sx?: object;
}

const MerchantTrustRow: React.FC<MerchantTrustRowProps> = ({
  handle,
  linkRef,
  orderId,
  color = "#98A2B3",
  justify = "center",
  sx = {},
}) => {
  const { t } = useTranslation("common");
  const verified = useMerchantVerified({ handle, linkRef, orderId });

  const securedBy = t("verifiedBadge.securedBy", { defaultValue: "Payments secured by Dynopay" });
  const merchantLabel = t("verifiedBadge.merchantLabel", { defaultValue: "Verified merchant" });

  return (
    <Box
      data-testid="merchant-trust-row"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        gap: 0.75,
        flexWrap: "wrap",
        fontSize: 11.5,
        lineHeight: 1.4,
        ...sx,
      }}
    >
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color }}>
        <Icon icon="mdi:shield-check-outline" width={14} height={14} />
        <span>{securedBy}</span>
      </Box>
      {verified && (
        <>
          <Box component="span" sx={{ color, opacity: 0.6 }}>·</Box>
          <Box
            component="span"
            data-testid="trust-row-verified"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, color: "#12B76A", fontWeight: 600 }}
          >
            <Icon icon="mdi:check-decagram" width={14} height={14} color="#12B76A" />
            <span>{merchantLabel}</span>
          </Box>
        </>
      )}
    </Box>
  );
};

export default MerchantTrustRow;
