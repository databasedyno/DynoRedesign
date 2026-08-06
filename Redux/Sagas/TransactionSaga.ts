import { call, put } from "redux-saga/effects";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import {
  TRANSACTION_ERROR,
  TRANSACTION_FETCH,
  TRANSACTION_DETAIL_FETCH,
  TRANSACTION_EXPORT,
} from "../Actions/TransactionAction";

interface ITransactionAction {
  crudType: string;
  payload: any;
}

export function* TransactionSaga(action: ITransactionAction): unknown {
  switch (action.crudType) {
    case TRANSACTION_FETCH:
      yield getAllTransactions(action.payload);
      break;

    case TRANSACTION_DETAIL_FETCH:
      yield getTransactionDetail(action.payload);
      break;

    case TRANSACTION_EXPORT:
      yield exportTransactions(action.payload);
      break;

    default:
      yield put({ type: TRANSACTION_ERROR });
      break;
  }
}

export function* getAllTransactions(payload?: any): unknown {
  try {
    const body: Record<string, unknown> = {};
    if (payload?.company_id) body.company_id = payload.company_id;
    const response = yield call(axios.post, "wallet/getAllTransactions", body);
    const apiData = response?.data?.data;

    if (apiData) {
      yield put({
        type: TRANSACTION_FETCH,
        payload: {
          customers_transactions: apiData.customers_transactions || [],
          self_transactions: apiData.self_transactions || [],
          pagination: apiData.pagination || null,
          company_id: payload?.company_id ?? null,
        },
      });
    } else {
      yield put({ type: TRANSACTION_ERROR });
    }
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to fetch transactions";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: TRANSACTION_ERROR,
    });
  }
}

export function* getTransactionDetail(payload: any): unknown {
  try {
    const { id } = payload;
    const response = yield call(axios.get, `wallet/transaction/${id}`);
    const apiData = response?.data?.data;

    if (apiData) {
      yield put({
        type: TRANSACTION_DETAIL_FETCH,
        payload: apiData,
      });
    } else {
      throw new Error(response?.data?.message || "Failed to fetch transaction detail");
    }
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to fetch transaction detail";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: TRANSACTION_ERROR,
    });
  }
}

export function* exportTransactions(payload: any): unknown {
  try {
    const response = yield call(axios.post, "wallet/transactions/export", payload || {}, {
      responseType: "blob",
    });

    // Create download link from blob
    const blob = new Blob([response.data], {
      type: response.headers?.["content-type"] || "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `transactions_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    yield put({ type: TRANSACTION_EXPORT });
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: "Transactions exported successfully",
      },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to export transactions";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: TRANSACTION_ERROR,
    });
  }
}
