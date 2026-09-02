import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

/**
 * useIdentityVerified — reads the logged-in account's own KYC/ID status
 * (GET /api/kyc/status, account-level) and reports whether it is `approved`.
 *
 * Powers the "name is locked once identity-verified" rule on the brand-create
 * modal and the Profile settings name fields. Shares the SWR key
 * ["kyc/status","self"] with KycVerifiedBadge so the request is deduped/cached.
 */
const fetchKycStatus = async (): Promise<string> => {
  const res: any = await axiosBaseApi.get(API_ENDPOINTS.kyc.status);
  return String(res?.data?.data?.status ?? res?.data?.status ?? "");
};

export default function useIdentityVerified() {
  const { data, isLoading } = useSWR(["kyc/status", "self"], fetchKycStatus, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
  });
  return { verified: data === "approved", loading: !!isLoading, status: data };
}
