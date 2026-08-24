import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import useApiSWR from "@/hooks/useApiSWR";

export interface StorefrontProfile {
  handle: string | null;
  name: string | null;
  bio: string | null;
  creator_page_enabled: boolean;
  cover_image: string | null;
  company_id: number | null;
  /** Legacy (flag OFF) + non-primary company: no own storefront yet. */
  storefront_pending?: boolean;
  account_handle?: string | null;
  primary_company_id?: number | null;
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
  const { data, error, mutate } = useApiSWR<StorefrontProfile | null>(
    ["user/creator/profile", selectedCompanyId],
    {
      keepPreviousData: true,
      select: (raw) => (raw?.data?.data ?? null) as StorefrontProfile | null,
    },
  );
  return { profile: data, loading: data === undefined && !error, error, mutate };
}
