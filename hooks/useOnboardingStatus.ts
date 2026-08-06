import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";

const KEY = "/user/onboarding-status";

const fetcher = async (url: string) => {
  const res = await axiosBaseApi.get(url);
  return res?.data?.data;
};

/**
 * Shared onboarding-status reader. Both the header and the mobile bottom-nav
 * need `kyc_required`; routing it through SWR means it's fetched ONCE per
 * page (deduped) instead of once per component.
 */
export function useOnboardingStatus() {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const { data } = useSWR(hasToken ? KEY : null, fetcher, {
    dedupingInterval: 60_000,
  });
  const kycRequired = Boolean(data?.kyc_required || data?.kycRequired);
  return { data, kycRequired };
}

export default useOnboardingStatus;
