/**
 * Seed the SafeDeal brand (a Dynopay company owned by the platform owner) and
 * print the company_id to put in backend/.env as SAFEDEAL_COMPANY_ID.
 * Idempotent: reuses an existing "SafeDeal" company for the owner.
 *
 *   npx ts-node -T scripts/seed_safedeal_brand.ts [ownerEmail]
 */
import "dotenv/config";
import { companyModel, userModel } from "../models";

async function main() {
  const ownerEmail = process.argv[2] || "onarrival21@gmail.com";
  const owner: any = await userModel.findOne({ where: { email: ownerEmail } });
  if (!owner) throw new Error(`Owner ${ownerEmail} not found`);
  const userId = Number(owner.dataValues.user_id);
  let company: any = await companyModel.findOne({ where: { user_id: userId, company_name: "SafeDeal" } });
  if (!company) {
    company = await companyModel.create({
      user_id: userId,
      company_name: "SafeDeal",
      account_type: "business",
      display_currency: "USD",
      email: ownerEmail,
      website: "https://safedeal.sh",
      contact_first_name: owner.dataValues.first_name || "SafeDeal",
      contact_last_name: owner.dataValues.last_name || "Ops",
    } as any);
    console.log(`Created SafeDeal brand company_id=${company.dataValues.company_id}`);
  } else {
    console.log(`SafeDeal brand already exists company_id=${company.dataValues.company_id}`);
  }
  console.log(`SAFEDEAL_COMPANY_ID=${company.dataValues.company_id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
