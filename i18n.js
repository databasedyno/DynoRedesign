import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const isServer = typeof window === "undefined";
const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es", "de", "nl"];
const DEFAULT_LANGUAGE = "en";

function getInitialLanguage() {
  if (isServer) return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {}
  // English by default — no browser/timezone/IP auto-detection. A non-English
  // language is only ever applied because the user explicitly chose one (which
  // is what writes the localStorage "lang" key).
  return DEFAULT_LANGUAGE;
}

// ─── Namespace list (must match files under langs/locales/{lang}/) ───
const ALL_NAMESPACES = [
  "common", "auth", "dashboardLayout", "profile", "notifications",
  "apiScreen", "walletScreen", "companyDialog", "companySettings",
  "transactions", "createPaymentLinkScreen", "paymentLinks",
  "helpAndSupport", "landing", "fees", "apiStatus",
  "termsConditions", "privacyPolicy", "amlPolicy", "referrals", "pageTitles",
];

/**
 * Synchronously load a language's resources using require()
 * This is used ONLY for the initial language so we don't need a network round-trip.
 */
function requireLanguage(lang) {
  const ns = {};
  // Using individual requires so webpack can statically resolve them
  switch (lang) {
    case "en":
      ns.common = require("./langs/locales/en/common.json");
      ns.auth = require("./langs/locales/en/auth.json");
      ns.dashboardLayout = require("./langs/locales/en/dashboardLayout.json");
      ns.profile = require("./langs/locales/en/profile.json");
      ns.notifications = require("./langs/locales/en/notifications.json");
      ns.apiScreen = require("./langs/locales/en/apiScreen.json");
      ns.walletScreen = require("./langs/locales/en/walletScreen.json");
      ns.companyDialog = require("./langs/locales/en/companyDialog.json");
      ns.companySettings = require("./langs/locales/en/companySettings.json");
      ns.transactions = require("./langs/locales/en/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/en/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/en/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/en/helpAndSupport.json");
      ns.landing = require("./langs/locales/en/landing.json");
      ns.fees = require("./langs/locales/en/fees.json");
      ns.apiStatus = require("./langs/locales/en/apiStatus.json");
      ns.termsConditions = require("./langs/locales/en/termsConditions.json");
      ns.privacyPolicy = require("./langs/locales/en/privacyPolicy.json");
      ns.amlPolicy = require("./langs/locales/en/amlPolicy.json");
      ns.referrals = require("./langs/locales/en/referrals.json");
      ns.pageTitles = require("./langs/locales/en/pageTitles.json");
      break;
    // Non-English locales are intentionally NOT statically required here.
    // A static require() switch forced webpack to bundle ALL 6 locales
    // (~1.5 MB raw JSON) into _app for every visitor. Saved non-English
    // preferences now load through loadLanguageAsync() (per-locale async
    // chunks) inside applyDetectedLanguage() — see below.
    default:
      return requireLanguage("en");
  }
  return ns;
}

// ─── Lazy-load a language via dynamic import() → separate webpack chunk ───
const _loadedLanguages = new Set();

async function loadLanguageAsync(lang) {
  if (_loadedLanguages.has(lang)) return; // already loaded

  // Each language gets its own webpack chunk via import()
  let ns;
  switch (lang) {
    case "en": ns = requireLanguage("en"); break;
    case "pt": {
      const [common,auth,dashboardLayout,profile,notifications,apiScreen,walletScreen,companyDialog,companySettings,transactions,createPaymentLinkScreen,paymentLinks,helpAndSupport,landing,fees,apiStatus,termsConditions,privacyPolicy,amlPolicy,referrals,pageTitles] = await Promise.all([
        import("./langs/locales/pt/common.json"),import("./langs/locales/pt/auth.json"),import("./langs/locales/pt/dashboardLayout.json"),import("./langs/locales/pt/profile.json"),import("./langs/locales/pt/notifications.json"),import("./langs/locales/pt/apiScreen.json"),import("./langs/locales/pt/walletScreen.json"),import("./langs/locales/pt/companyDialog.json"),import("./langs/locales/pt/companySettings.json"),import("./langs/locales/pt/transactions.json"),import("./langs/locales/pt/createPaymentLinkScreen.json"),import("./langs/locales/pt/paymentLinks.json"),import("./langs/locales/pt/helpAndSupport.json"),import("./langs/locales/pt/landing.json"),import("./langs/locales/pt/fees.json"),import("./langs/locales/pt/apiStatus.json"),import("./langs/locales/pt/termsConditions.json"),import("./langs/locales/pt/privacyPolicy.json"),import("./langs/locales/pt/amlPolicy.json"),import("./langs/locales/pt/referrals.json"),import("./langs/locales/pt/pageTitles.json")
      ]);
      ns = {common:common.default||common,auth:auth.default||auth,dashboardLayout:dashboardLayout.default||dashboardLayout,profile:profile.default||profile,notifications:notifications.default||notifications,apiScreen:apiScreen.default||apiScreen,walletScreen:walletScreen.default||walletScreen,companyDialog:companyDialog.default||companyDialog,companySettings:companySettings.default||companySettings,transactions:transactions.default||transactions,createPaymentLinkScreen:createPaymentLinkScreen.default||createPaymentLinkScreen,paymentLinks:paymentLinks.default||paymentLinks,helpAndSupport:helpAndSupport.default||helpAndSupport,landing:landing.default||landing,fees:fees.default||fees,apiStatus:apiStatus.default||apiStatus,termsConditions:termsConditions.default||termsConditions,privacyPolicy:privacyPolicy.default||privacyPolicy,amlPolicy:amlPolicy.default||amlPolicy,referrals:referrals.default||referrals,pageTitles:pageTitles.default||pageTitles};
      break;
    }
    case "fr": {
      const [common,auth,dashboardLayout,profile,notifications,apiScreen,walletScreen,companyDialog,companySettings,transactions,createPaymentLinkScreen,paymentLinks,helpAndSupport,landing,fees,apiStatus,termsConditions,privacyPolicy,amlPolicy,referrals,pageTitles] = await Promise.all([
        import("./langs/locales/fr/common.json"),import("./langs/locales/fr/auth.json"),import("./langs/locales/fr/dashboardLayout.json"),import("./langs/locales/fr/profile.json"),import("./langs/locales/fr/notifications.json"),import("./langs/locales/fr/apiScreen.json"),import("./langs/locales/fr/walletScreen.json"),import("./langs/locales/fr/companyDialog.json"),import("./langs/locales/fr/companySettings.json"),import("./langs/locales/fr/transactions.json"),import("./langs/locales/fr/createPaymentLinkScreen.json"),import("./langs/locales/fr/paymentLinks.json"),import("./langs/locales/fr/helpAndSupport.json"),import("./langs/locales/fr/landing.json"),import("./langs/locales/fr/fees.json"),import("./langs/locales/fr/apiStatus.json"),import("./langs/locales/fr/termsConditions.json"),import("./langs/locales/fr/privacyPolicy.json"),import("./langs/locales/fr/amlPolicy.json"),import("./langs/locales/fr/referrals.json"),import("./langs/locales/fr/pageTitles.json")
      ]);
      ns = {common:common.default||common,auth:auth.default||auth,dashboardLayout:dashboardLayout.default||dashboardLayout,profile:profile.default||profile,notifications:notifications.default||notifications,apiScreen:apiScreen.default||apiScreen,walletScreen:walletScreen.default||walletScreen,companyDialog:companyDialog.default||companyDialog,companySettings:companySettings.default||companySettings,transactions:transactions.default||transactions,createPaymentLinkScreen:createPaymentLinkScreen.default||createPaymentLinkScreen,paymentLinks:paymentLinks.default||paymentLinks,helpAndSupport:helpAndSupport.default||helpAndSupport,landing:landing.default||landing,fees:fees.default||fees,apiStatus:apiStatus.default||apiStatus,termsConditions:termsConditions.default||termsConditions,privacyPolicy:privacyPolicy.default||privacyPolicy,amlPolicy:amlPolicy.default||amlPolicy,referrals:referrals.default||referrals,pageTitles:pageTitles.default||pageTitles};
      break;
    }
    case "es": {
      const [common,auth,dashboardLayout,profile,notifications,apiScreen,walletScreen,companyDialog,companySettings,transactions,createPaymentLinkScreen,paymentLinks,helpAndSupport,landing,fees,apiStatus,termsConditions,privacyPolicy,amlPolicy,referrals,pageTitles] = await Promise.all([
        import("./langs/locales/es/common.json"),import("./langs/locales/es/auth.json"),import("./langs/locales/es/dashboardLayout.json"),import("./langs/locales/es/profile.json"),import("./langs/locales/es/notifications.json"),import("./langs/locales/es/apiScreen.json"),import("./langs/locales/es/walletScreen.json"),import("./langs/locales/es/companyDialog.json"),import("./langs/locales/es/companySettings.json"),import("./langs/locales/es/transactions.json"),import("./langs/locales/es/createPaymentLinkScreen.json"),import("./langs/locales/es/paymentLinks.json"),import("./langs/locales/es/helpAndSupport.json"),import("./langs/locales/es/landing.json"),import("./langs/locales/es/fees.json"),import("./langs/locales/es/apiStatus.json"),import("./langs/locales/es/termsConditions.json"),import("./langs/locales/es/privacyPolicy.json"),import("./langs/locales/es/amlPolicy.json"),import("./langs/locales/es/referrals.json"),import("./langs/locales/es/pageTitles.json")
      ]);
      ns = {common:common.default||common,auth:auth.default||auth,dashboardLayout:dashboardLayout.default||dashboardLayout,profile:profile.default||profile,notifications:notifications.default||notifications,apiScreen:apiScreen.default||apiScreen,walletScreen:walletScreen.default||walletScreen,companyDialog:companyDialog.default||companyDialog,companySettings:companySettings.default||companySettings,transactions:transactions.default||transactions,createPaymentLinkScreen:createPaymentLinkScreen.default||createPaymentLinkScreen,paymentLinks:paymentLinks.default||paymentLinks,helpAndSupport:helpAndSupport.default||helpAndSupport,landing:landing.default||landing,fees:fees.default||fees,apiStatus:apiStatus.default||apiStatus,termsConditions:termsConditions.default||termsConditions,privacyPolicy:privacyPolicy.default||privacyPolicy,amlPolicy:amlPolicy.default||amlPolicy,referrals:referrals.default||referrals,pageTitles:pageTitles.default||pageTitles};
      break;
    }
    case "de": {
      const [common,auth,dashboardLayout,profile,notifications,apiScreen,walletScreen,companyDialog,companySettings,transactions,createPaymentLinkScreen,paymentLinks,helpAndSupport,landing,fees,apiStatus,termsConditions,privacyPolicy,amlPolicy,referrals,pageTitles] = await Promise.all([
        import("./langs/locales/de/common.json"),import("./langs/locales/de/auth.json"),import("./langs/locales/de/dashboardLayout.json"),import("./langs/locales/de/profile.json"),import("./langs/locales/de/notifications.json"),import("./langs/locales/de/apiScreen.json"),import("./langs/locales/de/walletScreen.json"),import("./langs/locales/de/companyDialog.json"),import("./langs/locales/de/companySettings.json"),import("./langs/locales/de/transactions.json"),import("./langs/locales/de/createPaymentLinkScreen.json"),import("./langs/locales/de/paymentLinks.json"),import("./langs/locales/de/helpAndSupport.json"),import("./langs/locales/de/landing.json"),import("./langs/locales/de/fees.json"),import("./langs/locales/de/apiStatus.json"),import("./langs/locales/de/termsConditions.json"),import("./langs/locales/de/privacyPolicy.json"),import("./langs/locales/de/amlPolicy.json"),import("./langs/locales/de/referrals.json"),import("./langs/locales/de/pageTitles.json")
      ]);
      ns = {common:common.default||common,auth:auth.default||auth,dashboardLayout:dashboardLayout.default||dashboardLayout,profile:profile.default||profile,notifications:notifications.default||notifications,apiScreen:apiScreen.default||apiScreen,walletScreen:walletScreen.default||walletScreen,companyDialog:companyDialog.default||companyDialog,companySettings:companySettings.default||companySettings,transactions:transactions.default||transactions,createPaymentLinkScreen:createPaymentLinkScreen.default||createPaymentLinkScreen,paymentLinks:paymentLinks.default||paymentLinks,helpAndSupport:helpAndSupport.default||helpAndSupport,landing:landing.default||landing,fees:fees.default||fees,apiStatus:apiStatus.default||apiStatus,termsConditions:termsConditions.default||termsConditions,privacyPolicy:privacyPolicy.default||privacyPolicy,amlPolicy:amlPolicy.default||amlPolicy,referrals:referrals.default||referrals,pageTitles:pageTitles.default||pageTitles};
      break;
    }
    case "nl": {
      const [common,auth,dashboardLayout,profile,notifications,apiScreen,walletScreen,companyDialog,companySettings,transactions,createPaymentLinkScreen,paymentLinks,helpAndSupport,landing,fees,apiStatus,termsConditions,privacyPolicy,amlPolicy,referrals,pageTitles] = await Promise.all([
        import("./langs/locales/nl/common.json"),import("./langs/locales/nl/auth.json"),import("./langs/locales/nl/dashboardLayout.json"),import("./langs/locales/nl/profile.json"),import("./langs/locales/nl/notifications.json"),import("./langs/locales/nl/apiScreen.json"),import("./langs/locales/nl/walletScreen.json"),import("./langs/locales/nl/companyDialog.json"),import("./langs/locales/nl/companySettings.json"),import("./langs/locales/nl/transactions.json"),import("./langs/locales/nl/createPaymentLinkScreen.json"),import("./langs/locales/nl/paymentLinks.json"),import("./langs/locales/nl/helpAndSupport.json"),import("./langs/locales/nl/landing.json"),import("./langs/locales/nl/fees.json"),import("./langs/locales/nl/apiStatus.json"),import("./langs/locales/nl/termsConditions.json"),import("./langs/locales/nl/privacyPolicy.json"),import("./langs/locales/nl/amlPolicy.json"),import("./langs/locales/nl/referrals.json"),import("./langs/locales/nl/pageTitles.json")
      ]);
      ns = {common:common.default||common,auth:auth.default||auth,dashboardLayout:dashboardLayout.default||dashboardLayout,profile:profile.default||profile,notifications:notifications.default||notifications,apiScreen:apiScreen.default||apiScreen,walletScreen:walletScreen.default||walletScreen,companyDialog:companyDialog.default||companyDialog,companySettings:companySettings.default||companySettings,transactions:transactions.default||transactions,createPaymentLinkScreen:createPaymentLinkScreen.default||createPaymentLinkScreen,paymentLinks:paymentLinks.default||paymentLinks,helpAndSupport:helpAndSupport.default||helpAndSupport,landing:landing.default||landing,fees:fees.default||fees,apiStatus:apiStatus.default||apiStatus,termsConditions:termsConditions.default||termsConditions,privacyPolicy:privacyPolicy.default||privacyPolicy,amlPolicy:amlPolicy.default||amlPolicy,referrals:referrals.default||referrals,pageTitles:pageTitles.default||pageTitles};
      break;
    }
    default: return;
  }

  // Register all namespaces with i18n
  for (const [nsKey, data] of Object.entries(ns)) {
    i18n.addResourceBundle(lang, nsKey, data, true, true);
  }
  _loadedLanguages.add(lang);
}

// ─── Detect initial language synchronously ───
// IMPORTANT: We MUST init i18n with the SAME language on server + client so
// React hydration doesn't mismatch (server rendered "Features" but client
// rendered "Recursos" → hydration error).
//
// - Server-side has no localStorage/navigator, so it always initialises with
//   DEFAULT_LANGUAGE ("en"). Ignoring that constraint caused the bug.
// - Client-side detection (localStorage → navigator → timezone) runs LATER,
//   after React has hydrated, inside `LanguageBootstrap` via
//   `applyDetectedLanguage()` below. i18n's `changeLanguage()` triggers a
//   re-render of every `useTranslation()` consumer, so the visible language
//   updates as soon as the locale's async chunk has loaded (first paint is
//   English, matching SSR — then swaps, same as using the language switcher).
// Captured at MODULE-LOAD time — i.e. BEFORE i18n.init() below. This matters:
// the LanguageDetector's localStorage cache and our own languageChanged
// listener both write "en" into localStorage DURING init, so reading
// localStorage any later cannot distinguish a genuine saved preference
// from that init side-effect.
const savedLangAtBoot = (() => {
  if (isServer) return null;
  try {
    const s = localStorage.getItem("lang");
    return s && SUPPORTED_LANGUAGES.includes(s) ? s : null;
  } catch { return null; }
})();
const clientDetectedLang = !isServer ? getInitialLanguage() : DEFAULT_LANGUAGE;
void clientDetectedLang; // detection still runs; resources load lazily in applyDetectedLanguage()
const initialLang = DEFAULT_LANGUAGE;

const initialResources = {};

// Always load English as the fallback language
initialResources.en = requireLanguage("en");
_loadedLanguages.add("en");

// On the CLIENT, a saved non-English preference is loaded as an async
// per-locale chunk inside applyDetectedLanguage() (post-hydration). The
// first paint is English (matching SSR), then swaps once the chunk lands —
// same UX as the language switcher, and it keeps ~1.25 MB of locale JSON
// out of the _app bundle for everyone.

const instance = i18n.use(LanguageDetector).use(initReactI18next);

instance.init({
  lng: initialLang, // Always DEFAULT_LANGUAGE ("en") to match SSR — see comment above.
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  debug: false,

  resources: initialResources,

  detection: {
    order: ["localStorage", "navigator"],
    lookupLocalStorage: "lang",
    caches: ["localStorage"],
    convertDetectedLanguage: (lng) => {
      const base = lng.split("-")[0];
      return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
    },
  },

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false,
  },
});

// ─── Runtime: lazy-load language on switch + persist ───
if (!isServer) {
  i18n.on("languageChanged", async (lng) => {
    console.log("[i18n] language changed →", lng);
    try { localStorage.setItem("lang", lng); } catch {}
    // Ensure language bundle is available
    if (!_loadedLanguages.has(lng)) {
      await loadLanguageAsync(lng);
    }
  });
}

/**
 * Apply the user's SAVED language after React hydration completes.
 * Called from `LanguageBootstrap` inside `useEffect`.
 *
 * English is the default. i18n initialises with "en" on BOTH server and client
 * (so SSR and the first client paint match — no hydration mismatch); once
 * hydrated we switch to the language the user previously CHOSE (persisted in
 * localStorage; its resources arrive as a lazy per-locale chunk right here).
 * There is NO browser/timezone/IP auto-detection: a non-English language only
 * appears because the user explicitly selected it.
 */
async function applyDetectedLanguage() {
  if (isServer) return;
  const savedLang = savedLangAtBoot;
  if (savedLang && savedLang !== i18n.language) {
    if (!_loadedLanguages.has(savedLang)) {
      await loadLanguageAsync(savedLang);
    }
    await i18n.changeLanguage(savedLang);
  }
}

// Export the loader so language-switcher components can pre-load before changing
export { loadLanguageAsync, applyDetectedLanguage };
export default i18n;
