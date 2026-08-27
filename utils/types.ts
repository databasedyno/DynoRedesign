import { AlertColor, SxProps, Theme } from "@mui/material";
import type { ReactNode } from "react";

export interface ReducerAction {
  payload: any;
  type: string;
  crudType: string;
}

export interface rootReducer {
  userReducer: userReducer;
  toastReducer: toastReducer;
  paymentLinkReducer: import("@/Redux/Reducers/paymentLinkReducer").PaymentLinkState;
}

export interface userReducer {
  email: string;
  name: string;
  loading: boolean;
  mobile: string;
  user_id: number;
  photo: string;
  telegram_id: string;
  error: { message: string; actionType: string } | null;
  profile?: any;
  profileLoading?: boolean;
  // 2FA / login-OTP flow (Session 82 two-step login refactor).
  loginOtpRequired?: boolean;
  loginOtpMaskedEmail?: string;
  loginOtpSession?: string;
  loginOtpLoading?: boolean;
  // Email-verification banner state (populated after profile fetch).
  email_verified?: boolean;
}

export interface companyReducerState {
  companyList: ICompany[];
  loading: boolean;
  fetched: boolean;
  taxValidation?: any;
  selectedCompanyId: number | null;
}
// NOTE: wallet + company data now flow through SWR contexts, not redux. The
// `companyReducerState`/`walletReducerState` interfaces are retained only as
// convenience data shapes and are no longer part of `rootReducer`.

export interface apiReducer {
  apiList: IApi[];
  loading: boolean;
}

// NOTE: transaction data now flows through SWR (hooks/useTransactions), not
// redux. This interface is retained only as a convenience data shape and is no
// longer part of `rootReducer`.
export interface transactionReducer {
  customers_transactions: ICustomerTransactions[];
  self_transactions: ICustomerTransactions[];
  loading: boolean;
  loaded_company_id?: number | null;
  transactionDetail?: any;
  detailLoading?: boolean;
  exportLoading?: boolean;
}

export interface walletReducerState {
  walletList: IWallet[];
  loading: boolean;
  fetched?: boolean;
  amount: number;
  currency: string;
  otpVerified?: boolean;
  paymentData: {
    mode: "avs_noauth" | "pin" | "otp" | "";
    fields: string[];
    uniqueRef: string;
  };
  addressError?: string | null;
  addressErrorField?: string | null;
  addressErrorNonce?: number;
}

export interface ICompany {
  company_id: number;
  user_id: number;
  company_name: string;
  mobile: string;
  photo: string;
  email: string;
  website: string;
  country: string;
  state: string;
  city: string;
  address_line_1: string;
  address_line_2: string;
  zip_code: string;
  VAT_number: string;
}

export interface IApi {
  api_id: number;
  company_id: number;
  company_name: string;
  user_id: number;
  base_currency: string;
  apiKey: string;
  adminToken: string;
  // Optional runtime flag — set on the ApiKeysPage row when the merchant
  // toggles a key active/inactive/revoked (soft-delete state).
  status?: "active" | "inactive" | "revoked" | string;
}

export interface ICustomerTransactions {
  user_id: number;
  payment_mode: string;
  base_amount: number;
  base_currency: string;
  transaction_reference: string;
  transaction_type: string;
  status: string;
  customer_id: number;
  createdAt: string;
  updatedAt: string;
  transaction_details: string;
  id: string;
  customer_name: string;
  email: string;
  company_name: string;
  company_id: number;
}

export interface ISelfTransactions {
  user_id: number;
  payment_mode: string;
  base_amount: number;
  base_currency: string;
  transaction_reference: string;
  transaction_type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  transaction_details: string;
  id: string;
}

export interface IWallet {
  id: string;
  user_id: number;
  amount: number;
  fee: number;
  wallet_type: string;
  wallet_address: string;
  wallet_account_id: string;
  createdAt: string;
  updatedAt: string;
  currency_type: string;
  amount_in_usd: string;
  fee_in_usd: string;
  transfer_rate: string;
  // Legacy DB alias — some code paths reference wallet_id instead of id.
  wallet_id?: number | string;
}

export interface menuItem {
  value: any;
  label: any;
  disable?: boolean;
}

export interface toastReducer {
  open: boolean;
  severity: AlertColor;
  message: string;
  hide?: boolean;
  loading?: boolean;
}

export interface LayoutProps {
  pageBackBtn?: boolean;
  children: JSX.Element | JSX.Element[];
  pageName: string;
  pageDescription?: string;
  pageWarning?: ReactNode;
  pageAction?: ReactNode;
  pageHeaderSx?: SxProps<Theme>;
}

export interface TokenData {
  user_id: number;
  name: string;
  email: string;
  photo: string;
  mobile: string;
  telegram_id: string;
  role: string;
}

export interface IconProps {
  fill?: string;
  size?: number;
}

export interface pageProps {
  setPageName: (name: string) => void;
  setPageDescription?: (description: string) => void;
  setPageAction?: (action: ReactNode | null) => void;
  setPageHeaderSx?: (sx: SxProps<Theme> | null) => void;
  setPageWarning?: (warning: ReactNode | null) => void;
  discription?: Function;
}

export interface IToastProps {
  open?: boolean;
  severity?: AlertColor;
  message?: string;
  hide?: boolean;
  loading?: boolean;
}

export interface ISavedAddressTypes {
  user_address_id: number;
  user_id: number;
  label: string;
  currency: string;
  wallet_address: string;
}

export type TransactionStatus = "success" | "failed";

export interface ITransaction {
  txId: string | null;
  status: TransactionStatus;
  fromAddress?: string;
  toAddress?: string;
  errorMessage?: string;
}
export type ITransactions = ITransaction[];

// success types
