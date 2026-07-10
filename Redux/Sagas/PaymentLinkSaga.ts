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
import {
  mapBackendErrorToField,
  paymentLinkKeywordMap,
} from "./helpers/mapBackendErrorToField";

interface PaymentLinkSagaAction {
  type: string;
  payload?: any;
  crudType?: string;
}

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
        const isDonationLink = payload?.link_type === "donation";
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
              message: isDonationLink
                ? "Donation created successfully"
                : response?.data?.message || "Payment link created successfully",
              severity: "success",
            },
          });
        } else {
          const rawMsg = response?.data?.message || "Failed to create payment link";
          const mapped = mapBackendErrorToField(rawMsg, paymentLinkKeywordMap);
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
        const { id, onSuccess, ...updateData } = payload;
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
          // Session 14d: let the edit page navigate back to /pay-links after a
          // successful save (previously the user stayed on the edit form).
          if (typeof onSuccess === "function") {
            onSuccess();
          }
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
      const mapped = mapBackendErrorToField(message, paymentLinkKeywordMap);
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
