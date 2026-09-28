import { raw as envRaw } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { sendSafeDealNewUserAdminEmail } from "../email/safedealEmails";
import type { CustomerRow } from "../customerWalletService";

export type SafeDealSignupMethod = "email" | "telegram" | "checkout" | "deal";

/** Fire-and-forget: alert the operator (ADMIN_EMAIL) that a brand-new SafeDeal customer row was created. */
export const notifyAdminNewSafeDealUser = (info: {
  email?: string | null;
  name?: string | null;
  customerId: number;
  method: SafeDealSignupMethod;
  telegramId?: string | null;
  telegramUsername?: string | null;
  dealRef?: string | null;
}): void => {
  const adminEmail = (envRaw("ADMIN_EMAIL") || "").trim();
  if (!adminEmail) {
    apiLogger.warn("[SafeDeal] new user onboarded but ADMIN_EMAIL is not set — skipping admin notification");
    return;
  }
  void sendSafeDealNewUserAdminEmail(adminEmail, info).catch((err) =>
    apiLogger.error(`[SafeDeal] new-user admin email failed: ${(err as Error)?.message || err}`)
  );
};

/** `onCreate` hook for resolveCustomerForBrand — fires only when a NEW tbl_customer row is inserted. */
export const adminNotifyOnCreate =
  (method: SafeDealSignupMethod, dealRef?: string | null) =>
  (c: CustomerRow): void =>
    notifyAdminNewSafeDealUser({ email: c.email, name: c.customer_name, customerId: c.customer_id, method, dealRef });
