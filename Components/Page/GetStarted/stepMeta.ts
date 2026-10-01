import type { SetupStepKey, SetupTrack } from "./useSetupProgress";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export const STEP_ICON: Record<SetupStepKey, string> = {
  secure: "shield-check",
  about: "user-round",
  payouts: "wallet",
  link: "link",
  share: "send",
};

/** Developer track swaps the last two steps for "API key" + "test payment". */
const DEV_STEP_ICON: Partial<Record<SetupStepKey, string>> = {
  link: "key-round",
  share: "flask-conical",
};

/** Creator track: claim @handle → share your page. */
const CREATOR_STEP_ICON: Partial<Record<SetupStepKey, string>> = {
  link: "at-sign",
  share: "megaphone",
};

/** Fundraiser track: first campaign → share your campaign. */
const FUNDRAISER_STEP_ICON: Partial<Record<SetupStepKey, string>> = {
  link: "hand-heart",
  share: "send",
};

export const stepIcon = (key: SetupStepKey, track: SetupTrack = "default"): string => {
  if (track === "developers" && DEV_STEP_ICON[key]) return DEV_STEP_ICON[key]!;
  if (track === "creators" && CREATOR_STEP_ICON[key]) return CREATOR_STEP_ICON[key]!;
  if (track === "fundraisers" && FUNDRAISER_STEP_ICON[key]) return FUNDRAISER_STEP_ICON[key]!;
  return STEP_ICON[key];
};

/** Analytics step keys for the 5 wizard steps. */
export const STEP_TRACK_KEY: Record<SetupStepKey, "security" | "company" | "wallet" | "link" | "payment"> = {
  secure: "security",
  about: "company",
  payouts: "wallet",
  link: "link",
  share: "payment",
};

export const stepLabel = (t: TFunction, key: SetupStepKey, track: SetupTrack = "default"): string => {
  if (track === "developers") {
    if (key === "link") return t("gs.stepApiKey", { defaultValue: "Your API key" });
    if (key === "share") return t("gs.stepTestPayment", { defaultValue: "Make a test payment" });
  }
  if (track === "creators") {
    if (key === "link") return t("gs.stepHandle", { defaultValue: "Claim your @handle" });
    if (key === "share") return t("gs.stepSharePage", { defaultValue: "Share your page" });
  }
  if (track === "fundraisers") {
    if (key === "link") return t("gs.stepCampaign", { defaultValue: "Your first campaign" });
    if (key === "share") return t("gs.stepShareCampaign", { defaultValue: "Share your campaign" });
  }
  switch (key) {
    case "secure":
      return t("gs.stepSecure", { defaultValue: "Secure your account" });
    case "about":
      return t("gs.stepAbout", { defaultValue: "About you" });
    case "payouts":
      return t("gs.stepPayouts", { defaultValue: "Where payouts go" });
    case "link":
      return t("gs.stepLink", { defaultValue: "Your first payment link" });
    default:
      return t("gs.stepShare", { defaultValue: "Share it" });
  }
};

export const stepDesc = (t: TFunction, key: SetupStepKey, track: SetupTrack = "default"): string => {
  if (track === "developers") {
    if (key === "link") return t("gs.stepApiKeyDesc", { defaultValue: "A sandbox key to build and test with" });
    if (key === "share") return t("gs.stepTestPaymentDesc", { defaultValue: "Simulate a payment end-to-end — no real funds" });
  }
  if (track === "creators") {
    if (key === "link") return t("gs.stepHandleDesc", { defaultValue: "Your public page lives at dynopay.com/handle" });
    if (key === "share") return t("gs.stepSharePageDesc", { defaultValue: "Copy, QR or post it — tips land in your wallet" });
  }
  if (track === "fundraisers") {
    if (key === "link") return t("gs.stepCampaignDesc", { defaultValue: "A goal, a story and suggested amounts" });
    if (key === "share") return t("gs.stepShareCampaignDesc", { defaultValue: "Copy, QR or send it — then watch the goal fill" });
  }
  switch (key) {
    case "secure":
      return t("gs.stepSecureDesc", { defaultValue: "Authenticator app or email codes" });
    case "about":
      return t("gs.stepAboutDesc", { defaultValue: "Your name, brand and country" });
    case "payouts":
      return t("gs.stepPayoutsDesc", { defaultValue: "The address your funds are forwarded to" });
    case "link":
      return t("gs.stepLinkDesc", { defaultValue: "Amount, description and a live preview" });
    default:
      return t("gs.stepShareDesc", { defaultValue: "Copy, QR or send it — then get paid" });
  }
};
