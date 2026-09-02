import React from "react";
import { Tooltip, Box } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useMerchantVerified } from "./useMerchantVerified";

/**
 * PublicVerifiedBadge — buyer-facing "Identity verified" check shown on public
 * payment pages, storefronts and receipts once the merchant behind the page is
 * KYC-approved. It's the anonymous counterpart of Components/UI/KycVerifiedBadge
 * (which needs a merchant JWT): it resolves verification via the read-only
 * public endpoint (see useMerchantVerified), keyed purely off a PUBLIC
 * identifier the surface already has — a storefront `handle`, a payment link
 * `linkRef` (the ?d= param) or a product `orderId`.
 *
 * Renders NOTHING until verified, so an unverified/unknown merchant is never
 * mislabelled and no visual noise is added.
 */
interface PublicVerifiedBadgeProps {
  handle?: string | null;
  linkRef?: string | null;
  orderId?: string | null;
  size?: number;
  /** Extra left margin so it sits neatly after a label/name. */
  ml?: number | string;
  /** Show the "Identity verified" text next to the check (e.g. on receipts). */
  showLabel?: boolean;
}

const PublicVerifiedBadge: React.FC<PublicVerifiedBadgeProps> = ({
  handle,
  linkRef,
  orderId,
  size = 16,
  ml = 0.5,
  showLabel = false,
}) => {
  const { t } = useTranslation("common");
  const verified = useMerchantVerified({ handle, linkRef, orderId });

  if (!verified) return null;

  const label = t("verifiedBadge.label", { defaultValue: "Identity verified" });
  const tooltip = t("verifiedBadge.tooltip", {
    defaultValue: "This merchant's identity has been verified by Dynopay",
  });

  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box
        component="span"
        data-testid="public-verified-badge"
        aria-label={label}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: showLabel ? 0.5 : 0,
          ml,
          lineHeight: showLabel ? 1.2 : 0,
          flexShrink: 0,
          ...(showLabel && {
            color: "#12B76A",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
          }),
        }}
      >
        <Icon icon="mdi:check-decagram" width={size} height={size} color="#12B76A" />
        {showLabel && <span>{label}</span>}
      </Box>
    </Tooltip>
  );
};

export default PublicVerifiedBadge;
