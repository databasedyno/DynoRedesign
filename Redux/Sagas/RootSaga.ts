import { takeEvery } from "redux-saga/effects";
import { TOAST_INIT } from "../Actions/ToastAction";
import { ToastSaga } from "./ToastSaga";

function* RootSaga() {
  yield takeEvery(TOAST_INIT, ToastSaga);
  // User (auth/profile) migrated to SWR (hooks/useUser + hooks/useProfile).
  // Company / Wallet / Transactions / API keys / Dashboard / PaymentLinks also
  // moved to SWR (CompanyDataContext / WalletDataContext / hooks/useTransactions
  // / useApiKeys / useDashboardData / usePaymentLinks). Only Toast remains on
  // redux-saga (Wave 6 will retire it).
}

export default RootSaga;
