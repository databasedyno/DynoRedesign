import { takeEvery } from "redux-saga/effects";
import { USER_INIT } from "../Actions/UserAction";
import { UserSaga } from "./UserSaga";
import { TOAST_INIT } from "../Actions/ToastAction";
import { ToastSaga } from "./ToastSaga";
import { PAYLINK_INIT } from "../Actions/PaymentLinkAction";
import { PaymentLinkSaga } from "./PaymentLinkSaga";

function* RootSaga() {
  yield takeEvery(USER_INIT, UserSaga);
  yield takeEvery(TOAST_INIT, ToastSaga);
  // Company + Wallet + Transactions + API keys + Dashboard reads/mutations
  // migrated to SWR (CompanyDataContext / WalletDataContext /
  // hooks/useTransactions / hooks/useApiKeys / hooks/useDashboardData) — their
  // sagas have been retired.
  yield takeEvery(PAYLINK_INIT, PaymentLinkSaga);
}

export default RootSaga;
