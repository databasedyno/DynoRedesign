/**
 * REVERSIBLE test-fixture for KYC-grace + individual->business UI testing.
 *
 *   Setup:    npx ts-node scripts/kyc_ui_fixture.ts --setup
 *   Teardown: npx ts-node scripts/kyc_ui_fixture.ts --teardown
 *
 * Setup creates, for the test owner (user_id=1):
 *   - a THROWAWAY individual company ("KYC Test (Individual)")
 *   - one scratch successful $15,000 customer_transaction on it (pushes it over
 *     the $10k KYC threshold so the grace banner renders with ~90 days left)
 * Teardown removes the scratch transaction, any kyc rows, and the company.
 * Nothing touches a real merchant — everything is scoped to the scratch company.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import companyModel from "../models/companyModels/companyModel";
import customerTransactionModel from "../models/customerModels/customerTransactionModel";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const USER_ID = 1;
const REF = "SCRATCH-KYC-UI-TEST";
const ID_FILE = path.join(__dirname, ".scratch_kyc_id");

async function setup() {
  const created: any = await companyModel.create({
    user_id: USER_ID,
    company_name: "KYC Test (Individual)",
    email: "scratch-kyc@dynopaytest.com",
    account_type: "individual",
  } as any);
  const companyId = created?.dataValues?.company_id ?? created?.company_id;

  await customerTransactionModel.create({
    company_id: companyId,
    base_amount: 15000,
    base_currency: "USD",
    paid_amount: 15000,
    paid_currency: "USD",
    status: "successful",
    transaction_reference: `${REF}-${Date.now()}`,
    transaction_details: "scratch kyc ui test",
    transaction_type: "CREDIT",
    payment_mode: "CRYPTO",
  } as any);

  fs.writeFileSync(ID_FILE, String(companyId));
  console.log("SETUP done. scratch individual company_id =", companyId, "(vol $15,000 successful)");
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
      `SELECT company_id FROM tbl_company WHERE user_id=:u AND company_name='KYC Test (Individual)'`,
      { replacements: { u: USER_ID }, type: QueryTypes.SELECT },
    );
    companyId = rows[0]?.company_id ?? null;
  }
  if (!companyId) {
    console.log("TEARDOWN: no scratch company found — nothing to do.");
    return;
  }
  const tx = await customerTransactionModel.destroy({ where: { company_id: companyId } });
  const kyc = await sequelize.query(`DELETE FROM tbl_kyc WHERE company_id=:c`, {
    replacements: { c: companyId },
  });
  const co = await companyModel.destroy({ where: { company_id: companyId, user_id: USER_ID } });
  try { fs.unlinkSync(ID_FILE); } catch { /* ignore */ }
  console.log(`TEARDOWN done. company_id=${companyId} tx_deleted=${tx} kyc_deleted=${(kyc as any)?.[1]?.rowCount ?? "?"} company_deleted=${co}`);
}

async function main() {
  const mode = process.argv.includes("--teardown") ? "teardown" : process.argv.includes("--setup") ? "setup" : null;
  if (!mode) throw new Error("Pass --setup or --teardown");
  if (mode === "setup") await setup();
  else await teardown();
  process.exit(0);
}
main().catch((e) => { console.error("ERROR:", e?.message || e); process.exit(1); });
