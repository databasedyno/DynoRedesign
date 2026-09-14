import { companyModel, userModel } from "../models";

export interface ResolvedTaxSettings {
  default_apply_tax: boolean;
  default_tax_inclusive: boolean;
  merchant_country_code: string | null;
  merchant_vat_id: string | null;
  source: "company" | "account";
  company_id: number | null;
}

/**
 * Per-Company Tax (2026-08-23). Resolution:
 *   company.tax_configured = true → the company's own values are authoritative
 *   (a NULL VAT then really means "no VAT ID" for that entity);
 *   otherwise → inherit the legacy account-level values on tbl_user.
 * `companyId` null/invalid falls back to the merchant's primary company.
 */
export async function resolveTaxSettings(
  userId: number,
  companyId?: number | null
): Promise<ResolvedTaxSettings> {
  const TAX_ATTRS = [
    "company_id", "tax_configured",
    "default_apply_tax", "default_tax_inclusive",
    "merchant_country_code", "merchant_vat_id",
  ];
  let company: { dataValues: Record<string, unknown> } | null = null;
  const cid = Number(companyId);
  if (Number.isFinite(cid)) {
    company = (await companyModel.findOne({
      where: { company_id: cid, user_id: userId },
      attributes: TAX_ATTRS,
    })) as typeof company;
  }
  if (!company) {
    company = (await companyModel.findOne({
      where: { user_id: userId },
      attributes: TAX_ATTRS,
      order: [["company_id", "ASC"]],
    })) as typeof company;
  }
  const c = (company?.dataValues || {}) as Record<string, unknown>;
  const resolvedCompanyId = company ? Number(c.company_id) : null;

  if (company && c.tax_configured) {
    return {
      default_apply_tax: !!c.default_apply_tax,
      default_tax_inclusive: !!c.default_tax_inclusive,
      merchant_country_code: c.merchant_country_code
        ? String(c.merchant_country_code).toUpperCase()
        : null,
      merchant_vat_id: (c.merchant_vat_id as string) || null,
      source: "company",
      company_id: resolvedCompanyId,
    };
  }

  const user = (await userModel.findByPk(userId, {
    attributes: [
      "default_apply_tax", "default_tax_inclusive",
      "merchant_country_code", "merchant_vat_id",
    ],
  })) as { dataValues: Record<string, unknown> } | null;
  const u = (user?.dataValues || {}) as Record<string, unknown>;
  return {
    default_apply_tax: !!u.default_apply_tax,
    default_tax_inclusive: !!u.default_tax_inclusive,
    merchant_country_code: u.merchant_country_code
      ? String(u.merchant_country_code).toUpperCase()
      : null,
    merchant_vat_id: (u.merchant_vat_id as string) || null,
    source: "account",
    company_id: resolvedCompanyId,
  };
}
