import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { StatusDot, type StatusTone } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { formatDateTimeI18n } from "@/utils/formatDate";
import type { KycRecord } from "./useKycPage";

const TONE: Record<string, StatusTone> = {
  approved: "settled",
  submitted: "info",
  pending: "pending",
  resubmission_requested: "pending",
  declined: "failed",
  expired: "neutral",
  abandoned: "neutral",
};

/** Past verification attempts — only rendered when there is at least one record. */
const KycHistory: React.FC<{ records?: KycRecord[]; loading: boolean }> = ({ records, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  if (!loading && (!records || records.length === 0)) return null;

  const label = (s: string) =>
    t(`kycPage.status.${s}`, {
      defaultValue: { approved: "Approved", submitted: "In review", pending: "Started", resubmission_requested: "Needs another try", declined: "Declined", expired: "Expired", abandoned: "Abandoned" }[s] || s,
    });

  return (
    <PanelCard title={t("kycPage.historyTitle", { defaultValue: "Verification history" })} showHeaderBorder={false} bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 0.5, md: 1 }, pb: { xs: 1, md: 1.5 } }}>
      {loading ? (
        <Skeleton variant="rounded" height={48} />
      ) : (
        <Box component="ol" data-testid="kyc-history-list" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {(records || []).map((r, i) => (
            <Box component="li" key={r.kyc_id ?? r.id ?? i} data-testid="kyc-history-row" sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: `1px solid ${border}`, "&:last-of-type": { borderBottom: 0 } }}>
              <StatusDot tone={TONE[r.status] || "neutral"}>{label(r.status)}</StatusDot>
              {r.rejection_reason && (
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>{r.rejection_reason}</Typography>
              )}
              <Typography sx={{ ml: "auto", flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
                {formatDateTimeI18n(r.reviewed_at || r.submitted_at || r.created_at, { day: "2-digit", month: "short", year: "numeric" })}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </PanelCard>
  );
};

export default KycHistory;
