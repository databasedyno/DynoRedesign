/**
 * Brand / dashboard display currencies (Session 39). Lives in its own
 * dependency-free module so BOTH utils/currencyUtils.ts and
 * helper/currencyConvert.ts can import it without a circular import
 * (currencyUtils already imports currencyConvert).
 *
 * The background FX cache pre-fetches USD→X for every entry here, so adding a
 * display currency automatically keeps its rate warm (audit F5, 2026-06).
 */
export const SUPPORTED_DISPLAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];
