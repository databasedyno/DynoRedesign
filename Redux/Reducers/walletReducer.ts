import { ReducerAction } from "@/utils/types";
import { walletReducer as IWalletReducer } from "@/utils/types";
import {
  WALLET_API_ERROR,
  WALLET_DELETE,
  WALLET_FETCH,
  WALLET_FUND_CREATE,
  WALLET_ADD_ADDRESS,
  WALLET_INIT,
  WALLET_INSERT,
  WALLET_UPDATE,
  VERIFY_OTP,
  WALLET_ADDRESS_ERROR,
  WALLET_ADDRESS_ERROR_CLEAR,
} from "../Actions/WalletAction";

const walletInitialState: IWalletReducer = {
  walletList: [],
  loading: false,
  fetched: false,
  amount: 0,
  currency: "USD",
  otpVerified: false,
  paymentData: {
    mode: "",
    fields: [],
    uniqueRef: "",
  },
  // Field-hinted error from the most recent validateWalletAddress failure.
  // Consumed by AddWalletModal to surface an inline hint on the right field.
  addressError: null as string | null,
  addressErrorField: null as string | null,
  addressErrorNonce: 0,
};

const walletReducer = (state = walletInitialState, action: ReducerAction) => {
  const { payload } = action;

  switch (action.type) {
    case WALLET_INIT:
      return {
        ...state,
        loading: true,
        // Clear stale field errors when a new attempt starts
        ...((action as any).crudType === WALLET_ADD_ADDRESS && {
          addressError: null,
          addressErrorField: null,
        }),
      };
    case WALLET_INSERT:
      return {
        ...state,
        loading: false,
        walletList: [...state.walletList, payload],
      };

    case WALLET_UPDATE:
      const index = state.walletList.findIndex((x) => x.id === payload.id);
      const tempArray = [...state.walletList];
      tempArray[index] = payload.data;
      return {
        ...state,
        loading: false,
        walletList: tempArray,
      };

    case WALLET_FETCH:
      return {
        ...state,
        loading: false,
        fetched: true,
        walletList: Array.isArray(payload) ? payload : [],
      };

    case WALLET_DELETE:
      const tempList = state.walletList.filter((x) => x.id !== payload);
      return {
        ...state,
        loading: false,
        walletList: [...tempList],
      };

    case WALLET_FUND_CREATE:
      return {
        ...state,
        loading: false,
        amount: payload.amount,
        currency: payload.currency,
      };
    case WALLET_ADD_ADDRESS:
      return {
        ...state,
        loading: false,
        wallet_address: payload.wallet_address,
        currency: payload.currency,
        otpVerified: false, // Reset OTP verification flag
      };

    case VERIFY_OTP:
      return {
        ...state,
        loading: false,
        otpVerified: payload.success || false,
      };

    case WALLET_API_ERROR:
      return {
        ...state,
        loading: false,
        fetched: true,
      };

    case WALLET_ADDRESS_ERROR:
      return {
        ...state,
        loading: false,
        fetched: true,
        addressError: payload?.message ?? "Wallet validation failed",
        addressErrorField: payload?.field ?? "generic",
        addressErrorNonce: (state.addressErrorNonce || 0) + 1,
      };

    case WALLET_ADDRESS_ERROR_CLEAR:
      return {
        ...state,
        addressError: null,
        addressErrorField: null,
      };
    default:
      return {
        ...state,
      };
  }
};

export default walletReducer;
