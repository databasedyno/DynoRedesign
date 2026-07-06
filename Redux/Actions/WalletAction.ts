export const WALLET_INIT: any = "WALLET_INIT";
export const WALLET_INSERT = "WALLET_INSERT";
export const WALLET_FETCH = "WALLET_FETCH";
export const WALLET_UPDATE = "WALLET_UPDATE";
export const WALLET_DELETE = "WALLET_DELETE";
export const WALLET_API_ERROR = "WALLET_API_ERROR";
export const WALLET_FUND_CREATE = "WALLET_FUND_CREATE";
export const WALLET_ADD_FUND = "WALLET_ADD_FUND";
export const WALLET_ADD_ADDRESS = "WALLET_ADD_ADDRESS";
export const VERIFY_OTP = "VERIFY_OTP";
// Field-hinted error emitted by WalletSaga on validateWalletAddress failure,
// so AddWalletModal can surface the message inline next to the offending field.
export const WALLET_ADDRESS_ERROR = "WALLET_ADDRESS_ERROR";
export const WALLET_ADDRESS_ERROR_CLEAR = "WALLET_ADDRESS_ERROR_CLEAR";

export const WalletAction = (type?: string, data?: any) => {
  return { type: WALLET_INIT, payload: data, crudType: type };
};
