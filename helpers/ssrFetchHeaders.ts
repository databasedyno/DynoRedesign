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
