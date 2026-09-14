/**
 * Verification for personal-account provisioning — WRITES NOTHING.
 *
 * The create path is exercised inside a transaction that is deliberately ROLLED
 * BACK, so we prove the Sequelize model <-> new account_type column mapping works
 * without leaving a junk Account on the production database.
 */
import sequelize from "../utils/dbInstance";
import { companyModel } from "../models/companyModels";
import { ensurePersonalAccount } from "../services/accountProvisioning";

(async () => {
  let failures = 0;
  const check = (name: string, pass: boolean, detail: string) => {
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}: ${detail}`);
    if (!pass) failures += 1;
  };

  // 1. Idempotency: a user who already owns an Account must NOT get a second one.
  const before = await companyModel.count();
  const existing = await ensurePersonalAccount({
    user_id: 1,
    name: "hostbay",
    email: "hostbay@moxx.co",
  });
  const afterIdem = await companyModel.count();
  check(
    "idempotent for a user who already has an Account",
    existing === 1 && afterIdem === before,
    `returned company_id=${existing} (expected 1), company count ${before} -> ${afterIdem}`
  );

  // 2. Test emails are skipped so QA runs never litter production.
  const testSkip = await ensurePersonalAccount({
    user_id: 9,
    name: "testdyno",
    email: "testdyno@dyno.pt",
  });
  const afterTest = await companyModel.count();
  check(
    "skips QA/test email domains",
    testSkip === null && afterTest === before,
    `returned ${testSkip} (expected null), company count still ${afterTest}`
  );

  // 3. A user with nothing to derive a name from is skipped rather than guessed at.
  const noName = await ensurePersonalAccount({
    user_id: 10,
    name: null,
    handle: null,
    email: null,
  });
  const afterNoName = await companyModel.count();
  check(
    "skips a user with no name/handle/email",
    noName === null && afterNoName === before,
    `returned ${noName} (expected null), company count still ${afterNoName}`
  );

  // 4. The CREATE path: proves account_type is really written through the model.
  //    Rolled back, so nothing persists.
  const tx = await sequelize.transaction();
  try {
    const created: any = await companyModel.create(
      {
        user_id: 9,
        company_name: "ROLLBACK PROBE — must never persist",
        email: "rollback.probe@example.com",
        account_type: "individual",
      } as any,
      { transaction: tx }
    );
    const newId = created?.dataValues?.company_id ?? created?.company_id;
    const readBack: any = await companyModel.findOne({
      where: { company_id: newId },
      attributes: ["company_id", "account_type", "company_name"],
      transaction: tx,
    });
    check(
      "create path writes account_type='individual' via the model",
      readBack?.dataValues?.account_type === "individual",
      `read back account_type=${readBack?.dataValues?.account_type} for temp company_id=${newId}`
    );
  } finally {
    await tx.rollback();
  }

  const finalCount = await companyModel.count();
  check(
    "rollback left the database untouched",
    finalCount === before,
    `company count ${before} -> ${finalCount}`
  );

  // 5. The hook registration function really installs the afterCreate hook.
  //    (In the live server this already happens at boot — the log line
  //    "Account provisioning hook registered (userModel.afterCreate)" proves it.
  //    A standalone script has to call it explicitly, which is what we assert.)
  const { userModel } = await import("../models/userModels");
  const hooksBefore = (userModel as any).options?.hooks?.afterCreate || [];
  const countBefore = (Array.isArray(hooksBefore) ? hooksBefore : [hooksBefore]).filter(Boolean).length;

  const { registerAccountProvisioningHooks } = await import("../services/accountProvisioning");
  registerAccountProvisioningHooks();

  const hooksAfter = (userModel as any).options?.hooks?.afterCreate || [];
  const names = (Array.isArray(hooksAfter) ? hooksAfter : [hooksAfter])
    .filter(Boolean)
    .map((h: any) => h?.name || "anonymous");
  check(
    "registerAccountProvisioningHooks() installs a named afterCreate hook",
    names.includes("provisionPersonalAccount") && names.length === countBefore + 1,
    `afterCreate hooks went from ${countBefore} to [${names.join(", ")}]`
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("VERIFICATION ERROR:", e.message);
  process.exit(1);
});
