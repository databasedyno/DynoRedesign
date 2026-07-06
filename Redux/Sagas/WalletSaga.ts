import { call, put } from "redux-saga/effects";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import { WALLET_API_ERROR, WALLET_FETCH, WALLET_ADD_ADDRESS, WALLET_UPDATE, WALLET_DELETE, VERIFY_OTP, WALLET_ADDRESS_ERROR } from "../Actions/WalletAction";
import {
  mapBackendErrorToField,
  walletKeywordMap,
} from "./helpers/mapBackendErrorToField";
interface IWalletAction {
  crudType: string;
  payload: any;
}

// ── Deduplication guard ──────────────────────────────────────────────
// Prevents redundant wallet API calls when multiple components dispatch
// WALLET_FETCH within seconds of each other (typical on dashboard mount).
let _lastWalletFetchTime = 0;
let _lastWalletFetchKey = "";           // tracks company_id to allow re-fetch on switch
const WALLET_FETCH_COOLDOWN_MS = 8_000; // skip re-fetch within 8s unless company changed

export function* WalletSaga(action: IWalletAction): unknown {
  switch (action.crudType) {
    case WALLET_FETCH:
      yield getWallet(action.payload);
      break;

    case WALLET_ADD_ADDRESS:
      yield validateWalletAddress(action.payload);
      break;

    case WALLET_UPDATE:
      yield updateWallet(action.payload);
      break;

    case WALLET_DELETE:
      yield deleteWallet(action.payload);
      break;

    default:
      yield put({ type: WALLET_API_ERROR });
      break;
  }
}

export function* getWallet(payload?: any): unknown {
  try {
    // ── Dedup: skip if same fetch happened recently ──
    const fetchKey = payload?.company_id ? String(payload.company_id) : "__all__";
    const now = Date.now();
    if (
      fetchKey === _lastWalletFetchKey &&
      now - _lastWalletFetchTime < WALLET_FETCH_COOLDOWN_MS &&
      !payload?.force
    ) {
      // Silently skip — data is still fresh from the previous call
      return;
    }
    _lastWalletFetchTime = now;
    _lastWalletFetchKey = fetchKey;

    const params: Record<string, unknown> = {};
    if (payload?.company_id) params.company_id = payload.company_id;
    const response = yield call(axios.get, "wallet/getWallet", { params });
    const apiData = response?.data?.data;

    // API returns company-grouped data: [{company_id, wallets: [...]}]
    // Flatten to a single wallet list for the reducer
    let flatWallets: any[] = [];
    if (Array.isArray(apiData)) {
      for (const companyGroup of apiData) {
        if (Array.isArray(companyGroup.wallets)) {
          flatWallets = flatWallets.concat(
            companyGroup.wallets.map((w: any) => ({
              ...w,
              company_name: companyGroup.company_name,
              id: w.wallet_id,
            }))
          );
        }
      }
    }

    yield put({
      type: WALLET_FETCH,
      payload: flatWallets,
    });
  } catch (e: any) {
    console.error("[WalletSaga] Error:", e?.message || e);
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to fetch wallets";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: WALLET_API_ERROR,
    });
  }
}

export function* validateWalletAddress(payload: any): unknown {
  try {
    console.log("Sending payload:", payload);
    const {
      data: { data, message },
    } = yield call(
      axios.post,
      "wallet/validateWalletAddress",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    yield put({
      type: TOAST_SHOW,
      payload: { message },
    });
    yield put({
      type: WALLET_ADD_ADDRESS,
      payload: data,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to validate wallet address";
    const mapped = mapBackendErrorToField(message, walletKeywordMap);
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: WALLET_ADDRESS_ERROR,
      payload: { message: mapped.friendly, field: mapped.field },
    });
    yield put({
      type: WALLET_API_ERROR,
    });
  }
}

export function* updateWallet(payload: any): unknown {
  try {
    const { id, otp, ...updateData } = payload;
    const response = yield call(axios.put, `wallet/address/${id}`, {
      ...updateData,
      otp,
    });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to update wallet");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "Wallet updated successfully" },
    });
    yield put({
      type: WALLET_UPDATE,
      payload: responseData?.data || responseData,
    });
    // Re-fetch wallets to ensure sync
    yield getWallet();
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to update wallet";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: WALLET_API_ERROR });
  }
}

export function* deleteWallet(payload: any): unknown {
  try {
    const { id, otp } = payload;
    const response = yield call(axios.post, `wallet/wallet/delete/verify`, {
      wallet_id: id,
      otp,
    });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to delete wallet");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "Wallet deleted successfully" },
    });
    yield put({
      type: WALLET_DELETE,
      payload: { id },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to delete wallet";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: WALLET_API_ERROR });
  }
}


export async function verifyOtp(payload: any): Promise<{ status: boolean; message: string }> {
  try {

    console.log("Verifying OTP with payload:", payload);

    const response = await axios.post(
      "/wallet/verifyOtp",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const httpStatus = response.status; 
    const { data, message, success } = response.data;

    // Dispatch VERIFY_OTP action
    return { status:httpStatus === 200,message };
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "OTP verification failed";

    return {status:false,message};
  }
}
