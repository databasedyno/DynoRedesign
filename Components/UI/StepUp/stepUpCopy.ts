import type { TFunction } from "i18next";
import type { StepUpScope } from "./stepUpBus";

/** Scope → what the user is about to unlock (shown in the dialog body). */
export const scopeActionLabel = (t: TFunction, scope: StepUpScope): string => {
  const map: Record<StepUpScope, [string, string]> = {
    apikey: ["stepUp.scope.apikey", "manage API keys"],
    wallet: ["stepUp.scope.wallet", "change payout addresses"],
    brand_delete: ["stepUp.scope.brand_delete", "delete a brand"],
    security: ["stepUp.scope.security", "change your security settings"],
    payout: ["stepUp.scope.payout", "change your payout settings"],
    team: ["stepUp.scope.team", "change team access"],
    settlement: ["stepUp.scope.settlement", "change your settlement currency"],
  };
  const [key, fallback] = map[scope] || map.security;
  return t(key, { defaultValue: fallback });
};
