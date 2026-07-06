import { call, put } from "redux-saga/effects";
import axiosBaseApi from "@/axiosConfig";
import {
  PAYLINK_FETCH,
  PAYLINK_CREATE,
  PAYLINK_UPDATE,
  PAYLINK_DELETE,
  PAYLINK_ERROR,
  PAYLINK_FEE_PREVIEW,
  PAYLINK_CREATE_ERROR,
} from "../Actions/PaymentLinkAction";
import { TOAST_SHOW } from "../Actions/ToastAction";

interface PaymentLinkSagaAction {
  type: string;
  payload?: any;
  crudType?: string;
}

/**
 * Best-effort mapping from a backend `errorResponseHelper` message to a
 * frontend form-field id. Keeps the mapping DUMB and message-driven so
 * we don't have to keep an enum in sync with the backend — new backend
 * validation messages just fall through to `"generic"` and the toast
 * still fires.
 * Sources of truth: backend/controller/payment/paymentLinkController.ts
 * (createPaymentLink) — every explicit 400/403 return.
 */
const mapCreatePaymentLinkErrorToField = (
  rawMessage: string,
): {
  field:
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
  friendly: string;
} => {
  const m = (rawMessage || "").toLowerCase();
  // Amount — most common
  if (m.includes("amount is required") || m.includes("amount must be") || m.startsWith("amount ")) {
    return { field: "value", friendly: rawMessage };
  }
  // Expire enum
  if (m.includes("expire")) {
    return { field: "expire", friendly: rawMessage };
  }
  // Email
  if (m.includes("email format") || m.includes("valid email")) {
    return { field: "customer_email", friendly: rawMessage };
  }
  // URL fields — heuristic ordering: prefer specific field name if mentioned
  if (m.includes("webhook_url") || m.includes("webhook url")) {
    return { field: "webhook_url", friendly: rawMessage };
  }
  if (m.includes("redirect_url") || m.includes("redirect url")) {
    return { field: "redirect_url", friendly: rawMessage };
  }
  if (m.includes("callback_url") || m.includes("callback url")) {
    return { field: "callback_url", friendly: rawMessage };
  }
  // Modes / accepted currencies
  if (m.includes("payment mode") || m.includes("cryptocurrency") || m.includes("accepted_currencies")) {
    return { field: "accepted_currencies", friendly: rawMessage };
  }
  // Company id
  if (m.includes("company_id") || m.includes("company does not belong") || m.includes("invalid company")) {
    return { field: "company_id", friendly: rawMessage };
  }
  // KYC — backend messages contain "[KYC_REQUIRED]" tag or "kyc verification"
  if (m.includes("kyc_required") || m.includes("kyc verification")) {
    return { field: "kyc", friendly: rawMessage };
  }
  return { field: "generic", friendly: rawMessage };
};

export function* PaymentLinkSaga(action: PaymentLinkSagaAction): Generator<any, void, any> {
  const { crudType, payload } = action;

  try {
    switch (crudType) {
      case PAYLINK_FETCH: {
        const fetchParams: Record<string, unknown> = {};
        if (payload?.company_id) fetchParams.company_id = payload.company_id;
        const response = yield call(axiosBaseApi.get, "/pay/getPaymentLinks", { params: fetchParams });
        const apiData = response?.data?.data;
        if (apiData !== undefined) {
          yield put({
            type: PAYLINK_FETCH,
            payload: {
              paymentLinks: Array.isArray(apiData) ? apiData : apiData?.paymentLinks || [],
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
        }
        break;
      }

      case PAYLINK_CREATE: {
        const response = yield call(axiosBaseApi.post, "/pay/createPaymentLink", payload);
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_CREATE,
            payload: {
              paymentLink: apiData,
            },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link created successfully",
              severity: "success",
            },
          });
        } else {
          const rawMsg = response?.data?.message || "Failed to create payment link";
          const mapped = mapCreatePaymentLinkErrorToField(rawMsg);
          yield put({
            type: PAYLINK_CREATE_ERROR,
            payload: { message: mapped.friendly, field: mapped.field },
          });
          yield put({
            type: TOAST_SHOW,
            payload: { message: rawMsg, severity: "error" },
          });
        }
        break;
      }

      case PAYLINK_UPDATE: {
        const { id, ...updateData } = payload;
        const response = yield call(axiosBaseApi.put, `/pay/links/${id}`, updateData);
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_UPDATE,
            payload: {
              paymentLink: apiData,
            },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link updated successfully",
              severity: "success",
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to update payment link",
              severity: "error",
            },
          });
        }
        break;
      }

      case PAYLINK_DELETE: {
        const { id } = payload;
        const response = yield call(axiosBaseApi.delete, `/pay/deletePaymentLink/${id}`);
        if (response?.data) {
          yield put({
            type: PAYLINK_DELETE,
            payload: { id },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link deleted successfully",
              severity: "success",
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to delete payment link",
              severity: "error",
            },
          });
        }
        break;
      }

      case PAYLINK_FEE_PREVIEW: {
        const { amount, currency } = action.payload;
        const response = yield call(axiosBaseApi.get, `/pay/fee-preview?amount=${amount}&currency=${currency || 'USD'}`);
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_FEE_PREVIEW,
            payload: {
              feePreview: apiData,
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to fetch fee preview",
              severity: "error",
            },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (error: any) {
    console.error("PaymentLinkSaga error:", error);
    const message = error?.response?.data?.message ?? error?.message ?? "Payment link operation failed";
    // For CREATE failures, dispatch field-hinted error so the UI can show it
    // inline on the offending field (in addition to the toast).
    if (crudType === PAYLINK_CREATE) {
      const mapped = mapCreatePaymentLinkErrorToField(message);
      yield put({
        type: PAYLINK_CREATE_ERROR,
        payload: { message: mapped.friendly, field: mapped.field },
      });
    } else {
      yield put({ type: PAYLINK_ERROR });
    }
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
  }
}
