/**
 * Personal Account provisioning.
 *
 * PROBLEM THIS SOLVES
 * -------------------
 * A company was never created at signup — `tbl_company` rows only appeared when
 * a user explicitly created one. But invoices, customers, payment_journal,
 * webhook_delivery_log and api_usage_log are company-scoped ONLY, and the
 * frontend's CompanyDataContext leaves `selectedCompanyId` null forever while the
 * company list is empty. So an individual creator could hold a wallet and take a
 * payment, yet never reach any of those features.
 * (Full analysis: docs/IA_AUDIT_2026-08.md §1.)
 *
 * Founder decision 2026-08-12: DynoPay serves BOTH individuals and businesses,
 * so the Account is the single tenant and "Company" is simply an Account that has
 * filled in a business profile. Every user therefore gets an Account at signup.
 *
 * WHY A MODEL HOOK RATHER THAN 5 CONTROLLER EDITS
 * -----------------------------------------------
 * There are five separate paths that create a user — registerUser,
 * registerEmailVerifyOtp, registerPhoneStep2, connectSocial and facebookSignIn.
 * Patching each one guarantees the sixth one (whenever it is added) gets missed.
 * A single `afterCreate` hook on the user model covers all of them, now and later.
 *
 * WHY afterCommit AND NOT THE SIGNUP TRANSACTION
 * ---------------------------------------------
 * If provisioning ran inside the caller's transaction and any statement failed,
 * Postgres would abort the ENTIRE transaction ("current transaction is aborted"),
 * so a catch block would not save us — a hiccup here would break signup itself.
 * Instead we defer to `transaction.afterCommit`, so provisioning only runs once
 * the user is durably committed and can never take signup down with it.
 */
import { raw as envRaw } from "../utils/config";
import type { Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { companyModel } from "../models/companyModels";
import { userModel } from "../models/userModels";
import sequelize from "../utils/dbInstance";
import { companyLogger } from "../utils/loggers";
import { emailLocalPart, humanizeLocalPart } from "../helper/brandName";

/** Kill switch: set AUTO_PROVISION_PERSONAL_ACCOUNT=false to disable entirely. */
const isEnabled = (): boolean =>
  envRaw("AUTO_PROVISION_PERSONAL_ACCOUNT") !== "false";

/**
 * Automated QA runs against production and creates throwaway users. Without this
 * filter every future test run would leave another junk Account behind — the
 * production DB already carries 10 such users. Mirrors the exclusion list in
 * scripts/backfill_personal_accounts.js.
 */
const TEST_EMAIL_SUFFIXES = ["@dynopaytest.com", "@dynopay-test.com", "@dyno.pt"];

const isTestEmail = (email?: string | null): boolean => {
  const value = String(email || "").toLowerCase();
  return TEST_EMAIL_SUFFIXES.some((suffix) => value.endsWith(suffix));
};

/** name → handle → humanised e-mail local part. Null means "not enough info, skip". */
const deriveAccountName = (user: {
  name?: string | null;
  handle?: string | null;
  email?: string | null;
}): string | null => {
  const candidates = [
    user?.name,
    user?.handle,
    humanizeLocalPart(emailLocalPart(user?.email)),
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value.slice(0, 255);
  }
  return null;
};

/**
 * Give a user a personal Account if they do not already have one.
 * Idempotent: returns the existing company_id when one is already present.
 * Never throws — provisioning must never be able to fail a signup.
 */
export const ensurePersonalAccount = async (user: {
  user_id: number;
  name?: string | null;
  handle?: string | null;
  email?: string | null;
}): Promise<number | null> => {
  try {
    if (!isEnabled() || !user?.user_id) return null;

    const existing = await companyModel.findOne({
      where: { user_id: user.user_id },
      attributes: ["company_id"],
    });
    if (existing) return (existing as any).company_id as number;

    if (isTestEmail(user.email)) {
      companyLogger.info("Skipped personal-account provisioning for a test email", {
        user_id: user.user_id,
      });
      return null;
    }

    const accountName = deriveAccountName(user);
    if (!accountName) {
      companyLogger.warn(
        "Skipped personal-account provisioning: no name/handle/email to derive a name from",
        { user_id: user.user_id }
      );
      return null;
    }

    const created: any = await companyModel.create({
      user_id: user.user_id,
      company_name: accountName,
      email: user.email || null,
      account_type: "individual",
    } as any);

    const companyId = created?.dataValues?.company_id ?? created?.company_id;

    // Owner membership row (teams foundation). Raw SQL because tbl_account_member
    // is intentionally not a Sequelize model yet — `yarn migrate` runs
    // sequelize.sync({ alter: true }), and we do not want that anywhere near it.
    await sequelize.query(
      `INSERT INTO tbl_account_member (company_id, user_id, role, status)
       VALUES (:companyId, :userId, 'owner', 'active')
       ON CONFLICT (company_id, user_id) DO NOTHING`,
      { replacements: { companyId, userId: user.user_id }, type: QueryTypes.INSERT }
    );

    companyLogger.info("Provisioned personal account at signup", {
      user_id: user.user_id,
      company_id: companyId,
      account_type: "individual",
    });

    return companyId as number;
  } catch (error: any) {
    // Deliberately swallowed: a user without an Account is the pre-existing
    // behaviour, which is strictly better than a failed signup.
    companyLogger.error("Personal-account provisioning failed (non-fatal)", {
      user_id: user?.user_id,
      error: error?.message,
    });
    return null;
  }
};

/**
 * Register the afterCreate hook. Called once from server.ts at boot.
 * Named so a double-import cannot install the hook twice.
 */
export const registerAccountProvisioningHooks = (): void => {
  userModel.addHook("afterCreate", "provisionPersonalAccount", (instance: any, options: any) => {
    // Opt-out: users created by the team invite-accept flow are joining an
    // EXISTING business, not starting their own — they must NOT get an
    // auto-provisioned personal company (that would make a teammate look like a
    // brand-new merchant and land them on a stray workspace).
    if (options?.skipAccountProvisioning) {
      companyLogger.info("Skipped personal-account provisioning (skipAccountProvisioning option)", {
        user_id: instance?.user_id ?? instance?.dataValues?.user_id,
      });
      return;
    }

    const user = {
      user_id: instance?.user_id ?? instance?.dataValues?.user_id,
      name: instance?.name ?? instance?.dataValues?.name,
      handle: instance?.handle ?? instance?.dataValues?.handle,
      email: instance?.email ?? instance?.dataValues?.email,
    };

    const run = () => {
      void ensurePersonalAccount(user);
    };

    const transaction: Transaction | undefined = options?.transaction;
    if (transaction && typeof (transaction as any).afterCommit === "function") {
      (transaction as any).afterCommit(run);
    } else {
      run();
    }
  });

  companyLogger.info("Account provisioning hook registered (userModel.afterCreate)");
};

export default { ensurePersonalAccount, registerAccountProvisioningHooks };
