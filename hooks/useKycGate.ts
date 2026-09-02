import { useState } from "react";
import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

export interface KycStatus {
  requires_kyc?: boolean;
  status?: string;
  is_exempt?: boolean;
  blocked?: boolean;
  has_active_session?: boolean;
  verification_url?: string | null;
  grace_period?: {
    days_remaining?: number | null;
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
 * Single source of truth for "does this merchant need to verify identity to
 * keep getting paid". Shared by the dashboard grace banner and the
 * /create-pay-link setup guard so both read the same SWR entry.
 */
export function useKycGate() {
  const companyState = useCompanyStore();
  const companyId = companyState.selectedCompanyId ?? undefined;
  const [starting, setStarting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    ["kyc/status/full", companyId ?? "self"],
    () => fetchKycStatus(companyId),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      dedupingInterval: 60000,
    },
  );

  const required = !!data && !!data.requires_kyc && !data.is_exempt && data.status !== "approved";
  const blocked = required && !!(data?.blocked || data?.grace_period?.blocked);
  const daysRemaining =
    required && typeof data?.grace_period?.days_remaining === "number"
      ? Math.max(0, data.grace_period.days_remaining)
      : null;
  const hasSession = required && !!(data?.has_active_session && data?.verification_url);

  const startVerification = async () => {
    if (starting) return;
    if (hasSession && data?.verification_url) {
      window.location.href = data.verification_url;
      return;
    }
    setStarting(true);
    try {
      const res: any = await axiosBaseApi.post(API_ENDPOINTS.kyc.submit, { company_id: companyId });
      const url: string | undefined = res?.data?.data?.verification?.verification_url;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* user can retry */
    }
    setStarting(false);
  };

  return {
    data,
    loading: isLoading && !data && !error,
    required,
    blocked,
    daysRemaining,
    hasSession,
    starting,
    startVerification,
    refresh: mutate,
  };
}

export default useKycGate;
