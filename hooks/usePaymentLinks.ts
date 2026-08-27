import { useCallback, useState } from "react";
import useSWR from "swr";
import { useDispatch } from "react-redux";

import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import {
  mapBackendErrorToField,
  paymentLinkKeywordMap,
} from "@/Redux/Sagas/helpers/mapBackendErrorToField";

/**
 * usePaymentLinks — SWR-backed replacement for the old Redux `paymentLinkReducer`
 * + `PaymentLinkSaga` (data-layer consolidation, REFACTOR Part D / Phase 2, Wave 4).
 *
 * The list is keyed on the selected company (`[PAYMENT_LINKS_KEY, id]`), so a
 * company switch changes the key → auto-refetch (no CompanySelector dispatch).
 * The mutation methods mirror the saga+reducer EXACTLY (optimistic cache update
 * via `mutate(..., { revalidate:false })`, same toast, same field-hinted error)
 * so the CreatePaymentLink page's effect-driven flow (new-link detection,
 * createLoading transition, createErrorNonce inline errors) keeps working with
 * the SAME state field names — `paymentLinks / loading / createLoading /
 * feePreview / createError / createErrorField / createErrorNonce`.
 */

export const PAYMENT_LINKS_KEY = "/pay/getPaymentLinks";

// The value MUST match a CreatePaymentLink form field id so the page can surface
// the backend error inline next to that field (moved off the deleted reducer).
export type PaymentLinkErrorField =
  | "value"
  | "currency"
  | "description"
  | "expire"
  | "customer_email"
  | "webhook_url"
  | "redirect_url"
  | "callback_url"
  | "accepted_currencies"
  | "company_id"
  | "kyc"
  | "generic";

export interface PaymentLinkMutationResult {
  ok: boolean;
  data?: any;
  error?: string;
  field?: PaymentLinkErrorField;
}

// Stable empty array so consumers' effect deps don't churn before first load.
const EMPTY_LINKS: any[] = [];

export const paymentLinksFetcher = async (
  key: string | readonly [string, number | null],
): Promise<any[]> => {
  const companyId = Array.isArray(key) ? (key[1] as number | null) : undefined;
  const params: Record<string, unknown> = {};
  if (companyId) params.company_id = companyId;
  const response = await axiosBaseApi.get(PAYMENT_LINKS_KEY, { params });
  const apiData = response?.data?.data;
  return Array.isArray(apiData) ? apiData : apiData?.paymentLinks || [];
};

export function usePaymentLinks() {
  const dispatch = useDispatch();
  const selectedCompanyId = useSelectedCompanyId();

  const swrKey: [string, number] | null = selectedCompanyId
    ? [PAYMENT_LINKS_KEY, selectedCompanyId]
    : null;

  const { data, isLoading, mutate } = useSWR(swrKey, paymentLinksFetcher);
  const paymentLinks = data ?? EMPTY_LINKS;

  // Inline create/edit error surfacing (mirrors the old reducer fields). These
  // are per-instance — only the CreatePaymentLink page reads them, and it is the
  // same instance that triggers create/update, so no shared store is needed.
  const [createLoading, setCreateLoading] = useState(false);
  const [feePreview, setFeePreview] = useState<any | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createErrorField, setCreateErrorField] =
    useState<PaymentLinkErrorField | null>(null);
  const [createErrorNonce, setCreateErrorNonce] = useState(0);

  const raiseCreateError = useCallback((rawMsg: string): PaymentLinkErrorField => {
    const mapped = mapBackendErrorToField(rawMsg, paymentLinkKeywordMap);
    const field = (mapped.field as PaymentLinkErrorField) ?? "generic";
    setCreateError(mapped.friendly);
    setCreateErrorField(field);
    setCreateErrorNonce((n) => n + 1);
    return field;
  }, []);

  const clearCreateError = useCallback(() => {
    setCreateError(null);
    setCreateErrorField(null);
  }, []);

  const refetch = useCallback(() => mutate(), [mutate]);

  const showToast = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      dispatch({ type: TOAST_SHOW, payload: { message, severity } });
    },
    [dispatch],
  );

  const createPaymentLink = useCallback(
    async (payload: any): Promise<PaymentLinkMutationResult> => {
      setCreateLoading(true);
      setCreateError(null);
      setCreateErrorField(null);
      const isDonationLink = payload?.link_type === "donation";
      try {
        const response = await axiosBaseApi.post("/pay/createPaymentLink", payload);
        const apiData = response?.data?.data;
        if (apiData) {
          // Mirror reducer: prepend the create RESPONSE (carries direct_pay_address
          // / qr / payment_link) to the list so the page's new-link detection sees
          // it at index 0.
          await mutate((cur: any[] = []) => [apiData, ...cur], {
            revalidate: false,
          });
          showToast(
            isDonationLink
              ? "Donation created successfully"
              : response?.data?.message || "Payment link created successfully",
          );
          setCreateLoading(false);
          return { ok: true, data: apiData };
        }
        const rawMsg = response?.data?.message || "Failed to create payment link";
        const field = raiseCreateError(rawMsg);
        showToast(rawMsg, "error");
        setCreateLoading(false);
        return { ok: false, error: rawMsg, field };
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Payment link operation failed";
        const field = raiseCreateError(message);
        showToast(message, "error");
        setCreateLoading(false);
        return { ok: false, error: message, field };
      }
    },
    [mutate, showToast, raiseCreateError],
  );

  const updatePaymentLink = useCallback(
    async (
      payload: { id: string | number; onSuccess?: () => void } & Record<string, any>,
    ): Promise<PaymentLinkMutationResult> => {
      const { id, onSuccess, ...updateData } = payload;
      setCreateError(null);
      setCreateErrorField(null);
      try {
        const response = await axiosBaseApi.put(`/pay/links/${id}`, updateData);
        const apiData = response?.data?.data;
        if (apiData) {
          await mutate(
            (cur: any[] = []) =>
              cur.map((link) => (link._id === apiData._id ? apiData : link)),
            { revalidate: false },
          );
          showToast(response?.data?.message || "Payment link updated successfully");
          if (typeof onSuccess === "function") onSuccess();
          return { ok: true, data: apiData };
        }
        const rawMsg = response?.data?.message || "Failed to update payment link";
        const field = raiseCreateError(rawMsg);
        showToast(rawMsg, "error");
        return { ok: false, error: rawMsg, field };
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Payment link operation failed";
        const field = raiseCreateError(message);
        showToast(message, "error");
        return { ok: false, error: message, field };
      }
    },
    [mutate, showToast, raiseCreateError],
  );

  const deletePaymentLink = useCallback(
    async (id: string | number) => {
      try {
        const response = await axiosBaseApi.delete(`/pay/deletePaymentLink/${id}`);
        if (response?.data) {
          await mutate(
            (cur: any[] = []) =>
              cur.filter((link) => {
                const linkId = String(link._id || link.link_id || link.id);
                return linkId !== String(id);
              }),
            { revalidate: false },
          );
          showToast(response?.data?.message || "Payment link deleted successfully");
        } else {
          showToast(response?.data?.message || "Failed to delete payment link", "error");
        }
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Payment link operation failed";
        showToast(message, "error");
      }
    },
    [mutate, showToast],
  );

  const fetchFeePreview = useCallback(
    async ({
      amount,
      currency,
      feePayer,
    }: {
      amount: number | string;
      currency?: string;
      feePayer?: string;
    }) => {
      try {
        const feePayerParam = feePayer ? `&fee_payer=${feePayer}` : "";
        const response = await axiosBaseApi.get(
          `/pay/fee-preview?amount=${amount}&currency=${currency || "USD"}${feePayerParam}`,
        );
        const apiData = response?.data?.data;
        if (apiData) {
          setFeePreview(apiData);
        } else {
          showToast(response?.data?.message || "Failed to fetch fee preview", "error");
        }
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Failed to fetch fee preview";
        showToast(message, "error");
      }
    },
    [showToast],
  );

  return {
    paymentLinks,
    loading: isLoading && data === undefined,
    // "list has been loaded at least once" — mirrors the old reducer `fetched`,
    // used to gate onboarding nudges until we actually know the link count.
    fetched: data !== undefined,
    createLoading,
    feePreview,
    createError,
    createErrorField,
    createErrorNonce,
    refetch,
    clearCreateError,
    createPaymentLink,
    updatePaymentLink,
    deletePaymentLink,
    fetchFeePreview,
  };
}

export default usePaymentLinks;
