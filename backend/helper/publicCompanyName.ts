import { userModel } from "../models";
import { isPlaceholderBrandName, publicBrandName } from "./brandName";

interface CompanyLike {
  company_name?: string | null;
  email?: string | null;
  user_id?: number | null;
  handle?: string | null;
}

/** Buyer-facing brand name: company_name unless it is a placeholder, then the owner's real name, then the handle. */
export const resolvePublicCompanyName = async (company: CompanyLike | null | undefined): Promise<string | null> => {
  if (!company) return null;
  const emails: Array<string | null | undefined> = [company.email];
  if (!isPlaceholderBrandName(company.company_name, emails)) return String(company.company_name).trim();
  if (company.user_id) {
    try {
      const u = (await userModel.findByPk(company.user_id, { attributes: ["name", "email"] })) as
        | { dataValues: { name?: string | null; email?: string | null } }
        | null;
      const name = publicBrandName([u?.dataValues?.name], [company.email, u?.dataValues?.email]);
      if (name) return name;
    } catch {
      /* fall through to the handle */
    }
  }
  return company.handle ? String(company.handle) : null;
};
