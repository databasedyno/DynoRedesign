import { call, put } from "redux-saga/effects";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import {
  API_ERROR,
  API_DELETE,
  API_FETCH,
  API_INSERT,
  API_UPDATE,
  API_REGENERATE,
  API_TOGGLE_STATUS,
} from "../Actions/ApiAction";

interface IApiAction {
  crudType: string;
  payload: any;
}

export function* ApiSaga(action: IApiAction): unknown {
  switch (action.crudType) {
    case API_INSERT:
      yield addApi(action.payload);
      break;

    case API_FETCH:
      yield getApi(action.payload);
      break;

    case API_DELETE:
      yield deleteApi(action.payload);
      break;

    case API_UPDATE:
      yield updateApi(action.payload);
      break;

    case API_REGENERATE:
      yield regenerateApi(action.payload);
      break;

    case API_TOGGLE_STATUS:
      yield toggleApiStatus(action.payload);
      break;

    default:
      yield put({ type: API_ERROR });
      break;
  }
}

export function* addApi(payload: any): unknown {
  try {
    const response = yield call(axios.post, "userApi/addApi", payload);
    if (response?.status !== 200) {
      yield put({
        type: TOAST_SHOW,
        payload: { message: response?.data?.message, severity: "error" },
      });
      return;
    }
    yield put({
      type: TOAST_SHOW,
      payload: { message: response?.data?.message },
    });
    yield put({
      type: API_INSERT,
      payload: response?.data?.data,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to create API key";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}

export function* getApi(payload?: any): unknown {
  try {
    const params: Record<string, string> = {};
    if (payload?.company_id) params.company_id = String(payload.company_id);
    const {
      data: { data, message },
    } = yield call(axios.get, "userApi/getApi", { params });

    yield put({
      type: API_FETCH,
      payload: data?.all || data || [],
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to fetch API keys";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}

export function* deleteApi(payload: any): unknown {
  try {
    const { id } = payload;
    const {
      data: { data, message },
    } = yield call(axios.delete, "userApi/deleteApi/" + id);

    yield put({
      type: TOAST_SHOW,
      payload: { message },
    });
    yield put({
      type: API_DELETE,
      payload: id,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to delete API key";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}

export function* updateApi(payload: any): unknown {
  try {
    const { id, ...updateData } = payload;
    const response = yield call(axios.put, `userApi/updateApi/${id}`, updateData);
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to update API key");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "API key updated successfully" },
    });
    yield put({
      type: API_UPDATE,
      payload: responseData?.data || responseData,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to update API key";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}

export function* regenerateApi(payload: any): unknown {
  try {
    const { id, company_id } = payload;
    const response = yield call(axios.post, `userApi/regenerateKey/${id}`);
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to regenerate API key");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "API key regenerated successfully" },
    });
    yield put({
      type: API_REGENERATE,
      payload: responseData?.data || responseData,
    });
    // Re-fetch all keys to stay in sync (keep the current brand filter)
    yield getApi(company_id ? { company_id } : undefined);
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to regenerate API key";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}

export function* toggleApiStatus(payload: any): unknown {
  try {
    const { id, status } = payload;
    const response = yield call(axios.put, `userApi/toggleStatus/${id}`, { status });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to toggle API status");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "API status updated successfully" },
    });
    yield put({
      type: API_TOGGLE_STATUS,
      payload: { id, status: responseData?.data?.status || status },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to toggle API status";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: API_ERROR });
  }
}
