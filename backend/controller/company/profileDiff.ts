const PROFILE_FIELD_LABELS: Array<[string, string[]]> = [
  ["Brand Name", ["company_name"]],
  ["Contact Name", ["contact_first_name", "contact_last_name"]],
  ["Email Address", ["email"]],
  ["Phone Number", ["mobile"]],
  ["Website", ["website"]],
  ["Address", ["address_line1", "address_line2", "city", "state", "country", "zip_code"]],
  ["VAT/Tax ID", ["vat_number"]],
];

const norm = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const same = (a: unknown, b: unknown) => {
  const [x, y] = [norm(a), norm(b)];
  if (x === y) return true;
  const [nx, ny] = [Number(x), Number(y)];
  return x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
};

/** Human labels for the columns whose stored value really changed (plus the logo). */
export const diffCompanyFields = (
  before: Record<string, unknown> | null,
  data: Record<string, unknown>,
  photo?: string
): string[] => {
  const changedKeys = new Set(
    Object.keys(data).filter((k) => k !== "user_id" && !same(data[k], before?.[k]))
  );
  const labels: string[] = [];
  for (const [label, keys] of PROFILE_FIELD_LABELS) {
    if (keys.some((k) => changedKeys.has(k))) {
      labels.push(label);
      keys.forEach((k) => changedKeys.delete(k));
    }
  }
  if (changedKeys.size > 0) labels.push("Payment Settings");
  if (photo && photo !== norm(before?.photo)) labels.push("Brand Logo");
  return labels;
};
