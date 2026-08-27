import { takeEvery } from "redux-saga/effects";
import { USER_INIT } from "../Actions/UserAction";
import { UserSaga } from "./UserSaga";
import { TOAST_INIT } from "../Actions/ToastAction";
import { ToastSaga } from "./ToastSaga";

function* RootSaga() {
  yield takeEvery(USER_INIT, UserSaga);
  yield takeEvery(TOAST_INIT, ToastSaga);
  // Company + Wallet + Transactions + API keys + Dashboard + PaymentLinks
  // reads/mutations migrated to SWR (CompanyDataContext / WalletDataContext /
  // hooks/useTransactions / hooks/useApiKeys / hooks/useDashboardData /
  // hooks/usePaymentLinks) — their sagas have been retired. Only User + Toast
  // remain on redux-saga (User → Wave 5, Toast → Wave 6).
}

export default RootSaga;
