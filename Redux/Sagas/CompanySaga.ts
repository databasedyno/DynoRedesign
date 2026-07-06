import { call, put } from "redux-saga/effects";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import {
  COMPANY_API_ERROR,
  COMPANY_DELETE,
  COMPANY_FETCH,
  COMPANY_INSERT,
  COMPANY_UPDATE,
  COMPANY_VALIDATE_TAX,
  COMPANY_CREATE_ERROR,
} from "../Actions/CompanyAction";
import {
  mapBackendErrorToField,
  companyKeywordMap,
} from "./helpers/mapBackendErrorToField";

interface ICompanyAction {
  crudType: string;
  payload: any;
}

export function* CompanySaga(action: ICompanyAction): unknown {
  switch (action.crudType) {
    case COMPANY_INSERT:
      yield addCompany(action.payload);
      break;

    case COMPANY_FETCH:
      yield getCompany();
      break;

    case COMPANY_DELETE:
      yield deleteCompany(action.payload);
      break;

    case COMPANY_UPDATE:
      yield updateCompany(action.payload);
      break;

    case COMPANY_VALIDATE_TAX:
      yield validateTax(action.payload);
      break;

    default:
      yield put({ type: COMPANY_API_ERROR });
      break;
  }
}

export function* addCompany(payload: any): unknown {
  try {
    const {
      data: { data, message },
    } = yield call(axios.post, "company/addCompany", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    yield put({
      type: TOAST_SHOW,
      payload: { message },
    });
    yield put({
      type: COMPANY_INSERT,
      payload: data,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "An error occurred";
    const mapped = mapBackendErrorToField(message, companyKeywordMap);
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: COMPANY_CREATE_ERROR,
      payload: { message: mapped.friendly, field: mapped.field },
    });
    yield put({
      type: COMPANY_API_ERROR,
    });
  }
}

export function* updateCompany(payload: any): unknown {
  try {
    const { id, formData } = payload;
    const {
      data: { data, message },
    } = yield call(axios.put, "company/updateCompany/" + id, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    yield put({
      type: TOAST_SHOW,
      payload: { message },
    });
    yield put({
      type: COMPANY_UPDATE,
      payload: { id, data },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "An error occurred";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: COMPANY_API_ERROR,
    });
  }
}

export function* getCompany(): unknown {
  try {
    const {
      data: { data, message },
    } = yield call(axios.get, "company/getCompany");

    yield put({
      type: COMPANY_FETCH,
      payload: data,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "An error occurred";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: COMPANY_API_ERROR,
    });
  }
}

export function* deleteCompany(payload: any): unknown {
  try {
    const { id } = payload;
    const {
      data: { data, message },
    } = yield call(axios.delete, "company/deleteCompany/" + id);

    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: COMPANY_DELETE,
      payload: id,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "An error occurred";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: COMPANY_API_ERROR,
    });
  }
}

export function* validateTax(payload: any): unknown {
  try {
    const { companyId, taxId, country } = payload;
    const response = yield call(axios.post, "company/validateTaxId", {
      companyId,
      taxId,
      country,
    });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Tax validation failed");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "Tax ID validated successfully" },
    });
    yield put({
      type: COMPANY_VALIDATE_TAX,
      payload: responseData?.data || { valid: true, taxId, country },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Tax validation failed";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: COMPANY_API_ERROR });
  }
}
