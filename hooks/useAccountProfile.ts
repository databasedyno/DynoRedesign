import { useMemo } from "react";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useNavReveal, { NavRevealFlags } from "@/hooks/useNavReveal";

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
  /**
   * Reveal-on-relevance flags for the nav (audit F13/N1). Derived HERE, in one
   * place, so the desktop sidebar and the mobile nav can never disagree about
   * which rows exist. Session-sticky — see hooks/useNavReveal.ts.
   */
  reveal: NavRevealFlags;
  /** True once the reveal flags have been resolved (from cache or the API). */
  revealReady: boolean;
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
  const { receipts, customers, developers, ready: revealReady } = useNavReveal();

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
      reveal: { receipts, customers, developers },
      revealReady,
    };
    // Deps are primitives only (law 7): consumers of this hook write layout
    // state, so the returned identity must change ONLY when a value really did.
  }, [companyList, selectedCompanyId, fetched, receipts, customers, developers, revealReady]);
};

export default useAccountProfile;
export { useAccountProfile };
