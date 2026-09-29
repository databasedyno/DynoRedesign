import type { IncomingMessage } from 'http'

/**
 * Headers for SSR self-fetches to the backend. Forwards the visitor's IP so the
 * backend rate-limits per visitor instead of bucketing every page view under
 * the Next.js server's loopback address.
 */
export const ssrFetchHeaders = (req: IncomingMessage): Record<string, string> => {
  const cf = req.headers['cf-connecting-ip']
  const xff = req.headers['x-forwarded-for']
  const first = Array.isArray(xff) ? xff[0] : xff?.split(',')[0]
  const ip = String((Array.isArray(cf) ? cf[0] : cf) || first || req.socket?.remoteAddress || '').trim()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (ip) headers['X-Forwarded-For'] = ip
  return headers
}

/**
 * Cheap pre-check for the /[handle] catch-all: creator handles are
 * /^[a-z0-9][a-z0-9_-]{2,29}$/ and payment codes are short base62, so any
 * segment with a dot, slash, or >40 chars can never resolve. Returning 404
 * before the SSR fetch stops secrets scanners (/.env, /config.json,
 * /wp-config.php.bak…) from costing backend round-trips.
 */
export const isPlausibleHandleSegment = (segment: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(String(segment || ''))
