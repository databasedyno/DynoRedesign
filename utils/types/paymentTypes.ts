import { Focused } from "react-credit-cards-2";

export interface successRes {
  id: number;
  txRef: string;
  orderRef: string;
  flwRef: string;
  redirectUrl: string;
  device_fingerprint: string;
  settlement_token: any;
  cycle: string;
  amount: number;
  charged_amount: number;
  appfee: number;
  merchantfee: number;
  merchantbearsfee: number;
  chargeResponseCode: string;
  raveRef: string;
  chargeResponseMessage: string;
  authModelUsed: string;
  currency: string;
  IP: string;
  narration: string;
  status: string;
  modalauditid: string;
  vbvrespmessage: string;
  authurl: string;
  vbvrespcode: string;
  acctvalrespmsg: any;
  acctvalrespcode: string;
  paymentType: string;
  paymentPlan: any;
  paymentPage: any;
  paymentId: string;
  fraud_status: string;
  charge_type: string;
  is_live: number;
  retry_attempt: any;
  getpaidBatchId: any;
  createdAt: string;
  updatedAt: string;
  deletedAt: any;
  customerId: number;
  AccountId: number;
  customer: ICustomer;
  chargeToken: IChargeToken;
  airtime_flag: boolean;
}

export interface ICustomer {
  id: number;
  phone: any;
  fullName: string;
  customertoken: any;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: any;
  AccountId: number;
}

export interface IChargeToken {
  user_token: string;
  embed_token: string;
}

export interface cardType {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
  focus: Focused;
}

export interface CardApiRes {
  data: {
    mode: "redirect" | "pin" | "avs_noauth" | "otp";
    redirect: string;
    fields: string[];
    hash: string;
    status: string;
    id: number;
  };
}

export interface BankTransferApiRes {
  data: {
    mode: "banktransfer";
    transfer_account: string;
    transfer_bank: string;
    transfer_note: string;
    transfer_amount: string;
    account_expiration: number;
    hash: string;
  };
}

export interface CommonApiRes {
  data: {
    hash: string;
    redirect: string;
    qr_image: string;
    qr_code: string;
    address: string;
  };
}

export interface USSDApiRes {
  data: {
    note: string;
    hash: string;
    payment_code: string;
  };
}

export interface CommonDetails {
  hash: string;
  redirect: string;
  qr_image: string;
}

export interface transferDetails {
  transfer_account: string;
  transfer_bank: string;
  transfer_note: string;
  transfer_amount: string;
  account_expiration: number;
  hash: string;
}

export interface currencyData {
  currency: string;
  amount: string | number;
  transferRate: string;
  // Runtime fields set by cryptoTransfer + friends after fee calc / conversion.
  // Optional because they're populated post-hoc, not part of the initial ticker fetch.
  total_amount?: number;
  total_amount_usd?: number;
  total_amount_source?: number;
  processing_fee?: number;
}

/**
 * Backward-compat shape — the payment layer (cryptoTransfer.tsx +
 * pages/pay/index.tsx) imports a `walletState` type here. Kept narrow
 * enough that `.currency` / `.amount` type as `string | undefined` /
 * `number | undefined` rather than the more permissive `unknown`, so
 * downstream props that expect `string` don't silently accept `unknown`.
 */
export interface walletState {
  currency?: string;
  amount?: number | string;
  [key: string]: unknown;
}
