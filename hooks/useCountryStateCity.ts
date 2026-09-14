import { useEffect, useState } from "react";

/**
 * Lazily load the `country-state-city` dataset (it bundles a large static JSON).
 * Returns the module once loaded, `null` until then. The dynamic import moves the
 * dataset into its own async chunk so it never ships in a route's initial JS —
 * it only downloads when a component that actually needs it mounts.
 */
type CSCModule = typeof import("country-state-city");

let cached: CSCModule | null = null;

export function useCountryStateCity(): CSCModule | null {
  const [mod, setMod] = useState<CSCModule | null>(cached);
  useEffect(() => {
    if (cached) {
      setMod(cached);
      return;
    }
    let alive = true;
    void import("country-state-city").then((m) => {
      cached = m;
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

export default useCountryStateCity;
