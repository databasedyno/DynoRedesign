/**
 * abortRegistry — tiny per-"family" AbortController registry so SWR fetchers can
 * cancel a stale in-flight request when a newer one supersedes it (e.g. the user
 * switches company or types a new amount, changing the SWR key).
 *
 * Usage inside a fetcher:
 *   const signal = nextSignal("wallet");
 *   await axios.get(url, { signal });
 *
 * Because SWR dedupes concurrent subscribers of the SAME key into a single
 * fetcher call, this only ever aborts a genuinely stale request from a PREVIOUS
 * key in the same family — never a duplicate mount.
 */

const registry = new Map<string, AbortController>();

/** Abort any prior in-flight request in `family` and return a fresh signal. */
export function nextSignal(family: string): AbortSignal {
  const prev = registry.get(family);
  if (prev) {
    try {
      prev.abort();
    } catch {
      /* ignore */
    }
  }
  const controller = new AbortController();
  registry.set(family, controller);
  return controller.signal;
}

/** True when an error is an axios/fetch cancellation (safe to ignore). */
export function isAbortError(err: any): boolean {
  return (
    err?.code === "ERR_CANCELED" ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.message === "canceled"
  );
}
