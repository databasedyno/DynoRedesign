import { ReducerAction } from "@/utils/types";
import {
  PAYLINK_FETCH,
  PAYLINK_CREATE,
  PAYLINK_UPDATE,
  PAYLINK_DELETE,
  PAYLINK_ERROR,
  PAYLINK_INIT,
  PAYLINK_FEE_PREVIEW,
  PAYLINK_CREATE_ERROR,
  PAYLINK_CREATE_ERROR_CLEAR,
} from "../Actions/PaymentLinkAction";

/**
 * Optional field hint attached to a PAYLINK_CREATE_ERROR. The value MUST match one
 * of the client-side form field ids so the CreatePaymentLink page can surface the
 * error inline next to that exact field.
 */
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

export interface PaymentLinkState {
  paymentLinks: any[];
  selectedLink: any | null;
  loading: boolean;
  createLoading: boolean;
  feePreview: any | null;
  fetched: boolean;
  /**
   * Populated on a failed create attempt so the CreatePaymentLink page can
   * surface an inline error next to the offending field. Cleared on the next
   * create attempt / on PAYLINK_CREATE_ERROR_CLEAR / on successful PAYLINK_CREATE.
   */
  createError: string | null;
  createErrorField: PaymentLinkErrorField | null;
  /** Monotonically incremented on each new create error so effects can react even
   *  when the message/field are identical to a previous error. */
  createErrorNonce: number;
}

const paymentLinkInitialState: PaymentLinkState = {
  paymentLinks: [],
  selectedLink: null,
  loading: false,
  createLoading: false,
  feePreview: null,
  fetched: false,
  createError: null,
  createErrorField: null,
  createErrorNonce: 0,
};

const paymentLinkReducer = (
  state = paymentLinkInitialState,
  action: ReducerAction
) => {
  const { payload } = action;

  switch (action.type) {
    case PAYLINK_INIT:
      // Only set loading for FETCH/CREATE/UPDATE/DELETE — NOT for FEE_PREVIEW
      // Bug fix: FEE_PREVIEW was setting loading=true for new users (0 payment links)
      // and never resetting it, causing the Create button to silently do nothing.
      if ((action as any).crudType === PAYLINK_FEE_PREVIEW) {
        return state; // fee preview should not affect loading state
      }
      return {
        ...state,
        loading: state.paymentLinks.length === 0,
        // Clear any previous create error on a NEW create attempt so stale
        // "Amount is required" inline hints disappear the moment the user retries.
        ...((action as any).crudType === PAYLINK_CREATE && {
          createLoading: true,
          createError: null,
          createErrorField: null,
        }),
      };

    case PAYLINK_FETCH:
      return {
        ...state,
        loading: false,
        fetched: true,
        paymentLinks: payload.paymentLinks || [],
      };

    case PAYLINK_CREATE:
      return {
        ...state,
        loading: false,
        createLoading: false,
        createError: null,
        createErrorField: null,
        paymentLinks: [payload.paymentLink, ...state.paymentLinks],
      };

    case PAYLINK_CREATE_ERROR:
      return {
        ...state,
        loading: false,
        createLoading: false,
        fetched: true,
        createError: payload?.message ?? "Payment link creation failed",
        createErrorField: (payload?.field as PaymentLinkErrorField) ?? "generic",
        createErrorNonce: state.createErrorNonce + 1,
      };

    case PAYLINK_CREATE_ERROR_CLEAR:
      return {
        ...state,
        createError: null,
        createErrorField: null,
      };

    case PAYLINK_UPDATE:
      return {
        ...state,
        loading: false,
        paymentLinks: state.paymentLinks.map((link: any) =>
          link._id === payload.paymentLink._id ? payload.paymentLink : link
        ),
      };

    case PAYLINK_DELETE:
      return {
        ...state,
        loading: false,
        paymentLinks: state.paymentLinks.filter(
          (link: any) => {
            const linkId = String(link._id || link.link_id || link.id);
            return linkId !== String(payload.id);
          }
        ),
      };

    case PAYLINK_ERROR:
      return {
        ...state,
        loading: false,
        createLoading: false,
        fetched: true,
      };

    case PAYLINK_FEE_PREVIEW:
      return {
        ...state,
        loading: false,
        feePreview: payload.feePreview,
      };

    default:
      return state;
  }
};

export default paymentLinkReducer;
