// Customer checkout-session JWT (from POST /pay/getData). Kept OUT of
// `localStorage.token` so a buyer's session never masquerades as a merchant login.
export const CHECKOUT_TOKEN_KEY = "checkout_session_token";

const safe = <T,>(fn: () => T): T | undefined => {
  try {
    return typeof window === "undefined" ? undefined : fn();
  } catch {
    return undefined;
  }
};

export const getCheckoutToken = () => safe(() => localStorage.getItem(CHECKOUT_TOKEN_KEY)) ?? null;
export const setCheckoutToken = (token: string) => safe(() => localStorage.setItem(CHECKOUT_TOKEN_KEY, token));
export const clearCheckoutToken = () => safe(() => localStorage.removeItem(CHECKOUT_TOKEN_KEY));

export const isCheckoutSurface = (pathname: string) =>
  pathname === "/pay" || pathname.startsWith("/pay/") || pathname.startsWith("/payment");
