import fs from "fs";
import path from "path";

/**
 * Email internationalization layer (Phase 1 foundation).
 *
 * - SUPPORTED_EMAIL_LANGUAGES: the canonical set of locales we localize emails into.
 * - normalizeLang: coerce any input ("de-DE", "PT", null) to a supported code, default "en".
 * - resolveMerchantLanguage / resolveCustomerLanguage: the fallback chains.
 * - t(key, lang, vars): catalog lookup with {{var}} interpolation and EN fallback.
 *
 * Catalogs live in backend/locales/{lang}/emails.json. The translation content is
 * filled in during Phase 2 — this layer is intentionally usable while catalogs are partial.
 */

export const SUPPORTED_EMAIL_LANGUAGES = ["en", "pt", "es", "fr", "de", "nl"] as const;
export type EmailLanguage = (typeof SUPPORTED_EMAIL_LANGUAGES)[number];
export const DEFAULT_EMAIL_LANGUAGE: EmailLanguage = "en";

const isSupported = (code: string): code is EmailLanguage =>
  (SUPPORTED_EMAIL_LANGUAGES as readonly string[]).includes(code);

/** Coerce any language hint to a supported code; falls back to "en". */
export const normalizeLang = (lang?: string | null): EmailLanguage => {
  if (!lang) return DEFAULT_EMAIL_LANGUAGE;
  const code = String(lang).trim().toLowerCase().split(/[-_]/)[0];
  return isSupported(code) ? code : DEFAULT_EMAIL_LANGUAGE;
};

/** Returns the supported code only if the input is explicitly a valid supported language, else null. */
const asValidLang = (lang?: string | null): EmailLanguage | null => {
  if (!lang) return null;
  const code = String(lang).trim().toLowerCase().split(/[-_]/)[0];
  return isSupported(code) ? code : null;
};

// ── Catalog loading (cached) ────────────────────────────────────────────────
const catalogCache: Partial<Record<EmailLanguage, Record<string, unknown>>> = {};

const loadCatalog = (lang: EmailLanguage): Record<string, unknown> => {
  if (catalogCache[lang]) return catalogCache[lang] as Record<string, unknown>;
  let parsed: Record<string, unknown> = {};
  try {
    const file = path.join(__dirname, "..", "locales", lang, "emails.json");
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    parsed = {};
  }
  catalogCache[lang] = parsed;
  return parsed;
};

const getByPath = (obj: Record<string, unknown>, keyPath: string): unknown =>
  keyPath.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);

const interpolate = (template: string, vars?: Record<string, unknown>): string => {
  if (!vars) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = getByPath(vars, key);
    return value === undefined || value === null ? "" : String(value);
  });
};

/**
 * Translate a key for a language with {{var}} interpolation.
 * Lookup order: requested language → English → the key itself (so missing keys are obvious).
 */
export const t = (key: string, lang?: string | null, vars?: Record<string, unknown>): string => {
  const language = normalizeLang(lang);
  let value = getByPath(loadCatalog(language), key);
  if (typeof value !== "string" && language !== DEFAULT_EMAIL_LANGUAGE) {
    value = getByPath(loadCatalog(DEFAULT_EMAIL_LANGUAGE), key);
  }
  if (typeof value !== "string") return key;
  return interpolate(value, vars);
};

// ── Resolvers ────────────────────────────────────────────────────────────────

/** Merchant emails use the language stored on their user row. */
export const resolveMerchantLanguage = (user?: { language?: string | null } | null): EmailLanguage =>
  normalizeLang(user?.language);

/**
 * Customer emails: transaction language → checkout-captured language → merchant language → "en".
 * Each candidate must be an explicitly valid supported code to be used.
 */
export const resolveCustomerLanguage = (opts: {
  transactionLang?: string | null;
  checkoutLang?: string | null;
  merchantLang?: string | null;
}): EmailLanguage => {
  for (const candidate of [opts.transactionLang, opts.checkoutLang, opts.merchantLang]) {
    const valid = asValidLang(candidate);
    if (valid) return valid;
  }
  return DEFAULT_EMAIL_LANGUAGE;
};

/** Read a language hint from a request body, falling back to the Accept-Language header. */
export const getRequestLanguage = (req: {
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): EmailLanguage => {
  const fromBody = req?.body?.language as string | undefined;
  if (asValidLang(fromBody)) return normalizeLang(fromBody);
  const header = (req?.headers?.["accept-language"] as string | undefined) || "";
  return normalizeLang(header.split(",")[0]);
};
