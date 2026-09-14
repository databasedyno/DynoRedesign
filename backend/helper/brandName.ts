/**
 * Brand display-name hygiene (UX audit A1).
 *
 * Account provisioning historically fell back to the e-mail local part
 * ("csvcleanroom_529785728b") for the brand name, and that string then leaked
 * onto every public surface (page title, H1, share text, receipts). These
 * helpers decide whether a stored name is such a placeholder and pick the best
 * public-safe alternative.
 */

/** local-part + "_" + 6–12 hex chars — the shape minted by throwaway e-mail providers. */
const GENERATED_SUFFIX_RE = /^[a-z0-9][a-z0-9._-]*_[0-9a-f]{6,12}$/i;

export const emailLocalPart = (email?: string | null): string =>
  String(email || "").split("@")[0].trim().toLowerCase();

/** True when `name` is empty, looks machine-generated, or simply equals one of the e-mails' local parts. */
export const isPlaceholderBrandName = (
  name?: string | null,
  emails: Array<string | null | undefined> = []
): boolean => {
  const v = String(name || "").trim();
  if (!v) return true;
  if (GENERATED_SUFFIX_RE.test(v)) return true;
  const lower = v.toLowerCase();
  return emails.some((e) => {
    const lp = emailLocalPart(e);
    return !!lp && lp === lower;
  });
};

/** First candidate that is a real, human-looking name — or null. */
export const publicBrandName = (
  candidates: Array<string | null | undefined>,
  emails: Array<string | null | undefined> = []
): string | null => {
  for (const c of candidates) {
    const v = String(c || "").trim();
    if (v && !isPlaceholderBrandName(v, emails)) return v;
  }
  return null;
};

/** "csvcleanroom_529785728b" → "Csvcleanroom", "ada.lovelace" → "Ada Lovelace". */
export const humanizeLocalPart = (localPart: string): string => {
  const stripped = String(localPart || "")
    .replace(/_[0-9a-f]{6,12}$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\d{4,}$/g, "")
    .trim();
  if (!stripped) return "";
  return stripped
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 80);
};
