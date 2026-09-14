import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import useTokenData from "@/hooks/useTokenData";

export interface MfaEnforcement {
  enrolled: boolean;
  method: "totp" | "email" | null;
  deadline_at: string | null;
  days_left: number | null;
  hard_wall: boolean;
}

const fetcher = async (url: string): Promise<MfaEnforcement> => {
  const res = await axiosBaseApi.get(url);
  return res.data?.data as MfaEnforcement;
};

/** Mandatory-2FA rollout state for the signed-in merchant (soft wall → hard wall). */
export const useMfaEnforcement = () => {
  const tokenData = useTokenData();
  const isLoggedIn = !!tokenData?.user_id;
  const { data, error, isLoading, mutate } = useSWR<MfaEnforcement>(isLoggedIn ? API_ENDPOINTS.user.twoFaEnforcement : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  // Bound mutate: the app uses a custom SWR cache provider, so the global `mutate` would miss it.
  return { enforcement: data, loading: isLoading && !data, isLoggedIn, settled: isLoggedIn && (data !== undefined || !!error), refresh: () => mutate() };
};
