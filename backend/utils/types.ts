export interface IUserType {
  user_id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  password: string;
  email: string;
  username: string;
  photo: string;
  mobile: string;
  telegram_id: string;
  oldPassword: string;
  newPassword: string;
  customer_id: string;
  customer_name: string;
  id: string;
  ref: string;
  adm_id: string;
  pathType: string;
  role: string;
  company_id?: number | string;  // Optional company_id for multi-tenant isolation
}

export interface ICompany {
  user_id: number;
  company_name: string;
  email: string;
  mobile: string;
  photo: string;
  website: string;
}

export interface IFundData {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
  focus: string;
  paymentType: string;
  currency: string;
  amount: number;
  uniqueRef: string;
  mode: "pin" | "avs_noauth" | "otp";
  pin: string;
  city: string;
  address: string;
  state: string;
  country: string;
  zipcode: string;
  otp: string;
  account_number: string;
  network: string;
  mobile: string;
  direct_pay_temp_id?: number;
}

export interface FW_API_Response {
  status?: string;
  message?: string;
  data?: Data;
  meta?: Meta;
}

export interface Data {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  currency: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  plan: Record<string, unknown>;
  fraud_status: string;
  charge_type: string;
  created_at: string;
  account_id: number;
  customer: Customer;
  card: Card;
  meta: Meta;
}

export interface Customer {
  id: number;
  phone_number: string | null;
  name: string;
  email: string;
  created_at: string;
}

export interface Card {
  first_6digits: string;
  last_4digits: string;
  issuer: string;
  country: string;
  type: string;
  expiry: string;
}

export interface Meta {
  authorization: Authorization;
}

export interface Authorization {
  mode: string;
  redirect: string;
  fields: string[];
  transfer_reference: string;
  transfer_account: string;
  transfer_bank: string;
  account_expiration: number;
  transfer_note: string;
  transfer_amount: string;
}

export interface IWebHook {
  id: number;
  txRef: string;
  flwRef: string;
  orderRef: string;
  paymentPlan: Record<string, unknown> | null;
  paymentPage: Record<string, unknown> | null;
  createdAt: string;
  amount: number;
  charged_amount: number;
  status: string;
  IP: string;
  currency: string;
  appfee: number;
  merchantfee: number;
  merchantbearsfee: number;
  customer: IWebHookCustomer;
  entity: IWebHookEntity;
  "event.type": string;
}

export interface ITatumWebHook {
  address: string;
  asset: string;
  blockNumber: number;
  counterAddress: string;
  txId: string;
  chain: string;
  subscriptionType: string;
  type: string;
  amount: string;
}

export interface IWebHookCustomer {
  id: number;
  phone: string;
  fullName: string;
  customertoken: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: Date | null;
  AccountId: number;
}

export interface IWebHookEntity {
  account_number: string;
  first_name: string;
  last_name: string;
  createdAt: string;
}

export interface IVerifyResponse {
  status?: string;
  message?: string;  // Fixed typo from 'messge'
  data: {
    id: number;
    tx_ref?: string;
    flw_ref: string;
    device_fingerprint?: string;
    amount?: number;
    currency?: string;
    charged_amount?: number;
    app_fee?: number;
    merchant_fee?: number;
    processor_response?: string;
    auth_model?: string;
    ip?: string;
    narration?: string;
    status: string;
    payment_type?: string;
    created_at?: string;
    account_id?: number;
    meta?: Record<string, unknown> | null;
    amount_settled?: number;
    customer?: Customer;
  };
}

export interface virtualAccount {
  currency: string;
  xpub: string;
  customerId: string;
}

export interface IAdminWallet {
  wallet_id: number;
  wallet_type: string;
  wallet_address: string;
  xpub: string;
  mnemonic: string;
  privateKey: string;
  amount: number;
  fee: number;
  currency_type: string;
  customer_id: string;
  wallet_account_id: string;
}

export interface ITemporaryAddress {
  temp_id: number;
  user_id: number;
  wallet_type: string;
  wallet_address: string;
  wallet_account_id: string;
  subscription_id: string | null;
  index: number;
  privateKey: string;
  txId: string | null;
  admin_txId: string;
  status: string;
  admin_status: string;
  blockchain_fee: string;
  amount_to_be_paid: number;
  amount?: number;
  expected_amount?: number;
  company_id?: number;
  fee_payer?: string;
  merchant_amount?: number;
  partial_payment_timestamp?: Date;
  check_count?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Admin data interface for query results
export interface IAdminData {
  email?: string;
}

// Payment link data interface
export interface PaymentLinkData {
  link_id?: number;
  company_id?: number;
  user_id?: number;
  amount?: number;
  currency?: string;
  description?: string;
  status?: string;
  callback_url?: string;
  redirect_url?: string;
  webhook_url?: string;
  fee_payer?: string;
  accepted_currencies?: string | string[];
  allow_currency_select?: boolean;
  tax_rate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// User JWT payload with id for payment controller
export interface PaymentUserJwtPayload {
  id?: number | string;
  user_id: number;
  email: string;
  company_id?: number;
  name?: string;
  role?: string;
}

export interface IGenerateUserAddressParams {
  currency: string;
  xpub: string;
  index?: number;
  mnemonic: string;
}