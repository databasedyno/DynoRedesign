import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const isServer = typeof window === "undefined";
const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es", "de", "nl"];
const DEFAULT_LANGUAGE = "en";

// Timezone → language mapping for fallback detection
const TIMEZONE_TO_LANG = {
  "America/Sao_Paulo": "pt", "America/Fortaleza": "pt", "America/Recife": "pt",
  "America/Bahia": "pt", "America/Belem": "pt", "America/Manaus": "pt",
  "Europe/Lisbon": "pt",
  "Europe/Madrid": "es", "America/Mexico_City": "es", "America/Bogota": "es",
  "America/Lima": "es", "America/Santiago": "es", "America/Argentina/Buenos_Aires": "es",
  "America/Caracas": "es", "America/Guatemala": "es", "America/Guayaquil": "es",
  "Europe/Paris": "fr", "Africa/Dakar": "fr", "Africa/Abidjan": "fr",
  "Africa/Douala": "fr", "America/Port-au-Prince": "fr",
  "Europe/Berlin": "de", "Europe/Vienna": "de", "Europe/Zurich": "de",
  "Europe/Amsterdam": "nl", "Europe/Brussels": "nl",
};

/**
 * Detect language from browser locale and timezone (synchronous fallback)
 */
function detectFromBrowser() {
  try {
    const browserLang = (navigator.language || "").split("-")[0];
    if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_LANG[tz]) return TIMEZONE_TO_LANG[tz];
  } catch {}
  return DEFAULT_LANGUAGE;
}

function getInitialLanguage() {
  if (isServer) return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {}
  return detectFromBrowser();
}

/**
 * Async IP-based geolocation detection
 */
async function detectAndApplyGeoLocale() {
  if (isServer) return;
  try {
    const userChoseManually = localStorage.getItem("lang_manual") === "true";
    if (userChoseManually) return;

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/api/geo-detect`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status !== "success") return;

    const { getLocaleFromCountry } = await import("./utils/geoLocale");
    const detectedLang = getLocaleFromCountry(data.countryCode);

    if (detectedLang && SUPPORTED_LANGUAGES.includes(detectedLang) && detectedLang !== i18n.language) {
      await loadLanguageAsync(detectedLang);
      i18n.changeLanguage(detectedLang);
      localStorage.setItem("lang", detectedLang);
      console.log("[i18n] IP-based language detected →", detectedLang, `(${data.countryCode})`);
    }
  } catch (err) {
    console.log("[i18n] IP geo-detection skipped:", err?.message || err);
  }
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
    case "pt":
      ns.common = require("./langs/locales/pt/common.json");
      ns.auth = require("./langs/locales/pt/auth.json");
      ns.dashboardLayout = require("./langs/locales/pt/dashboardLayout.json");
      ns.profile = require("./langs/locales/pt/profile.json");
      ns.notifications = require("./langs/locales/pt/notifications.json");
      ns.apiScreen = require("./langs/locales/pt/apiScreen.json");
      ns.walletScreen = require("./langs/locales/pt/walletScreen.json");
      ns.companyDialog = require("./langs/locales/pt/companyDialog.json");
      ns.companySettings = require("./langs/locales/pt/companySettings.json");
      ns.transactions = require("./langs/locales/pt/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/pt/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/pt/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/pt/helpAndSupport.json");
      ns.landing = require("./langs/locales/pt/landing.json");
      ns.fees = require("./langs/locales/pt/fees.json");
      ns.apiStatus = require("./langs/locales/pt/apiStatus.json");
      ns.termsConditions = require("./langs/locales/pt/termsConditions.json");
      ns.privacyPolicy = require("./langs/locales/pt/privacyPolicy.json");
      ns.amlPolicy = require("./langs/locales/pt/amlPolicy.json");
      ns.referrals = require("./langs/locales/pt/referrals.json");
      ns.pageTitles = require("./langs/locales/pt/pageTitles.json");
      break;
    case "fr":
      ns.common = require("./langs/locales/fr/common.json");
      ns.auth = require("./langs/locales/fr/auth.json");
      ns.dashboardLayout = require("./langs/locales/fr/dashboardLayout.json");
      ns.profile = require("./langs/locales/fr/profile.json");
      ns.notifications = require("./langs/locales/fr/notifications.json");
      ns.apiScreen = require("./langs/locales/fr/apiScreen.json");
      ns.walletScreen = require("./langs/locales/fr/walletScreen.json");
      ns.companyDialog = require("./langs/locales/fr/companyDialog.json");
      ns.companySettings = require("./langs/locales/fr/companySettings.json");
      ns.transactions = require("./langs/locales/fr/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/fr/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/fr/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/fr/helpAndSupport.json");
      ns.landing = require("./langs/locales/fr/landing.json");
      ns.fees = require("./langs/locales/fr/fees.json");
      ns.apiStatus = require("./langs/locales/fr/apiStatus.json");
      ns.termsConditions = require("./langs/locales/fr/termsConditions.json");
      ns.privacyPolicy = require("./langs/locales/fr/privacyPolicy.json");
      ns.amlPolicy = require("./langs/locales/fr/amlPolicy.json");
      ns.referrals = require("./langs/locales/fr/referrals.json");
      ns.pageTitles = require("./langs/locales/fr/pageTitles.json");
      break;
    case "es":
      ns.common = require("./langs/locales/es/common.json");
      ns.auth = require("./langs/locales/es/auth.json");
      ns.dashboardLayout = require("./langs/locales/es/dashboardLayout.json");
      ns.profile = require("./langs/locales/es/profile.json");
      ns.notifications = require("./langs/locales/es/notifications.json");
      ns.apiScreen = require("./langs/locales/es/apiScreen.json");
      ns.walletScreen = require("./langs/locales/es/walletScreen.json");
      ns.companyDialog = require("./langs/locales/es/companyDialog.json");
      ns.companySettings = require("./langs/locales/es/companySettings.json");
      ns.transactions = require("./langs/locales/es/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/es/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/es/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/es/helpAndSupport.json");
      ns.landing = require("./langs/locales/es/landing.json");
      ns.fees = require("./langs/locales/es/fees.json");
      ns.apiStatus = require("./langs/locales/es/apiStatus.json");
      ns.termsConditions = require("./langs/locales/es/termsConditions.json");
      ns.privacyPolicy = require("./langs/locales/es/privacyPolicy.json");
      ns.amlPolicy = require("./langs/locales/es/amlPolicy.json");
      ns.referrals = require("./langs/locales/es/referrals.json");
      ns.pageTitles = require("./langs/locales/es/pageTitles.json");
      break;
    case "de":
      ns.common = require("./langs/locales/de/common.json");
      ns.auth = require("./langs/locales/de/auth.json");
      ns.dashboardLayout = require("./langs/locales/de/dashboardLayout.json");
      ns.profile = require("./langs/locales/de/profile.json");
      ns.notifications = require("./langs/locales/de/notifications.json");
      ns.apiScreen = require("./langs/locales/de/apiScreen.json");
      ns.walletScreen = require("./langs/locales/de/walletScreen.json");
      ns.companyDialog = require("./langs/locales/de/companyDialog.json");
      ns.companySettings = require("./langs/locales/de/companySettings.json");
      ns.transactions = require("./langs/locales/de/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/de/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/de/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/de/helpAndSupport.json");
      ns.landing = require("./langs/locales/de/landing.json");
      ns.fees = require("./langs/locales/de/fees.json");
      ns.apiStatus = require("./langs/locales/de/apiStatus.json");
      ns.termsConditions = require("./langs/locales/de/termsConditions.json");
      ns.amlPolicy = require("./langs/locales/de/amlPolicy.json");
      ns.privacyPolicy = require("./langs/locales/de/privacyPolicy.json");
      ns.referrals = require("./langs/locales/de/referrals.json");
      ns.pageTitles = require("./langs/locales/de/pageTitles.json");
      break;
    case "nl":
      ns.common = require("./langs/locales/nl/common.json");
      ns.auth = require("./langs/locales/nl/auth.json");
      ns.dashboardLayout = require("./langs/locales/nl/dashboardLayout.json");
      ns.profile = require("./langs/locales/nl/profile.json");
      ns.notifications = require("./langs/locales/nl/notifications.json");
      ns.apiScreen = require("./langs/locales/nl/apiScreen.json");
      ns.walletScreen = require("./langs/locales/nl/walletScreen.json");
      ns.companyDialog = require("./langs/locales/nl/companyDialog.json");
      ns.companySettings = require("./langs/locales/nl/companySettings.json");
      ns.transactions = require("./langs/locales/nl/transactions.json");
      ns.createPaymentLinkScreen = require("./langs/locales/nl/createPaymentLinkScreen.json");
      ns.paymentLinks = require("./langs/locales/nl/paymentLinks.json");
      ns.helpAndSupport = require("./langs/locales/nl/helpAndSupport.json");
      ns.landing = require("./langs/locales/nl/landing.json");
      ns.fees = require("./langs/locales/nl/fees.json");
      ns.apiStatus = require("./langs/locales/nl/apiStatus.json");
      ns.termsConditions = require("./langs/locales/nl/termsConditions.json");
      ns.amlPolicy = require("./langs/locales/nl/amlPolicy.json");
      ns.privacyPolicy = require("./langs/locales/nl/privacyPolicy.json");
      ns.referrals = require("./langs/locales/nl/referrals.json");
      ns.pageTitles = require("./langs/locales/nl/pageTitles.json");
      break;
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
//   updates immediately (and because we PRE-LOAD the detected language into
//   `initialResources` on the client, the switch is synchronous — no async
//   chunk load, no visible flash beyond the very first paint).
const clientDetectedLang = !isServer ? getInitialLanguage() : DEFAULT_LANGUAGE;
const initialLang = DEFAULT_LANGUAGE;

const initialResources = {};

// Always load English as the fallback language
initialResources.en = requireLanguage("en");
_loadedLanguages.add("en");

// On the CLIENT, also pre-load the detected language's resources so the
// post-hydration `changeLanguage(clientDetectedLang)` call is synchronous.
// On the server, we skip this because SSR only ever renders in English now.
if (
  !isServer &&
  clientDetectedLang !== "en" &&
  SUPPORTED_LANGUAGES.includes(clientDetectedLang)
) {
  initialResources[clientDetectedLang] = requireLanguage(clientDetectedLang);
  _loadedLanguages.add(clientDetectedLang);
}

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
 * Apply the user's detected language AFTER React hydration completes.
 * Call this from `_app.tsx` / `LanguageBootstrap` inside `useEffect`.
 *
 * Order of work (all runs POST-hydration so it cannot cause SSR mismatch):
 * 1. Switch i18n to `clientDetectedLang` (localStorage → browser locale →
 *    timezone). Resources for that language are already pre-loaded into
 *    the initial bundle (see i18n.init above) so this is synchronous.
 * 2. Kick off async IP-based geo-detection for first-time visitors whose
 *    browser locale didn't match their country.
 */
async function applyDetectedLanguage() {
  if (isServer) return;

  // Step 1 — sync switch to the client-detected language (was previously
  // done at module-load time, which caused a server/client hydration
  // mismatch because the server always used "en"). Moving it here keeps
  // the FIRST render in English on both sides, then switches immediately
  // after hydration.
  if (
    clientDetectedLang !== i18n.language &&
    SUPPORTED_LANGUAGES.includes(clientDetectedLang)
  ) {
    // Ensure resources for the detected language exist (they should — we
    // pre-loaded them above — but this is defensive).
    if (!_loadedLanguages.has(clientDetectedLang)) {
      await loadLanguageAsync(clientDetectedLang);
    }
    await i18n.changeLanguage(clientDetectedLang);
  }

  // Step 2 — async IP geo-detect (only when the user hasn't manually chosen).
  const userChoseManually = (() => {
    try { return localStorage.getItem("lang_manual") === "true"; } catch { return false; }
  })();

  if (!userChoseManually) {
    detectAndApplyGeoLocale();
  }
}

// Export the loader so language-switcher components can pre-load before changing
export { loadLanguageAsync, applyDetectedLanguage };
export default i18n;
