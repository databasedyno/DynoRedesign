import React from "react";
import { Box } from "@mui/material";
import useKycPage from "./useKycPage";
import KycStatusHero from "./KycStatusHero";
import KycRequirements from "./KycRequirements";
import KycHistory from "./KycHistory";

/** /kyc — plan 3.10: status, what's needed, why, how long; a single Continue. */
const KycPage = () => {
  const kyc = useKycPage();
  const onContinue = kyc.view === "retry" ? kyc.retry : kyc.startVerification;

  return (
    <Box data-testid="kyc-page" sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.5 }, px: { xs: 2, md: 0 }, pb: { xs: 12, md: 4 } }}>
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
      {kyc.view !== "verified" && <KycRequirements requirements={kyc.requirements} />}
      <KycHistory records={kyc.history} loading={kyc.historyLoading} />
    </Box>
  );
};

export default KycPage;
