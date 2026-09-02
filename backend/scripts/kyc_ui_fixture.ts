/**
 * REVERSIBLE test-fixture for the account-type UX (Settings chooser + onboarding
 * first-run choice + individual->business conversion).
 *
 *   Setup:    npx ts-node scripts/kyc_ui_fixture.ts --setup
 *   Teardown: npx ts-node scripts/kyc_ui_fixture.ts --teardown
 *
 * Setup creates, for the test owner (user_id=1), a THROWAWAY first-run
 * INDIVIDUAL company ("Account Type Test") with:
 *   - account_type=individual, NO country  -> profileComplete=false
 *   - one crypto wallet (so the dashboard ActivationChecklist renders)
 *   - NO transactions (so hasPayment=false -> first-run state)
 * Teardown removes the wallet, any kyc rows, and the company.
 * Nothing touches a real merchant — everything is scoped to the scratch company.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import companyModel from "../models/companyModels/companyModel";
import userWalletModel from "../models/userModels/userWalletModel";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const USER_ID = 1;
const NAME = "Account Type Test";
const ID_FILE = path.join(__dirname, ".scratch_kyc_id");

async function setup() {
  const created: any = await companyModel.create({
    user_id: USER_ID,
    company_name: NAME,
    email: "scratch-acct@dynopaytest.com",
    account_type: "individual",
  } as any);
  const companyId = created?.dataValues?.company_id ?? created?.company_id;

  await userWalletModel.create({
    user_id: USER_ID,
    company_id: companyId,
    wallet_name: "Scratch ETH",
    wallet_type: "ETH",
    wallet_address: "0xSCRATCHTEST0000000000000000000000000000",
    currency_type: "CRYPTO",
    amount: 0,
  } as any);

  fs.writeFileSync(ID_FILE, String(companyId));
  console.log("SETUP done. scratch individual company_id =", companyId, "(wallet, no country, no payments)");
}

async function teardown() {
  let companyId: number | null = null;
  try {
    companyId = Number(fs.readFileSync(ID_FILE, "utf8").trim());
  } catch {
    /* fall back to name lookup */
  }
  if (!companyId || !Number.isFinite(companyId)) {
    const rows: any[] = await sequelize.query(
      `SELECT company_id FROM tbl_company WHERE user_id=:u AND company_name=:n`,
      { replacements: { u: USER_ID, n: NAME }, type: QueryTypes.SELECT },
    );
    companyId = rows[0]?.company_id ?? null;
  }
  if (!companyId) {
    console.log("TEARDOWN: no scratch company found — nothing to do.");
    return;
  }
  const w = await userWalletModel.destroy({ where: { company_id: companyId } });
  const kyc = await sequelize.query(`DELETE FROM tbl_kyc WHERE company_id=:c`, {
    replacements: { c: companyId },
  });
  const co = await companyModel.destroy({ where: { company_id: companyId, user_id: USER_ID } });
  try { fs.unlinkSync(ID_FILE); } catch { /* ignore */ }
  console.log(`TEARDOWN done. company_id=${companyId} wallets_deleted=${w} kyc_deleted=${(kyc as any)?.[1]?.rowCount ?? "?"} company_deleted=${co}`);
}

async function main() {
  const mode = process.argv.includes("--teardown") ? "teardown" : process.argv.includes("--setup") ? "setup" : null;
  if (!mode) throw new Error("Pass --setup or --teardown");
  if (mode === "setup") await setup();
  else await teardown();
  process.exit(0);
}
main().catch((e) => { console.error("ERROR:", e?.message || e); process.exit(1); });
