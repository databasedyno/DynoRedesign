export const PAYLINK_INIT: any = "PAYLINK_INIT";
export const PAYLINK_FETCH = "PAYLINK_FETCH";
export const PAYLINK_CREATE = "PAYLINK_CREATE";
export const PAYLINK_UPDATE = "PAYLINK_UPDATE";
export const PAYLINK_DELETE = "PAYLINK_DELETE";
export const PAYLINK_ERROR = "PAYLINK_ERROR";
export const PAYLINK_FEE_PREVIEW = "PAYLINK_FEE_PREVIEW";
// Fine-grained error carrying a field hint (see paymentLinkReducer:createError/createErrorField).
// Dispatched by PaymentLinkSaga when /pay/createPaymentLink fails, so the UI can show an
// inline error next to the offending field instead of just a toast.
export const PAYLINK_CREATE_ERROR = "PAYLINK_CREATE_ERROR";
export const PAYLINK_CREATE_ERROR_CLEAR = "PAYLINK_CREATE_ERROR_CLEAR";

export const PaymentLinkAction = (type?: string, data?: any) => {
  return { type: PAYLINK_INIT, payload: data, crudType: type };
};
