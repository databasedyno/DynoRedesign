import React from "react";
import useSWR from "swr";
import { Tooltip, Box } from "@mui/material";
import { Icon } from "@iconify/react";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useTranslation } from "react-i18next";

/**
 * KycVerifiedBadge — a small "identity verified" check shown next to a
 * business name once the company's KYC status is `approved`
 * (GET /api/kyc/status). Renders NOTHING until verified, so it never adds
 * visual noise for accounts that haven't completed verification.
 *
 * Deliberately read-only + self-contained: fetches its own status via SWR
 * (deduped/cached across the app), keyed by companyId so it updates when the
 * merchant switches business.
 */
interface KycVerifiedBadgeProps {
  companyId?: number | string | null;
  size?: number;
  /** Extra left margin so it sits neatly after a label. */
  ml?: number | string;
}

const fetchKycStatus = async (companyId?: number | string | null): Promise<string> => {
  const res: any = await axiosBaseApi.get(API_ENDPOINTS.kyc.status, {
    params: companyId ? { company_id: companyId } : {},
  });
  // successResponseHelper -> { success, message, data:{ status, ... } }
  return String(res?.data?.data?.status ?? res?.data?.status ?? "");
};

const KycVerifiedBadge: React.FC<KycVerifiedBadgeProps> = ({ companyId, size = 16, ml = 0.5 }) => {
  const { t } = useTranslation("dashboardLayout");
  const { data: status } = useSWR(
    ["kyc/status", companyId ?? "self"],
    () => fetchKycStatus(companyId),
    { revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false, dedupingInterval: 60000 },
  );

  if (status !== "approved") return null;

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
