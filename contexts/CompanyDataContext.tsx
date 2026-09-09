import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  mapBackendErrorToField,
  companyKeywordMap,
} from "@/Redux/Sagas/helpers/mapBackendErrorToField";
import { API_ENDPOINTS } from "@/api/endpoints";

// Stable empty array so consumers' memo/effect deps don't churn while data is undefined.
const EMPTY_LIST: any[] = [];

/**
 * CompanyDataContext — SWR-backed replacement for the old Redux `companyReducer`
 * + `CompanySaga`. Owns the company list (server cache via SWR), the currently
 * selected company (with localStorage persistence + backend sync), and the
 * company mutations (add/update/delete/validateTax).
 *
 * The exposed `useCompanyStore()` intentionally mirrors the OLD reducer shape
 * ({ companyList, loading, fetched, fetchError, taxValidation, selectedCompanyId,
 * createError, createErrorField, createErrorNonce }) so existing consumers keep
 * working with a one-line swap from `useSelector(s => s.companyReducer)`.
 */

const LS_KEY = "last_company_id";
export const COMPANIES_KEY = "company/getCompany";

function getLastCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(LS_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

function saveLastCompanyId(companyId: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (companyId != null) localStorage.setItem(LS_KEY, String(companyId));
  } catch {}
}

export const companyFetcher = async (url: string) => {
  const res = await axios.get(url);
  return res?.data?.data ?? [];
};

export interface CompanyStore {
  companyList: any[];
  loading: boolean;
  fetched: boolean;
  fetchError: boolean;
  taxValidation: any;
  selectedCompanyId: number | null;
  selectedCompany: any | null;
  isMember: boolean;
  memberRole: string;
  can: (key: string) => boolean;
  createError: string | null;
  createErrorField: string | null;
  createErrorNonce: number;
  // methods
  selectCompany: (id: number) => void;
  refetchCompanies: () => Promise<any>;
  addCompany: (formData: any) => Promise<any>;
  updateCompany: (args: { id: number | string; formData: any }) => Promise<any>;
  deleteCompany: (id: number | string, otp: string) => Promise<any>;
  validateTax: (args: {
    companyId: number | string;
    taxId: string;
    country: string;
  }) => Promise<any>;
  clearCreateError: () => void;
}

const CompanyContext = createContext<CompanyStore | null>(null);

export function CompanyDataProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const router = useRouter();

  // Only fetch once a merchant token exists. The token can appear AFTER this
  // provider mounts (login via client-side navigation, which does NOT fire a
  // same-tab `storage` event), so we re-check on route changes + window focus
  // in addition to the cross-tab storage listener.
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setHasToken(!!localStorage.getItem("token"));
      } catch {
        setHasToken(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    router.events.on("routeChangeComplete", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
      router.events.off("routeChangeComplete", check);
    };
  }, [router.events]);

  // Buyer-facing public routes (payment checkout / creator / store / order)
  // never use merchant company data. Skipping the fetch here keeps these
  // pages clean and error-free for anonymous OR stale-/expired-token visitors
  // (no pointless 401 on /company/getCompany). router.pathname is the route
  // PATTERN (e.g. "/[handle]/checkout"), so this safely excludes the in-app
  // "/pay-links" surface.
  const isBuyerRoute = (() => {
    const p = router.pathname;
    return (
      p === "/pay" ||
      p.startsWith("/pay/") ||
      p.startsWith("/payment") ||
      p === "/[handle]" ||
      p.startsWith("/[handle]/") ||
      p.startsWith("/order/")
    );
  })();

  // Auth surfaces (login / register / reset / admin-login) never need merchant
  // company data. A stale/expired token in localStorage here would otherwise
  // fire /company/getCompany -> 401 -> redirect to /auth/login = a reload loop
  // (esp. Firefox mobile). Skip the fetch entirely on these routes.
  const isAuthRoute = (() => {
    const p = router.pathname;
    return (
      p.startsWith("/auth") ||
      p === "/reset-password" ||
      p === "/admin/login"
    );
  })();

  const { data, error, isLoading, mutate } = useSWR(
    hasToken && !isBuyerRoute && !isAuthRoute ? COMPANIES_KEY : null,
    companyFetcher
  );

  const companyList: any[] = useMemo(() => (Array.isArray(data) ? data : EMPTY_LIST), [data]);
  const fetched = data !== undefined || !!error;
  const fetchError = !!error;

  // F1: seed the selected company SYNCHRONOUSLY from localStorage at mount, so
  // it's known BEFORE /company/getCompany resolves. This lets useDashboardData
  // fire the dashboard/chart/wallet requests in the FIRST wave (in parallel
  // with the company-list fetch) instead of waiting for it — collapsing the
  // old 3-wave waterfall. If the seeded id turns out to be stale, the reconcile
  // effect below corrects it once the real list arrives (which re-fires the
  // dashboard fetch with the valid id).
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    () => getLastCompanyId()
  );
  const [taxValidation, setTaxValidation] = useState<any>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createErrorField, setCreateErrorField] = useState<string | null>(null);
  const [createErrorNonce, setCreateErrorNonce] = useState(0);

  // Resolve the selected company when the list changes:
  // 1. keep the current selection if still valid
  // 2. else last_company_id from localStorage (if valid)
  // 3. else the first company
  useEffect(() => {
    if (!companyList.length) return;
    const validIds = companyList.map((c: any) => c.company_id);
    setSelectedCompanyId((prev) => {
      if (prev && validIds.includes(prev)) return prev;
      const last = getLastCompanyId();
      const next =
        last && validIds.includes(last) ? last : validIds[0] ?? null;
      if (next) saveLastCompanyId(next);
      return next;
    });
  }, [companyList]);

  const selectCompany = useCallback((id: number) => {
    saveLastCompanyId(id);
    setSelectedCompanyId(id);
    // Persist to backend (fire-and-forget)
    try {
      axios
        .put(API_ENDPOINTS.user.lastCompany, { company_id: id })
        .catch(() => {});
    } catch {}
  }, []);

  const refetchCompanies = useCallback(() => mutate(), [mutate]);

  const clearCreateError = useCallback(() => {
    setCreateError(null);
    setCreateErrorField(null);
  }, []);

  const addCompany = useCallback(
    async (formData: any) => {
      try {
        const {
          data: { data: d, message },
        } = await axios.post("company/addCompany", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        dispatch({ type: TOAST_SHOW, payload: { message } });
        await mutate();
        return d;
      } catch (e: any) {
        const message =
          e?.response?.data?.message ?? e?.message ?? "An error occurred";
        const mapped = mapBackendErrorToField(message, companyKeywordMap);
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        setCreateError(mapped.friendly);
        setCreateErrorField(mapped.field);
        setCreateErrorNonce((n) => n + 1);
        throw e;
      }
    },
    [dispatch, mutate]
  );

  const updateCompany = useCallback(
    async ({ id, formData }: { id: number | string; formData: any }) => {
      try {
        const {
          data: { data: d, message },
        } = await axios.put("company/updateCompany/" + id, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        dispatch({ type: TOAST_SHOW, payload: { message } });
        await mutate();
        return d;
      } catch (e: any) {
        const message =
          e?.response?.data?.message ?? e?.message ?? "An error occurred";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        throw e;
      }
    },
    [dispatch, mutate]
  );

  const deleteCompany = useCallback(
    async (id: number | string, otp: string) => {
      try {
        const {
          data: { data: d, message },
        } = await axios.delete("company/deleteCompany/" + id, { data: { otp } });
        const revokedApiIds =
          (d && (d as { revokedApiIds?: number[] }).revokedApiIds) || [];
        const successMessage =
          revokedApiIds.length > 0
            ? `${message} (${revokedApiIds.length} API key${
                revokedApiIds.length > 1 ? "s" : ""
              } revoked)`
            : message;
        dispatch({
          type: TOAST_SHOW,
          payload: { message: successMessage, severity: "success" },
        });
        await mutate();
        return d;
      } catch (e: any) {
        // Recover from any stale optimistic removal; the caller surfaces the error inline.
        await mutate();
        throw e;
      }
    },
    [dispatch, mutate]
  );

  const validateTax = useCallback(
    async ({
      companyId,
      taxId,
      country,
    }: {
      companyId: number | string;
      taxId: string;
      country: string;
    }) => {
      try {
        const response = await axios.post("company/validateTaxId", {
          companyId,
          taxId,
          country,
        });
        const rd = response?.data;
        if (rd?.success === false) {
          throw new Error(rd.message || "Tax validation failed");
        }
        dispatch({
          type: TOAST_SHOW,
          payload: { message: rd?.message || "Tax ID validated successfully" },
        });
        const result = rd?.data || { valid: true, taxId, country };
        setTaxValidation(result);
        return result;
      } catch (e: any) {
        const message =
          e?.response?.data?.message ?? e?.message ?? "Tax validation failed";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        throw e;
      }
    },
    [dispatch]
  );

  // RBAC Phase 4b: derive the selected company's membership so consumers can
  // gate controls. Owner (is_member falsy) -> can() is always true; an active
  // team member -> can() reflects their granted per-permission map.
  const selectedCompany = useMemo(
    () => companyList.find((c: any) => c.company_id === selectedCompanyId) ?? null,
    [companyList, selectedCompanyId]
  );
  const isMember = !!selectedCompany?.is_member;
  const memberRole: string =
    selectedCompany?.member_role ?? (isMember ? "member" : "owner");
  const memberPermissions =
    (selectedCompany?.member_permissions ?? null) as Record<string, boolean> | null;
  const can = useCallback(
    (key: string) => (!isMember ? true : !!memberPermissions?.[key]),
    [isMember, memberPermissions]
  );

  const value = useMemo<CompanyStore>(
    () => ({
      companyList,
      loading: isLoading,
      fetched,
      fetchError,
      taxValidation,
      selectedCompanyId,
      selectedCompany,
      isMember,
      memberRole,
      can,
      createError,
      createErrorField,
      createErrorNonce,
      selectCompany,
      refetchCompanies,
      addCompany,
      updateCompany,
      deleteCompany,
      validateTax,
      clearCreateError,
    }),
    [
      companyList,
      isLoading,
      fetched,
      fetchError,
      taxValidation,
      selectedCompanyId,
      selectedCompany,
      isMember,
      memberRole,
      can,
      createError,
      createErrorField,
      createErrorNonce,
      selectCompany,
      refetchCompanies,
      addCompany,
      updateCompany,
      deleteCompany,
      validateTax,
      clearCreateError,
    ]
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompanyStore(): CompanyStore {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompanyStore must be used within CompanyDataProvider");
  }
  return ctx;
}

export function useSelectedCompanyId(): number | null {
  return useCompanyStore().selectedCompanyId;
}
