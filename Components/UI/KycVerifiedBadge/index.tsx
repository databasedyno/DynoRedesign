import React from "react";
import { Tooltip, Box } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useKycStatus } from "@/hooks/useKycStatus";

/**
 * KycVerifiedBadge — a small "identity verified" check shown next to a
 * business name once the company's KYC status is `approved`
 * (GET /api/kyc/status). Renders NOTHING until verified, so it never adds
 * visual noise for accounts that haven't completed verification.
 *
 * Reads the shared useKycStatus SWR entry (one request per dashboard load),
 * keyed by companyId so it updates when the merchant switches business.
 */
interface KycVerifiedBadgeProps {
  companyId?: number | string | null;
  size?: number;
  /** Extra left margin so it sits neatly after a label. */
  ml?: number | string;
}

const KycVerifiedBadge: React.FC<KycVerifiedBadgeProps> = ({ companyId, size = 16, ml = 0.5 }) => {
  const { t } = useTranslation("dashboardLayout");
  const { data } = useKycStatus(companyId);

  if (data?.status !== "approved") return null;

  return (
    <Tooltip
      title={t("kyc.verifiedTooltip", { defaultValue: "Identity verified" })}
      arrow
      placement="top"
    >
      <Box
        component="span"
        data-testid="kyc-verified-badge"
        aria-label={t("kyc.verifiedTooltip", { defaultValue: "Identity verified" })}
        sx={{ display: "inline-flex", alignItems: "center", ml, lineHeight: 0, flexShrink: 0 }}
      >
        <Icon icon="mdi:check-decagram" width={size} height={size} color="#12B76A" />
      </Box>
    </Tooltip>
  );
};

export default KycVerifiedBadge;
