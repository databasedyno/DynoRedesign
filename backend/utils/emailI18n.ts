import fs from "fs";
import path from "path";
import sequelize from "./dbInstance";
import { QueryTypes } from "sequelize";

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

// Resolve the locales directory across BOTH runtimes:
//  - ts-node from source:           __dirname = backend/utils        -> ../locales    = backend/locales
//  - compiled (node dist/server.js): __dirname = backend/dist/utils  -> ../../locales = backend/locales
// Extra cwd-based fallbacks make this robust to however the process is launched.
// (Without this, the production `dist` build — which never bundles the JSON catalogs —
//  loaded an empty catalog and every t() fell through to returning the raw key.)
const LOCALE_DIR_CANDIDATES = [
  path.join(__dirname, "..", "locales"),
  path.join(__dirname, "..", "..", "locales"),
  path.join(process.cwd(), "locales"),
  path.join(process.cwd(), "backend", "locales"),
];

const loadCatalog = (lang: EmailLanguage): Record<string, unknown> => {
  if (catalogCache[lang]) return catalogCache[lang] as Record<string, unknown>;
  let parsed: Record<string, unknown> = {};
  for (const dir of LOCALE_DIR_CANDIDATES) {
    try {
      const file = path.join(dir, lang, "emails.json");
      const candidate = JSON.parse(fs.readFileSync(file, "utf8"));
      if (candidate && typeof candidate === "object" && Object.keys(candidate).length > 0) {
        parsed = candidate;
        break;
      }
    } catch {
      // catalog not at this location — try the next candidate
    }
  }
  // Only cache a successfully-loaded (non-empty) catalog, so a transient miss at
  // startup is never permanently cached as empty.
  if (Object.keys(parsed).length > 0) catalogCache[lang] = parsed;
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
 * Reduce a person's full name to their FIRST name only ("John Davis" -> "John").
 * Leaves empty strings and email-looking values untouched (callers greet those
 * with a generic fallback). Used to keep greetings personal + concise everywhere.
 */
export const firstNameOnly = (name?: string | null): string => {
  const clean = String(name ?? "").trim();
  if (!clean || clean.includes("@")) return clean;
  return clean.split(/\s+/)[0];
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
  // The greeting key (common.greeting — single source) always takes a person's
  // name — greet by FIRST name only, everywhere, without touching other keys
  // that reuse a {{name}} placeholder for non-person values (tiers, subjects).
  const effVars =
    vars && key.endsWith(".greeting") && typeof (vars as any).name === "string"
      ? { ...vars, name: firstNameOnly((vars as any).name as string) }
      : vars;
  return interpolate(value, effVars);
};

/** BCP-47 tag for Intl formatting per supported email language. */
const INTL_LOCALE: Record<EmailLanguage, string> = { en: "en-GB", pt: "pt-PT", es: "es-ES", fr: "fr-FR", de: "de-DE", nl: "nl-NL" };
export const intlLocaleFor = (lang?: string | null): string => INTL_LOCALE[normalizeLang(lang)];

/** "14 September 2026, 18:12 UTC" in the recipient's language (dates in emails are always UTC). */
export const formatEmailDateTime = (date: Date, lang?: string | null): string => {
  const s = new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(date);
  return `${s} UTC`;
};

/** "14:02 UTC" — time only, always UTC (emails never guess the reader's zone). */
export const formatEmailTime = (date: Date, lang?: string | null): string =>
  `${new Intl.DateTimeFormat(intlLocaleFor(lang), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date)} UTC`;

/** { date: "5 June 2026", time: "14:02 UTC" } — the one way callers build date/time pairs for emails. */
export const emailDateParts = (date: Date = new Date(), lang?: string | null): { date: string; time: string } =>
  ({ date: formatEmailDate(date, lang), time: formatEmailTime(date, lang) });

/** "19 September 2026" (date only, UTC) in the recipient's language. */
export const formatEmailDate = (date: Date, lang?: string | null): string =>
  new Intl.DateTimeFormat(intlLocaleFor(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);

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

// ── Merchant language resolution by recipient email (cached) ────────────────
// Merchant lifecycle emails (auth, wallet, KYC, payouts, etc.) are sent to a
// known Dynopay user. We resolve the recipient's stored language directly from
// their email so call sites don't each have to thread `lang` through. Customer
// emails still pass an explicit language (from the transaction/checkout).
const langByEmailCache = new Map<string, { lang: EmailLanguage; ts: number }>();
const LANG_CACHE_TTL_MS = 5 * 60 * 1000;

/** Look up a merchant user's stored language by email. Falls back to "en". Cached for 5 min. */
export const resolveLangByEmail = async (email?: string | null): Promise<EmailLanguage> => {
  if (!email) return DEFAULT_EMAIL_LANGUAGE;
  const key = String(email).trim().toLowerCase();
  if (!key) return DEFAULT_EMAIL_LANGUAGE;
  const cached = langByEmailCache.get(key);
  if (cached && Date.now() - cached.ts < LANG_CACHE_TTL_MS) return cached.lang;
  try {
    const rows = (await sequelize.query(
      "SELECT language FROM tbl_user WHERE LOWER(email) = :email LIMIT 1",
      { type: QueryTypes.SELECT, replacements: { email: key } }
    )) as Array<{ language?: string | null }>;
    const lang = normalizeLang(rows?.[0]?.language);
    langByEmailCache.set(key, { lang, ts: Date.now() });
    return lang;
  } catch {
    return DEFAULT_EMAIL_LANGUAGE;
  }
};

/**
 * Resolve the language for a merchant email: use the explicit `lang` if provided,
 * otherwise look it up from the recipient's stored language. Always returns a
 * supported code (defaults to "en").
 */
export const resolveEmailLang = async (
  lang?: string | null,
  email?: string | null
): Promise<EmailLanguage> => (asValidLang(lang) ? normalizeLang(lang) : resolveLangByEmail(email));

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
