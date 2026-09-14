import { useState } from "react";
import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useKycGate } from "@/hooks/useKycGate";

export type KycView = "verified" | "in_review" | "retry" | "action_needed" | "not_needed";

export interface KycRequirements {
  volume_threshold: number;
  grace_period_days: number;
  required_documents: Array<{ type: string; name: string; description: string; required: boolean }>;
  verification_process: string[];
  estimated_time: string;
  verification_partner: string;
}

export interface KycRecord {
  kyc_id?: number;
  id?: number;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  rejection_reason: string | null;
}

const RETRY_STATUSES = new Set(["declined", "expired", "resubmission_requested", "abandoned"]);

/** One derived view-state for the /kyc page + the single Continue action (plan 3.10). */
export const useKycPage = () => {
  const gate = useKycGate();
  const { data } = gate;
  const requirements = useSWR<KycRequirements>(API_ENDPOINTS.kyc.requirements, async (u: string) => (await axiosBaseApi.get(u)).data?.data?.requirements);
  const history = useSWR<KycRecord[]>(API_ENDPOINTS.kyc.history, async (u: string) => (await axiosBaseApi.get(u)).data?.data?.records || []);
  const [retrying, setRetrying] = useState(false);

  const status = String(data?.status || "not_started");
  const view: KycView =
    status === "approved"
      ? "verified"
      : status === "submitted" || (status === "pending" && data?.has_active_session)
        ? "in_review"
        : RETRY_STATUSES.has(status)
          ? "retry"
          : gate.required
            ? "action_needed"
            : "not_needed";

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res: any = await axiosBaseApi.post(API_ENDPOINTS.kyc.resubmit);
      const url: string | undefined = res?.data?.data?.verification?.verification_url;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      /* user can retry */
    }
    setRetrying(false);
  };

  return {
    ...gate,
    view,
    status,
    requirements: requirements.data,
    history: history.data,
    historyLoading: history.isLoading && !history.data,
    retry,
    busy: gate.starting || retrying,
  };
};

export default useKycPage;
