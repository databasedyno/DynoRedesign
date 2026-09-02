import React from "react";
import useSWR from "swr";
import { Tooltip, Box } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";

/**
 * PublicVerifiedBadge — buyer-facing "Identity verified" check shown on public
 * payment pages, storefronts and receipts once the merchant behind the page is
 * KYC-approved. It's the anonymous counterpart of Components/UI/KycVerifiedBadge
 * (which needs a merchant JWT): it hits the read-only public endpoint
 * GET /api/public/merchant-verification, resolving the merchant purely from a
 * PUBLIC identifier the surface already has — a storefront `handle`, a payment
 * link `linkRef` (the ?d= param) or a product `orderId`.
 *
 * Renders NOTHING until verified, so an unverified/unknown merchant is never
 * mislabelled and no visual noise is added. Uses a plain relative fetch (not
 * the merchant axios instance) so it is safe on unauthenticated buyer routes.
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

const buildUrl = (p: PublicVerifiedBadgeProps): string | null => {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const q = new URLSearchParams();
  if (p.handle) q.set("handle", String(p.handle));
  else if (p.linkRef) q.set("linkRef", String(p.linkRef));
  else if (p.orderId) q.set("orderId", String(p.orderId));
  else return null;
  return `${base}/api/public/merchant-verification?${q.toString()}`;
};

const fetchVerified = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.data?.verified);
  } catch {
    return false;
  }
};

const PublicVerifiedBadge: React.FC<PublicVerifiedBadgeProps> = ({
  handle,
  linkRef,
  orderId,
  size = 16,
  ml = 0.5,
  showLabel = false,
}) => {
  const { t } = useTranslation("common");
  const url = buildUrl({ handle, linkRef, orderId });

  const { data: verified } = useSWR(url, fetchVerified, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
  });

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
