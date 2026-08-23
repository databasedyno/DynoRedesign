import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";

export interface StorefrontProfile {
  handle: string | null;
  name: string | null;
  bio: string | null;
  creator_page_enabled: boolean;
  cover_image: string | null;
  company_id: number | null;
  [k: string]: unknown;
}

/**
 * Storefront-per-company aware read of the ACTIVE company's storefront settings.
 * Resolves to the selected company when STOREFRONT_PER_COMPANY is ON, else the
 * account (backend decides). Keyed by the selected company so switching
 * companies reloads the right handle/page. `profile === undefined` means loading.
 */
export default function useStorefrontProfile() {
  const selectedCompanyId = useSelectedCompanyId();
  const { data, error, mutate } = useSWR(
    ["user/creator/profile", selectedCompanyId],
    async () => {
      const r = await axiosBaseApi.get("user/creator/profile");
      return (r?.data?.data ?? null) as StorefrontProfile | null;
    },
    { keepPreviousData: true },
  );
  return { profile: data, loading: data === undefined && !error, error, mutate };
}
