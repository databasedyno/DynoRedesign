/** Mirror of backend/helper/brandName.ts — spots auto-generated brand names ("handle_529785728b" / e-mail local part). */
const GENERATED_SUFFIX_RE = /^[a-z0-9][a-z0-9._-]*_[0-9a-f]{6,12}$/i;

export const isPlaceholderBrandName = (
  name?: string | null,
  emails: Array<string | null | undefined> = [],
): boolean => {
  const v = String(name || "").trim();
  if (!v) return true;
  if (GENERATED_SUFFIX_RE.test(v)) return true;
  const lower = v.toLowerCase();
  return emails.some((e) => {
    const lp = String(e || "").split("@")[0].trim().toLowerCase();
    return !!lp && lp === lower;
  });
};
