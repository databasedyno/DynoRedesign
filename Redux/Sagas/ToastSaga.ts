import { put } from "redux-saga/effects";
import { TOAST_HIDE, TOAST_SHOW } from "../Actions/ToastAction";
import { toastReducer } from "@/utils/types";

interface IToast {
  payload: toastReducer;
}

export function* ToastSaga(action: IToast): unknown {
  if (action.payload.hide) {
    yield put({ type: TOAST_HIDE });
  } else {
    yield put({ type: TOAST_SHOW, payload: action.payload });
  }
}
