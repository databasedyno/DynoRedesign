import createCache from "@emotion/cache";
import type { EmotionCache } from "@emotion/cache";

/**
 * Shared emotion cache for MUI. `prepend: true` ensures MUI styles are
 * injected first so app/global styles can override them. Used on both the
 * server (per request, in _document) and the client (singleton, in _app).
 */
export const createEmotionCache = (): EmotionCache =>
  createCache({ key: "mui", prepend: true });

export default createEmotionCache;
