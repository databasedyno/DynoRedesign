/* Feature flags decided by the SERVER at request time and shipped to the browser in
 * __NEXT_DATA__ (App.getInitialProps → props.runtimeFlags). Reading them through
 * getRuntimeFlags() on BOTH sides guarantees the SSR HTML and the hydrating client
 * agree. A build-time NEXT_PUBLIC_* inline (undefined in the browser bundle) vs the
 * droplet's runtime .env ("false") is exactly what produced React #418/#423 — the
 * whole page was thrown away and re-rendered client-side → blank landing page on
 * slow phones (2026-09). Env var NAMES are unchanged so ops config keeps working. */
export interface RuntimeFlags {
  showSocialLinks: boolean;
  cleanCheckoutV2: boolean;
  inlineTipCheckout: boolean;
  checkoutSwr: boolean;
  enableProductCatalog: boolean;
  enableCryptoRefunds: boolean;
}

const FLAG_ENV: { [K in keyof RuntimeFlags]: [env: string, dflt: boolean] } = {
  showSocialLinks: ["NEXT_PUBLIC_SHOW_SOCIAL_LINKS", true],
  cleanCheckoutV2: ["NEXT_PUBLIC_CLEAN_CHECKOUT_V2", true],
  inlineTipCheckout: ["NEXT_PUBLIC_INLINE_TIP_CHECKOUT", true],
  checkoutSwr: ["NEXT_PUBLIC_CHECKOUT_SWR", false],
  enableProductCatalog: ["NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG", true],
  enableCryptoRefunds: ["NEXT_PUBLIC_ENABLE_CRYPTO_REFUNDS", false],
};

const FLAG_KEYS = Object.keys(FLAG_ENV) as (keyof RuntimeFlags)[];

/** "true"/"false" (any case) win; anything else (unset, empty, typo) → the flag's default. */
export const parseFlag = (raw: string | undefined, dflt: boolean): boolean => {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "false") return false;
  if (v === "true") return true;
  return dflt;
};

const DEFAULTS = FLAG_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: FLAG_ENV[k][1] }),
  {} as RuntimeFlags,
);

/** Server only. Dynamic `process.env[name]` is never inlined by Next, so this always reflects the RUNTIME env. */
export const readServerFlags = (): RuntimeFlags => {
  const flags = FLAG_KEYS.reduce((acc, k) => {
    const [env, dflt] = FLAG_ENV[k];
    return { ...acc, [k]: parseFlag(process.env[env], dflt) };
  }, {} as RuntimeFlags);
  // Social links surface on TWO places (landing footer + transactional email). Historically the
  // landing read NEXT_PUBLIC_SHOW_SOCIAL_LINKS while the email read SHOW_SOCIAL_LINKS, so setting
  // only one env var hid just that one surface (2026-06 bug: email hidden, landing still showed).
  // Honour BOTH names here — either one set to "false" hides social everywhere.
  flags.showSocialLinks =
    parseFlag(process.env.NEXT_PUBLIC_SHOW_SOCIAL_LINKS, true) &&
    parseFlag(process.env.SHOW_SOCIAL_LINKS, true);
  return flags;
};

let clientFlags: RuntimeFlags | null = null;

const readClientFlags = (): RuntimeFlags => {
  const boot = (
    window as unknown as { __NEXT_DATA__?: { props?: { runtimeFlags?: Partial<RuntimeFlags> } } }
  ).__NEXT_DATA__?.props?.runtimeFlags;
  return { ...DEFAULTS, ...(boot || {}) };
};

/** Safe to call during render on either side; the client value is fixed for the page's lifetime. */
export const getRuntimeFlags = (): RuntimeFlags => {
  if (typeof window === "undefined") return readServerFlags();
  if (!clientFlags) clientFlags = readClientFlags();
  return clientFlags;
};
