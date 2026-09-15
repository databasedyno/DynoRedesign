import type { SetupStepKey } from "./useSetupProgress";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export const STEP_ICON: Record<SetupStepKey, string> = {
  secure: "shield-check",
  about: "user-round",
  payouts: "wallet",
  link: "link",
  share: "send",
};

/** Analytics step keys for the 5 wizard steps. */
export const STEP_TRACK_KEY: Record<SetupStepKey, "security" | "company" | "wallet" | "link" | "payment"> = {
  secure: "security",
  about: "company",
  payouts: "wallet",
  link: "link",
  share: "payment",
};

export const stepLabel = (t: TFunction, key: SetupStepKey): string => {
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

export const stepDesc = (t: TFunction, key: SetupStepKey): string => {
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
