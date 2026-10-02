/** HTML-escape for text interpolated into email / admin HTML (null-safe). */
export const escapeHtml = (s: string | number | null | undefined): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/** Minimal escape (& < >) — Telegram HTML mode and SafeDeal/escrow email bodies. */
export const escapeBasic = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
