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

export const stepIcon = (key: SetupStepKey, track: SetupTrack = "default"): string =>
  (track === "developers" && DEV_STEP_ICON[key]) || STEP_ICON[key];

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
