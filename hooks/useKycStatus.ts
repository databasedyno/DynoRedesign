import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

export interface KycStatus {
  requires_kyc?: boolean;
  needs_submission?: boolean;
  status?: string;
  is_exempt?: boolean;
  blocked?: boolean;
  has_active_session?: boolean;
  verification_url?: string | null;
  total_volume?: number;
  volume_threshold?: number;
  kyc_record?: { status?: string; submitted_at?: string | null; reviewed_at?: string | null; updated_at?: string | null; rejection_reason?: string | null } | null;
  grace_period?: {
    days_remaining?: number | null;
    grace_period_end?: string | null;
    blocked?: boolean;
  } | null;
}

export const fetchKycStatus = async (companyId?: number | string | null): Promise<KycStatus> => {
  const res: any = await axiosBaseApi.get(API_ENDPOINTS.kyc.status, {
    params: companyId ? { company_id: companyId } : {},
  });
  return (res?.data?.data ?? {}) as KycStatus;
};

/**
 * Single SWR entry for GET /api/kyc/status. The verified badge, the KYC gate
 * banner and the identity-lock hook all read this one key so a dashboard load
 * issues exactly one request instead of three.
 */
export function useKycStatus(companyId?: number | string | null) {
  const { selectedCompanyId, fetched, companyList } = useCompanyStore();
  const effectiveId = companyId ?? selectedCompanyId ?? undefined;
  // Wait for the company store to settle: firing with "self" first and then
  // again with the selected id is what caused 3 requests per dashboard load.
  // Account-level ("self") is only used when the user has no company at all.
  const ready = effectiveId != null || (fetched && companyList.length === 0);
  return useSWR(
    ready ? ["kyc/status", effectiveId ?? "self"] : null,
    () => fetchKycStatus(effectiveId),
    { revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false, dedupingInterval: 60000 },
  );
}
