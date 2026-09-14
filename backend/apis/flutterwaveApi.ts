import { raw as envRaw } from "../utils/config";
import Flutterwave from "flutterwave-node-v3";

// Define Flutterwave interface based on usage
interface FlutterwaveCharge {
  validate: (params: { otp: string; flw_ref: string }) => Promise<{ data: { id: number } }>;
  card: (params: Record<string, unknown>) => Promise<unknown>;
  bank_transfer: (params: Record<string, unknown>) => Promise<unknown>;
  ng: (params: Record<string, unknown>) => Promise<unknown>;
  ach_payment: (params: Record<string, unknown>) => Promise<unknown>;
  ussd: (params: Record<string, unknown>) => Promise<unknown>;
}

interface FlutterwaveTransaction {
  verify: (params: { id: number | string }) => Promise<{ 
    status?: string;
    message?: string;
    data: { id: number; flw_ref: string; status: string } 
  }>;
}

interface FlutterwavePaymentPlan {
  create: (params: Record<string, unknown>) => Promise<unknown>;
  get: (params: { id: string }) => Promise<unknown>;
  getAll: () => Promise<unknown>;
  update: (params: Record<string, unknown>) => Promise<unknown>;
  cancel: (params: { id: string }) => Promise<unknown>;
}

interface FlutterwaveSubaccount {
  create: (params: Record<string, unknown>) => Promise<unknown>;
  fetch: (params: { id: string }) => Promise<unknown>;
  fetchAll: () => Promise<unknown>;
  delete: (params: { id: string }) => Promise<unknown>;
}

interface FlutterwaveVirtualCard {
  create: (params: Record<string, unknown>) => Promise<unknown>;
  get: (params: Record<string, unknown>) => Promise<unknown>;
}

interface FlutterwaveMobileMoney {
  ghana: (params: Record<string, unknown>) => Promise<unknown>;
  uganda: (params: Record<string, unknown>) => Promise<unknown>;
  rwanda: (params: Record<string, unknown>) => Promise<unknown>;
  zambia: (params: Record<string, unknown>) => Promise<unknown>;
  francophone: (params: Record<string, unknown>) => Promise<unknown>;
  mpesa: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface FlutterwaveInstance {
  Charge: FlutterwaveCharge;
  Transaction: FlutterwaveTransaction;
  PaymentPlan: FlutterwavePaymentPlan;
  Subaccount: FlutterwaveSubaccount;
  VirtualCard: FlutterwaveVirtualCard;
  MobileMoney: FlutterwaveMobileMoney;
}

let flw: FlutterwaveInstance | null = null;

// Only initialize if credentials are provided
if (envRaw("FLW_PUBLIC_KEY") && envRaw("FLW_SECRET_KEY")) {
  flw = new Flutterwave(
    envRaw("FLW_PUBLIC_KEY"),
    envRaw("FLW_SECRET_KEY")
  ) as FlutterwaveInstance;
}

export default flw;
