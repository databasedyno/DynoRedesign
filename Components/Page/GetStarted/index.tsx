import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { trackOnboarding } from "@/utils/trackOnboarding";
import WizardShell from "./WizardShell";
import StepSecure from "./StepSecure";
import StepAboutYou from "./StepAboutYou";
import StepPayouts from "./StepPayouts";
import StepFirstLink, { CreatedLink, linkFromRecord } from "./StepFirstLink";
import StepFirstCampaign, { campaignFromRecord } from "./StepFirstCampaign";
import StepClaimHandle from "./StepClaimHandle";
import StepShare from "./StepShare";
import StepApiKey from "./StepApiKey";
import StepTestPayment from "./StepTestPayment";
import { STEP_TRACK_KEY } from "./stepMeta";
import { GS_AUTO_OPEN_KEY, SETUP_STEPS, SetupStepKey, useSetupProgress } from "./useSetupProgress";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";

const isStep = (v: unknown): v is SetupStepKey => typeof v === "string" && (SETUP_STEPS as string[]).includes(v);

/**
 * GetStartedWizard — the guided first run (plan 1.18). Five steps driven by
 * the URL (?step=) and resumed from REAL account data; every step can be left
 * with "Do this later" and picked up again from the dashboard hero.
 */
const GetStartedWizard: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const progress = useSetupProgress();
  const { ready, firstIncomplete, hasLink, newestLink, hasWallet, twoFaEnrolled, track, hasApiKey, hasCampaign, newestCampaign, hasHandle, handle } = progress;
  const isDev = track === "developers";
  const isCreator = track === "creators";
  const isFundraiser = track === "fundraisers";
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [forceLinkForm, setForceLinkForm] = useState(false);
  // Creator track: the artefact is a claimed @handle, not a created link row.
  const [claimedHandle, setClaimedHandle] = useState<string | null>(null);
  const shownTracked = useRef(false);

  const creatorBase = useMemo(() => getCreatorBaseUrl().replace(/\/+$/, ""), []);

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
  // The step-5 "share" artefact differs per track: a created/existing link
  // (default), a donation campaign (fundraisers) or the public page URL (creators).
  const handleForUrl = claimedHandle || handle;
  const pageShareLink = useMemo<CreatedLink | null>(
    () => (handleForUrl ? { url: `${creatorBase}/${handleForUrl}`, amount: "", currency: "", description: `@${handleForUrl}` } : null),
    [handleForUrl, creatorBase],
  );
  const campaignShareLink = useMemo(() => created ?? campaignFromRecord(newestCampaign), [created, newestCampaign]);
  const linkShareLink = useMemo(() => created ?? linkFromRecord(newestLink), [created, newestLink]);
  const shareLink = isCreator ? pageShareLink : isFundraiser ? campaignShareLink : linkShareLink;
  const shareArtefactReady = isDev
    ? hasApiKey
    : isCreator
      ? (hasHandle || !!claimedHandle)
      : isFundraiser
        ? (hasCampaign || !!created)
        : !!shareLink;

  // Guards: the money steps (payouts → share) need a second factor first; "share"
  // needs step 4's artefact (link / campaign / @handle / API key) to exist.
  useEffect(() => {
    if (!ready || !router.isReady) return;
    if (!twoFaEnrolled && SETUP_STEPS.indexOf(current) >= SETUP_STEPS.indexOf("payouts")) return void setStep("secure", true);
    if (current === "share" && !shareArtefactReady) setStep("link", true);
  }, [current, shareArtefactReady, ready, router.isReady, setStep, twoFaEnrolled]);

  const finishTo = (path: string, trackName: string) => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(GS_AUTO_OPEN_KEY, "1");
    trackOnboarding({ event_type: "step_completed", step_key: "payment", metadata: { surface: "wizard", track: trackName } });
    router.push(path);
  };
  const finishDev = () => finishTo("/developer-keys", "developers");

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
      {current === "secure" && <StepSecure progress={progress} onNext={goNext} />}
      {current === "about" && <StepAboutYou progress={progress} onBack={goBack} onNext={goNext} />}
      {current === "payouts" && <StepPayouts progress={progress} onBack={goBack} onNext={goNext} />}

      {/* ── Step 4 — swaps per track ─────────────────────────────── */}
      {current === "link" && isDev && <StepApiKey progress={progress} onBack={goBack} onNext={goNext} />}
      {current === "link" && isCreator && (
        <StepClaimHandle
          progress={progress}
          onBack={goBack}
          onNext={(h) => {
            if (h) setClaimedHandle(h);
            setJustCreated(true);
            setStep("share");
          }}
        />
      )}
      {current === "link" && isFundraiser && (
        <StepFirstCampaign
          key={forceLinkForm ? "new" : hasCampaign ? "existing" : "fresh"}
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
      {current === "link" && !isDev && !isCreator && !isFundraiser && (
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

      {/* ── Step 5 — swaps per track ─────────────────────────────── */}
      {current === "share" && isDev && (
        <StepTestPayment progress={progress} onBack={goBack} onGoApiKey={() => setStep("link")} onFinish={finishDev} />
      )}
      {current === "share" && isCreator && shareLink && (
        <StepShare
          variant="page"
          link={shareLink}
          companyId={progress.companyId}
          justCreated={justCreated}
          onBack={() => setStep(hasWallet ? "link" : "payouts")}
          onDone={() => finishTo("/storefront?tab=page", "creators")}
        />
      )}
      {current === "share" && isFundraiser && shareLink && (
        <StepShare
          variant="campaign"
          link={shareLink}
          companyId={progress.companyId}
          justCreated={justCreated}
          onBack={() => setStep(hasWallet ? "link" : "payouts")}
          onDone={() => finishTo("/pay-links", "fundraisers")}
          onCreateAnother={() => {
            setCreated(null);
            setJustCreated(false);
            setForceLinkForm(true);
            setStep("link");
          }}
        />
      )}
      {current === "share" && !isDev && !isCreator && !isFundraiser && shareLink && (
        <StepShare
          variant="link"
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
