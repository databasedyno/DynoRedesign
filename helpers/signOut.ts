import { clearOnboardingSessionFlags } from "@/Components/Page/GetStarted/useSetupProgress";
import { clearCachedBrands } from "@/contexts/CompanyDataContext";

/** Sign the merchant out of this tab (account menu + phone More sheet). */
export const signOut = () => {
  if (typeof window === "undefined") return;
  // A fresh login in this tab must be able to resume the setup wizard.
  clearOnboardingSessionFlags();
  clearCachedBrands();
  try {
    window.sessionStorage.setItem("dp_signed_out", "1");
  } catch {
    /* storage unavailable */
  }
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("refreshToken");
  window.location.replace("/");
};
