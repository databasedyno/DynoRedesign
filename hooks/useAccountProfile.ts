import { useMemo } from "react";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

export type AccountType = "individual" | "business";

export interface AccountProfileState {
  account: any | null;
  accountType: AccountType;
  isIndividual: boolean;
  hasAccount: boolean;
  /** True once the details invoices + tax reporting actually need are present. */
  profileComplete: boolean;
  missing: string[];
  fetched: boolean;
}

/**
 * Since 2026-08-12 every user is auto-provisioned an Account at signup
 * (backend/services/accountProvisioning.ts), so "does a company row exist?" is
 * always true and can no longer be used as an onboarding signal — it silently
 * ticked "Set up your business profile" for users who had entered nothing.
 *
 * This hook derives the two things the UI actually needs: WHICH kind of account
 * it is (individual creator vs business) and whether the merchant has filled in
 * the details invoices/tax depend on. No new endpoint or column —
 * GET /api/company/getCompany already returns the whole row incl. account_type.
 */
const useAccountProfile = (): AccountProfileState => {
  const { companyList, selectedCompanyId, fetched } = useCompanyStore();

  return useMemo(() => {
    const list = Array.isArray(companyList) ? companyList : [];
    const account =
      list.find((c: any) => c.company_id === selectedCompanyId) ?? list[0] ?? null;

    const accountType: AccountType =
      String(account?.account_type ?? "business").toLowerCase() === "individual"
        ? "individual"
        : "business";

    const missing: string[] = [];
    if (!String(account?.company_name ?? "").trim()) missing.push("company_name");
    if (!String(account?.country ?? "").trim()) missing.push("country");

    return {
      account,
      accountType,
      isIndividual: accountType === "individual",
      hasAccount: !!account,
      profileComplete: !!account && missing.length === 0,
      missing,
      fetched: !!fetched,
    };
  }, [companyList, selectedCompanyId, fetched]);
};

export default useAccountProfile;
export { useAccountProfile };
