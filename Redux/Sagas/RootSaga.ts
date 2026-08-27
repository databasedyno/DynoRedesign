import { takeEvery, takeLatest, debounce } from "redux-saga/effects";
import { USER_INIT } from "../Actions/UserAction";
import { UserSaga } from "./UserSaga";
import { TOAST_INIT } from "../Actions/ToastAction";
import { ToastSaga } from "./ToastSaga";
import { DASHBOARD_INIT, DASHBOARD_CHART_INIT } from "../Actions/DashboardAction";
import { DashboardSaga, DashboardChartSaga } from "./DashboardSaga";
import { PAYLINK_INIT } from "../Actions/PaymentLinkAction";
import { PaymentLinkSaga } from "./PaymentLinkSaga";

function* RootSaga() {
  yield takeEvery(USER_INIT, UserSaga);
  yield takeEvery(TOAST_INIT, ToastSaga);
  // Company + Wallet + Transactions + API keys reads/mutations migrated to SWR
  // (CompanyDataContext / WalletDataContext / hooks/useTransactions /
  // hooks/useApiKeys) — their sagas have been retired.
  yield debounce(400, DASHBOARD_INIT, DashboardSaga);
  // Chart fetches MUST NOT share the debounced DASHBOARD_INIT channel:
  // on dashboard mount DASHBOARD_FETCH_ALL lands in the same 400ms window
  // and swallowed the chart fetch (empty "Transaction Volume" chart).
  yield takeLatest(DASHBOARD_CHART_INIT, DashboardChartSaga);
  yield takeEvery(PAYLINK_INIT, PaymentLinkSaga);
}

export default RootSaga;
