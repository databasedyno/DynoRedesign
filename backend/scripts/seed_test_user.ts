/**
 * Seed a verified test merchant for preview-pod e2e testing (email/password).
 * Uses the app's own helpers so hashing + wallet rows match production exactly.
 * Sends NO emails. Idempotent. Run with DB env exported (see below).
 */
import sequelize from "../utils/dbInstance";
import { userModel } from "../models";
import { hashPassword } from "../helper/passwordHelper";
import { createUserWallets, generateReferralCode } from "../controller/user/userShared";

const EMAIL = "testmerchant@dynopay.dev";
const PASSWORD = "TestMerchant123!";
const NAME = "Test Merchant";

const run = async () => {
  await sequelize.authenticate();
  const existing = await userModel.findOne({ where: { email: EMAIL } });
  if (existing) {
    await userModel.update(
      { password: hashPassword(PASSWORD), email_verified: true, status: "active", name: NAME },
      { where: { email: EMAIL } }
    );
    console.log(`updated existing user_id=${existing.dataValues.user_id}`);
  } else {
    const created = await userModel.create({
      name: NAME,
      email: EMAIL,
      password: hashPassword(PASSWORD),
      referral_code: generateReferralCode(),
      email_verified: true,
      status: "active",
      language: "en",
    } as any);
    const uid = created.dataValues.user_id;
    try {
      await createUserWallets(uid);
    } catch (e) {
      console.warn("createUserWallets skipped:", (e as Error).message);
    }
    console.log(`created user_id=${uid}`);
  }
  console.log(`LOGIN: ${EMAIL} / ${PASSWORD}`);
  process.exit(0);
};

run().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
