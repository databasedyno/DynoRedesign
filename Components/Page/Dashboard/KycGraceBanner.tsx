import React, { useState } from "react";
import useSWR from "swr";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import {
  GppMaybeRounded,
  VerifiedUserRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import CustomButton from "@/Components/UI/Buttons";

interface KycStatus {
  requires_kyc?: boolean;
  status?: string;
  is_exempt?: boolean;
  blocked?: boolean;
  has_active_session?: boolean;
  verification_url?: string | null;
  grace_period?: {
    days_remaining?: number | null;
    blocked?: boolean;
  } | null;
}

const fetchKyc = async (companyId?: number | string | null): Promise<KycStatus> => {
  const res: any = await axiosBaseApi.get(API_ENDPOINTS.kyc.status, {
    params: companyId ? { company_id: companyId } : {},
  });
  return (res?.data?.data ?? {}) as KycStatus;
};

/**
 * KycGraceBanner — a friendly, high-visibility notice during the KYC grace
 * period ("X days to verify") with a one-click "Start verification" action.
 * Renders nothing when KYC isn't required, is already approved, or the account
 * is exempt. Reuses GET /api/kyc/status (aligned to the enforcement source of
 * truth) and POST /api/kyc/submit to open the Veriff session.
 */
const KycGraceBanner: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { t } = useTranslation("dashboardLayout");
  const companyState = useCompanyStore();
  const companyId = companyState.selectedCompanyId ?? undefined;
  const [starting, setStarting] = useState(false);

  const { data } = useSWR(
    ["kyc/status/full", companyId ?? "self"],
    () => fetchKyc(companyId),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      dedupingInterval: 60000,
    },
  );

  if (!data) return null;
  if (!data.requires_kyc) return null;
  if (data.is_exempt) return null;
  if (data.status === "approved") return null;

  const blocked = !!(data.blocked || data.grace_period?.blocked);
  const daysRemaining =
    typeof data.grace_period?.days_remaining === "number"
      ? Math.max(0, data.grace_period.days_remaining)
      : null;
  const hasSession = !!(data.has_active_session && data.verification_url);

  const startVerification = async () => {
    if (starting) return;
    // Already have a live session — just continue it.
    if (hasSession && data.verification_url) {
      window.location.href = data.verification_url;
      return;
    }
    setStarting(true);
    try {
      const res: any = await axiosBaseApi.post(API_ENDPOINTS.kyc.submit, {
        company_id: companyId,
      });
      const url: string | undefined =
        res?.data?.data?.verification?.verification_url;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* fall through — user can retry */
    }
    setStarting(false);
  };

  // Palette: amber during grace, red once blocked.
  const accent = blocked ? "#DC2626" : "#D97706";
  const bg = blocked
    ? isDark
      ? "rgba(220,38,38,0.10)"
      : "rgba(220,38,38,0.06)"
    : isDark
      ? "rgba(217,119,6,0.12)"
      : "rgba(217,119,6,0.07)";
  const border = blocked
    ? "rgba(220,38,38,0.35)"
    : "rgba(217,119,6,0.35)";

  const headline = blocked
    ? t("kyc.blockedTitle", {
        defaultValue: "Verification overdue — payments are paused",
      })
    : daysRemaining !== null
      ? t("kyc.graceDays", {
          count: daysRemaining,
          defaultValue: `${daysRemaining} days to verify your identity`,
        })
      : t("kyc.graceGeneric", {
          defaultValue: "Verify your identity to keep processing payments",
        });

  const body = blocked
    ? t("kyc.blockedBody", {
        defaultValue:
          "You've passed the $10,000 volume threshold. Complete KYC now to resume accepting payments.",
      })
    : t("kyc.graceBody", {
        defaultValue:
          "You've passed the $10,000 volume threshold. Finish a quick identity check to stay unrestricted.",
      });

  return (
    <Box
      data-testid="kyc-grace-banner"
      data-kyc-blocked={blocked ? "true" : "false"}
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.75, sm: 1.75 },
        mb: 2,
        borderRadius: "14px",
        border: `1px solid ${border}`,
        backgroundColor: bg,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "10px",
          display: { xs: "none", sm: "flex" },
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
        }}
      >
        {blocked ? (
          <GppMaybeRounded sx={{ fontSize: 22, color: accent }} />
        ) : (
          <VerifiedUserRounded sx={{ fontSize: 22, color: accent }} />
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          data-testid="kyc-grace-days"
          sx={{
            fontSize: { xs: "14px", sm: "15px" },
            fontWeight: 700,
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.primary,
            lineHeight: 1.3,
          }}
        >
          {headline}
        </Typography>
        <Typography
          sx={{
            mt: 0.25,
            fontSize: { xs: "12.5px", sm: "13px" },
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.secondary,
            lineHeight: 1.4,
          }}
        >
          {body}
        </Typography>
      </Box>

      <Box sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
        <CustomButton
          data-testid="kyc-grace-start-btn"
          label={
            hasSession
              ? t("kyc.continueVerification", {
                  defaultValue: "Continue verification",
                })
              : t("kyc.startVerification", {
                  defaultValue: "Start verification",
                })
          }
          variant="primary"
          size={isMobile ? "medium" : "small"}
          fullWidth={isMobile}
          loading={starting}
          endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
          onClick={startVerification}
        />
      </Box>
    </Box>
  );
};

export default KycGraceBanner;
