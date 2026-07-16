/**
 * One-off: clear the synthetic tax settings the tax-seed script set on hostbay
 * (user_id=1). The /tmp backup was lost on pod reinit, so we reset to a clean,
 * non-VAT-configured state (which is the pre-seed baseline for this merchant).
 */
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres', logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});
(async () => {
  const before = await s.query(
    `SELECT merchant_vat_id, merchant_country_code, default_apply_tax, default_tax_inclusive FROM tbl_user WHERE user_id=1`,
    { type: QueryTypes.SELECT });
  console.log('BEFORE:', before[0]);
  await s.query(
    `UPDATE tbl_user
       SET merchant_vat_id = NULL,
           merchant_country_code = NULL,
           default_apply_tax = false,
           default_tax_inclusive = false,
           "updatedAt" = NOW()
     WHERE user_id = 1 AND merchant_vat_id = 'DE999888777'`);
  const after = await s.query(
    `SELECT merchant_vat_id, merchant_country_code, default_apply_tax, default_tax_inclusive FROM tbl_user WHERE user_id=1`,
    { type: QueryTypes.SELECT });
  console.log('AFTER :', after[0]);
  await s.close();
})();
