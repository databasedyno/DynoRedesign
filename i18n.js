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
// Adding a language or namespace requires NO loader change: the template-literal
// require/import below make webpack bundle every langs/locales/**/*.json
// (context module), exactly as the previous hand-written per-language switch did.
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
  if (!SUPPORTED_LANGUAGES.includes(lang)) lang = DEFAULT_LANGUAGE;
  const ns = {};
  for (const n of ALL_NAMESPACES) {
    ns[n] = require(`./langs/locales/${lang}/${n}.json`);
  }
  return ns;
}

// ─── Lazy-load a language via dynamic import() → separate webpack chunks ───
const _loadedLanguages = new Set();

async function loadLanguageAsync(lang) {
  if (_loadedLanguages.has(lang)) return; // already loaded
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;

  const mods = await Promise.all(
    ALL_NAMESPACES.map((n) => import(`./langs/locales/${lang}/${n}.json`))
  );
  ALL_NAMESPACES.forEach((n, i) => {
    i18n.addResourceBundle(lang, n, mods[i].default || mods[i], true, true);
  });
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
 * Apply the user's SAVED language after React hydration completes.
 * Called from `LanguageBootstrap` inside `useEffect`.
 *
 * English is the default. i18n initialises with "en" on BOTH server and client
 * (so SSR and the first client paint match — no hydration mismatch); once
 * hydrated we switch to the language the user previously CHOSE (persisted in
 * localStorage, pre-loaded into the initial bundle so the switch is instant).
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
