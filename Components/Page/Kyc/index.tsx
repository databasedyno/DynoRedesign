import React from "react";
import { Box, Skeleton } from "@mui/material";
import useKycPage from "./useKycPage";
import KycStatusHero from "./KycStatusHero";
import KycRequirements from "./KycRequirements";
import KycHistory from "./KycHistory";
import KycTimeline from "./KycTimeline";
import KycVolumeMeter from "./KycVolumeMeter";
import KycGraceRing from "./KycGraceRing";
import KycJourney from "./KycJourney";
import KycCapabilities from "./KycCapabilities";
import KycFaq from "./KycFaq";
import { deriveKycInsights } from "./kycInsights";

const gap = { xs: 2, md: 2.5 };

/**
 * /kyc — plan 3.10: status, what's needed, why, how long; a single Continue.
 * 2026-10: + confidence visuals — volume meter to the threshold, grace countdown
 * ring, 3-stage path with "You are here", a live "What works right now" list
 * (settlement always on) and an FAQ. All derived from GET /kyc/status via
 * deriveKycInsights, which mirrors backend/helper/kycEnforcement.ts.
 */
const KycPage = () => {
  const kyc = useKycPage();
  const onContinue = kyc.view === "retry" ? kyc.retry : kyc.startVerification;
  const insights = deriveKycInsights(kyc.data, kyc.requirements);

  return (
    <Box data-testid="kyc-page" data-stage={insights.ready ? insights.stage : "loading"} sx={{ display: "flex", flexDirection: "column", gap, px: { xs: 2, md: 0 }, pb: { xs: 12, md: 4 } }}>
      <KycStatusHero
        view={kyc.view}
        loading={kyc.loading}
        data={kyc.data}
        daysRemaining={kyc.daysRemaining}
        blocked={kyc.blocked}
        hasSession={kyc.hasSession}
        busy={kyc.busy}
        estimatedTime={kyc.requirements?.estimated_time}
        onContinue={onContinue}
      />

      {kyc.loading || !insights.ready ? (
        <Box data-testid="kyc-visuals-loading" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(0, 1fr)" }, gap }}>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={260} />
        </Box>
      ) : (
        <>
          <Box data-testid="kyc-visuals" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(0, 1fr)" }, gap, alignItems: "stretch" }}>
            <KycVolumeMeter k={insights} />
            <KycGraceRing k={insights} />
          </Box>
          <KycJourney k={insights} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(0, 1fr)" }, gap, alignItems: "stretch" }}>
            <KycCapabilities k={insights} />
            <KycFaq k={insights} />
          </Box>
          <KycTimeline view={kyc.view} status={kyc.status} latest={kyc.data?.kyc_record ?? kyc.history?.[0] ?? null} />
        </>
      )}
      {/* Wait for the real status: before it resolves the view defaults to "not_needed",
          which flashed the Requirements card for verified accounts. */}
      {!kyc.settled ? (
        <Skeleton data-testid="kyc-requirements-loading" variant="rounded" height={120} sx={{ borderRadius: "16px" }} />
      ) : (
        kyc.view !== "verified" && <KycRequirements requirements={kyc.requirements} />
      )}
      <KycHistory records={kyc.history} loading={kyc.historyLoading} />
    </Box>
  );
};

export default KycPage;
