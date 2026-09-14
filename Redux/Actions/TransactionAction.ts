export const TRANSACTION_INIT: any = "TRANSACTION_INIT";
export const TRANSACTION_INSERT = "TRANSACTION_INSERT";
export const TRANSACTION_FETCH = "TRANSACTION_FETCH";
export const TRANSACTION_DELETE = "TRANSACTION_DELETE";
export const TRANSACTION_ERROR = "TRANSACTION_ERROR";
export const TRANSACTION_DETAIL_FETCH = "TRANSACTION_DETAIL_FETCH";
export const TRANSACTION_EXPORT = "TRANSACTION_EXPORT";

export const TransactionAction = (type?: string, data?: any) => {
  return { type: TRANSACTION_INIT, payload: data, crudType: type };
};
