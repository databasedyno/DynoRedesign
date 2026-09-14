import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { trackOnboarding } from "@/utils/trackOnboarding";
import WizardShell from "./WizardShell";
import StepAboutYou from "./StepAboutYou";
import StepPayouts from "./StepPayouts";
import StepFirstLink, { CreatedLink, linkFromRecord } from "./StepFirstLink";
import StepShare from "./StepShare";
import { STEP_TRACK_KEY } from "./stepMeta";
import { GS_AUTO_OPEN_KEY, SETUP_STEPS, SetupStepKey, useSetupProgress } from "./useSetupProgress";

const isStep = (v: unknown): v is SetupStepKey => typeof v === "string" && (SETUP_STEPS as string[]).includes(v);

/**
 * GetStartedWizard — the guided first run (plan 1.18). Four steps driven by
 * the URL (?step=) and resumed from REAL account data; every step can be left
 * with "Do this later" and picked up again from the dashboard hero.
 */
const GetStartedWizard: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const progress = useSetupProgress();
  const { ready, firstIncomplete, hasLink, newestLink, hasWallet } = progress;
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [forceLinkForm, setForceLinkForm] = useState(false);
  const shownTracked = useRef(false);

  const queryStep = isStep(router.query.step) ? router.query.step : null;

  const setStep = useCallback(
    (step: SetupStepKey, replace = false) => {
      const nav = replace ? router.replace : router.push;
      nav({ pathname: "/get-started", query: { step } }, undefined, { shallow: true, scroll: true });
    },
    [router],
  );

  // Resume from real data when no step is in the URL yet.
  useEffect(() => {
    if (!router.isReady || queryStep || !ready) return;
    setStep(firstIncomplete, true);
  }, [router.isReady, queryStep, ready, firstIncomplete, setStep]);

  useEffect(() => {
    if (shownTracked.current || !ready) return;
    shownTracked.current = true;
    trackOnboarding({ event_type: "checklist_shown", completed_count: progress.doneCount, metadata: { surface: "wizard" } });
  }, [ready, progress.doneCount]);

  const current: SetupStepKey = queryStep ?? firstIncomplete;
  const shareLink = useMemo(() => created ?? linkFromRecord(newestLink), [created, newestLink]);

  // Guard: "share" needs a link; "link" needs the wallet gate handled inside the step.
  useEffect(() => {
    if (!ready || !router.isReady) return;
    if (current === "share" && !shareLink) setStep("link", true);
  }, [current, shareLink, ready, router.isReady, setStep]);

  const goLater = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(GS_AUTO_OPEN_KEY, "1");
    trackOnboarding({ event_type: "dismissed", step_key: STEP_TRACK_KEY[current], metadata: { surface: "wizard" } });
    router.push("/dashboard");
  };

  const idx = SETUP_STEPS.indexOf(current);
  const goBack = () => setStep(SETUP_STEPS[Math.max(0, idx - 1)]);
  const goNext = () => setStep(SETUP_STEPS[Math.min(SETUP_STEPS.length - 1, idx + 1)]);

  if (!ready) {
    return (
      <Box data-testid="gs-loading" sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Box
          aria-label={t("gs.loading", { defaultValue: "Loading your setup…" })}
          role="status"
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid",
            borderColor: "divider",
            borderTopColor: "primary.main",
            animation: "gsSpin 0.8s linear infinite",
            "@keyframes gsSpin": { to: { transform: "rotate(360deg)" } },
          }}
        />
      </Box>
    );
  }

  return (
    <WizardShell progress={progress} current={current} onSelect={(s) => setStep(s)} onLater={goLater}>
      {current === "about" && <StepAboutYou progress={progress} onNext={goNext} />}
      {current === "payouts" && <StepPayouts progress={progress} onBack={goBack} onNext={goNext} />}
      {current === "link" && (
        <StepFirstLink
          key={forceLinkForm ? "new" : hasLink ? "existing" : "fresh"}
          progress={progress}
          onBack={goBack}
          onCreated={(l) => {
            setCreated(l);
            setJustCreated(true);
            setForceLinkForm(false);
            setStep("share");
          }}
          onUseExisting={() => {
            setJustCreated(false);
            setStep("share");
          }}
          onGoPayouts={() => setStep("payouts")}
        />
      )}
      {current === "share" && shareLink && (
        <StepShare
          link={shareLink}
          companyId={progress.companyId}
          justCreated={justCreated}
          onBack={() => setStep(hasWallet ? "link" : "payouts")}
          onDone={() => {
            if (typeof window !== "undefined") window.sessionStorage.setItem(GS_AUTO_OPEN_KEY, "1");
            router.push("/dashboard");
          }}
          onCreateAnother={() => {
            setCreated(null);
            setJustCreated(false);
            setForceLinkForm(true);
            setStep("link");
          }}
        />
      )}
    </WizardShell>
  );
};

export default GetStartedWizard;
