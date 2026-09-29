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
  paymentType: string;
  currency: string;
  amount: number;
  uniqueRef: string;
  direct_pay_temp_id?: number;
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