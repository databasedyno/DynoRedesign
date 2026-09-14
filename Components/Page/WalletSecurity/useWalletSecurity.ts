import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

export interface WalletActivity {
  id: number;
  action: string;
  description: string | null;
  actor_name: string;
  created_at: string;
  meta?: Record<string, unknown> | null;
}

export interface SessionEntry {
  session_id: number;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  last_activity: string;
  is_current: boolean;
}

export type ProtectionLevel = "locked" | "strong" | "standard";

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const res = await axiosBaseApi.get(url, { params });
  return res.data?.data as T;
};

/** Everything the /wallet/security page shows, from existing read endpoints (plan 3.4). */
export const useWalletSecurity = () => {
  const { selectedCompanyId } = useCompanyStore();
  const twoFa = useSWR(API_ENDPOINTS.user.twoFaStatus, () => get<{ enabled: boolean; enabled_at: string | null }>(API_ENDPOINTS.user.twoFaStatus));
  const freeze = useSWR(API_ENDPOINTS.wallet.securityStatus, () => get<{ frozen: boolean; since: string | null; reason: string | null }>(API_ENDPOINTS.wallet.securityStatus));
  const sudo = useSWR(API_ENDPOINTS.stepUp.status("wallet"), () => get<{ active: boolean; expires_at: number | null }>(API_ENDPOINTS.stepUp.status("wallet")));
  const sessions = useSWR("user/sessions", async () => (await get<{ sessions: SessionEntry[] }>("user/sessions"))?.sessions || []);
  const activity = useSWR<WalletActivity[] | "forbidden">(
    selectedCompanyId ? ["team/activity", selectedCompanyId] : null,
    async () => {
      try {
        const rows = await get<WalletActivity[]>("team/activity", { company_id: selectedCompanyId, limit: 200 });
        return (rows || []).filter((r) => String(r.action || "").startsWith("wallet."));
      } catch (e: any) {
        if (e?.response?.status === 403) return "forbidden";
        throw e;
      }
    },
  );

  const frozen = !!freeze.data?.frozen;
  const twoFaOn = !!twoFa.data?.enabled;
  const level: ProtectionLevel = frozen ? "locked" : twoFaOn ? "strong" : "standard";
  const loading = (twoFa.isLoading && !twoFa.data) || (freeze.isLoading && !freeze.data);

  return { twoFa, freeze, sudo, sessions, activity, frozen, twoFaOn, level, loading };
};

export default useWalletSecurity;
