import { ReducerAction } from "@/utils/types";
import { transactionReducer as ITransactionReducer } from "@/utils/types";

import {
  TRANSACTION_ERROR,
  TRANSACTION_FETCH,
  TRANSACTION_INIT,
  TRANSACTION_DETAIL_FETCH,
  TRANSACTION_EXPORT,
} from "../Actions/TransactionAction";

const transactionInitialState: ITransactionReducer = {
  customers_transactions: [],
  self_transactions: [],
  loading: false,
  loaded_company_id: undefined,
  transactionDetail: null,
  detailLoading: false,
  exportLoading: false,
};

const transactionReducer = (
  state = transactionInitialState,
  action: ReducerAction
) => {
  const { payload } = action;

  switch (action.type) {
    case TRANSACTION_INIT:
      return {
        ...state,
        ...(action.crudType === TRANSACTION_DETAIL_FETCH && { detailLoading: true }),
        ...(action.crudType === TRANSACTION_EXPORT && { exportLoading: true }),
        ...(action.crudType === TRANSACTION_FETCH && { loading: true }),
      };

    case TRANSACTION_FETCH:
      return {
        ...state,
        loading: false,
        customers_transactions: payload.customers_transactions,
        self_transactions: payload.self_transactions,
        loaded_company_id: payload.company_id ?? null,
      };

    case TRANSACTION_DETAIL_FETCH:
      return {
        ...state,
        detailLoading: false,
        transactionDetail: payload,
      };

    case TRANSACTION_EXPORT:
      return {
        ...state,
        exportLoading: false,
      };

    case TRANSACTION_ERROR:
      return {
        ...state,
        loading: false,
        detailLoading: false,
        exportLoading: false,
      };

    default:
      return {
        ...state,
      };
  }
};

export default transactionReducer;
