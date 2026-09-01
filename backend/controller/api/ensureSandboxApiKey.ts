import { raw as envRaw } from "../../utils/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { encrypt, getErrorMessage, generateApiKeyName } from "../../helper";
import { apiModel, customerModel, customerWalletModel } from "../../models";
import { apiLogger } from "../../utils/loggers";

/** Default sandbox restrictions applied to every auto-provisioned dpk_test_ key. */
const SANDBOX_TEST_MODE_RESTRICTIONS = {
  max_amount: 100,
  allowed_currencies: ["BTC", "ETH", "USDT-TRC20", "TRX", "LTC"],
  sandbox_mode: true,
} as const;

/**
 * Ensures the given company has an active SANDBOX (dpk_test_) API key.
 *
 * - Idempotent: a no-op (returns false) when an active development key already
 *   exists. Backstopped by the 0020 partial-unique index on (company_id,
 *   environment) WHERE status='active'.
 * - Non-fatal: wraps its own try/catch, so a mint failure never breaks the
 *   caller (onboarding must never fail because a key could not be created).
 * - Sandbox keys do NOT require a wallet (unlike the LIVE key), so this is safe
 *   to call at signup and for legacy backfill alike.
 *
 * Mirrors the LIVE-key sibling `ensureLiveApiKey` (controller/wallet/walletOtp.ts)
 * and the original inline onboarding block it replaces.
 *
 * @returns true if a new sandbox key was created; false if one already existed
 *          OR creation was skipped/failed.
 */
export async function ensureSandboxApiKey(
  company_id: number,
  user_id: number,
  userEmail: string,
  companyName?: string | null,
  companyEmail?: string | null,
): Promise<boolean> {
  try {
    const existing = await apiModel.findOne({
      where: { company_id, environment: "development", status: "active" },
    });
    if (existing) return false;

    const baseCurrency = "USD";
    const keyData = {
      base_currency: baseCurrency,
      company_id,
      adm_id: user_id,
      env: "development",
    };
    const keyString = "dpk_test_" + "DYNOPAY_USER_API-" + JSON.stringify(keyData);
    const apiKey = encrypt(keyString, envRaw("API_SECRET"));

    const name = companyName || "Company";
    const email = companyEmail || userEmail;

    const createdCustomer = await customerModel.create({
      id: crypto.randomUUID(),
      customer_name: name + " admin",
      email,
      mobile: email,
      company_id,
    });
    await customerWalletModel.create({
      id: crypto.randomUUID(),
      customer_id: createdCustomer.dataValues.customer_id,
      wallet_type: baseCurrency,
    });

    const secret = envRaw("ACCESS_TOKEN_SECRET");
    const customerToken = jwt.sign(
      { customer_id: createdCustomer.dataValues.customer_id },
      secret,
      { expiresIn: "30d" },
    );
    const adminToken = jwt.sign(
      {
        api_id: null,
        company_id,
        user_id,
        type: "admin_token",
        environment: "development",
      },
      secret,
      { expiresIn: "30d" },
    );

    await apiModel.create({
      company_id,
      base_currency: baseCurrency,
      apiKey,
      user_id,
      adminToken: customerToken,
      admin_token: adminToken,
      withdrawal_whitelist: null,
      api_name: generateApiKeyName(),
      permissions: JSON.stringify(["payments", "transactions", "webhooks", "wallets"]),
      environment: "development",
      status: "active",
      test_mode_restrictions: JSON.stringify(SANDBOX_TEST_MODE_RESTRICTIONS),
      request_count: 0,
      rate_limit_per_minute: 60,
      rate_limit_per_hour: 3600,
      rate_limit_per_day: 100000,
    });

    apiLogger.info(
      `[ensureSandboxApiKey] ✅ Auto-created TEST (dpk_test_) key for company ${company_id}`,
      { user_id },
    );
    return true;
  } catch (err) {
    apiLogger.warn(
      `[ensureSandboxApiKey] ⚠️ Auto TEST key creation skipped for company ${company_id}: ${getErrorMessage(err)}`,
      { user_id },
    );
    return false;
  }
}
