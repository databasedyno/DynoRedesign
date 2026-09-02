/**
 * Server-side SEO meta localization for the public shop + product pages.
 *
 * The app's i18n is client-only (SSR always renders English), so crawler-visible
 * <Head> meta would always be English. This helper resolves a language from an
 * EXPLICIT signal only — a `?lang=` query param or the `dp_lang` cookie (written
 * by setAppLanguage when the visitor picks a language) — so localized search
 * snippets are produced without any Accept-Language/IP auto-detection (matching
 * the product's deliberate "explicit choice only" i18n policy).
 */
export const SEO_SUPPORTED = ["en", "es", "pt", "fr", "de", "nl"] as const;
export type SeoLang = (typeof SEO_SUPPORTED)[number];

interface ShopSeoStrings {
  shopSuffix: string;
  shopDesc: string; // {name}
  productDesc: string; // {title}
  verifiedPrefix: string; // prepended to social description when the merchant is KYC-verified
}

const STRINGS: Record<SeoLang, ShopSeoStrings> = {
  en: {
    shopSuffix: "Shop",
    shopDesc: "Support {name} — buy digital products, back campaigns, and tip in crypto. Direct to their wallet.",
    productDesc: "Buy {title} with crypto.",
    verifiedPrefix: "Verified merchant",
  },
  es: {
    shopSuffix: "Tienda",
    shopDesc: "Apoya a {name}: compra productos digitales, respalda campañas y deja propinas en cripto. Directo a su billetera.",
    productDesc: "Compra {title} con cripto.",
    verifiedPrefix: "Comercio verificado",
  },
  pt: {
    shopSuffix: "Loja",
    shopDesc: "Apoie {name} — compre produtos digitais, financie campanhas e deixe gorjetas em cripto. Direto para a carteira.",
    productDesc: "Compre {title} com cripto.",
    verifiedPrefix: "Comerciante verificado",
  },
  fr: {
    shopSuffix: "Boutique",
    shopDesc: "Soutenez {name} — achetez des produits numériques, financez des campagnes et laissez des pourboires en crypto. Directement sur son portefeuille.",
    productDesc: "Achetez {title} en crypto.",
    verifiedPrefix: "Marchand vérifié",
  },
  de: {
    shopSuffix: "Shop",
    shopDesc: "Unterstütze {name} — kaufe digitale Produkte, finanziere Kampagnen und gib Trinkgeld in Krypto. Direkt in die Wallet.",
    productDesc: "Kaufe {title} mit Krypto.",
    verifiedPrefix: "Verifizierter Händler",
  },
  nl: {
    shopSuffix: "Winkel",
    shopDesc: "Steun {name} — koop digitale producten, steun campagnes en geef fooien in crypto. Direct naar de wallet.",
    productDesc: "Koop {title} met crypto.",
    verifiedPrefix: "Geverifieerde verkoper",
  },
};

function normalize(raw: unknown): SeoLang | null {
  const base = String(raw ?? "").split("-")[0].toLowerCase();
  return (SEO_SUPPORTED as readonly string[]).includes(base) ? (base as SeoLang) : null;
}

function readCookie(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** Resolve the SEO language: `?lang=` query wins, then the `dp_lang` cookie, else en. */
export function resolveMetaLang(
  query: Record<string, unknown> | undefined,
  cookieHeader: string | undefined
): SeoLang {
  const q = query ? normalize((query as { lang?: unknown }).lang) : null;
  if (q) return q;
  const c = normalize(readCookie(cookieHeader, "dp_lang"));
  if (c) return c;
  return "en";
}

export function shopSeoStrings(lang: string): ShopSeoStrings {
  return STRINGS[(normalize(lang) || "en") as SeoLang];
}
