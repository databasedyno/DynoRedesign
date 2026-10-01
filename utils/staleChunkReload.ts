/**
 * Stale-chunk recovery — shared by the global handler in pages/_app.tsx and by
 * every `next/dynamic` loading fallback (Components/UI/DynamicFallback.tsx).
 *
 * Why: after a deploy, a tab that is still running the OLD build asks for
 * /_next/static/chunks/<old-hash>.js, which no longer exists on the new
 * container (404) -> webpack throws a ChunkLoadError. `next/dynamic` CATCHES
 * that rejection and just re-renders its `loading` component with `error` set
 * (see next/dist/shared/lib/loadable.shared-runtime.js: "errors should be
 * handled within loading UIs") — so no `error` / `unhandledrejection` event
 * ever reaches the window and the panel spun forever (Settings -> Profile &
 * Security, 2026-10-01). Reloading once fetches fresh HTML for the new build.
 */

export const CHUNK_RELOAD_KEY = "dp_chunk_reload_at";

/** Window during which a second reload is refused (prevents reload loops). */
const RELOAD_GUARD_MS = 30_000;

const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const messageOf = (err: unknown): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "";
  const m = (err as { message?: unknown })?.message;
  return typeof m === "string" ? m : "";
};

/** True when `err` (an Error, a message string, or an error-like object) is a failed JS/CSS chunk load. */
export const isChunkLoadError = (err: unknown): boolean => {
  if (!err) return false;
  if ((err as { name?: unknown })?.name === "ChunkLoadError") return true;
  return CHUNK_ERROR_RE.test(messageOf(err));
};

/**
 * Hard-reloads the page ONCE so a stale tab picks up the current build.
 * Returns true when a reload was started, false when it was refused because
 * one already happened in the last 30s (the chunk is genuinely broken / the
 * network is down) or sessionStorage is unavailable (no loop guard -> never
 * auto-reload; the caller shows a manual "Reload page" button instead).
 */
export const reloadOnceForStaleChunk = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};
