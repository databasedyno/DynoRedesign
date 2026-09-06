/**
 * Public-checkout data client (Session refactor — "one data layer").
 *
 * The single seam for every network call the anonymous crypto checkout makes.
 * Always adds `Authorization: Bearer <token>` when supplied and NEVER reads
 * `localStorage.token` — so a merchant's session in another tab is never sent
 * to customer endpoints. Returns the parsed `{ message, data }` envelope.
 */
import axiosBaseApi from '@/axiosConfig'
import { API_ENDPOINTS } from '@/api/endpoints'

export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
}

/**
 * URL of the buyer-facing SSE status stream for a payment address.
 * EventSource cannot set headers, so the customer-session token rides in the
 * query string (the backend lifts it into Authorization).
 */
export function checkoutStreamUrl(address: string, token: string, destinationTag?: string | number | null): string {
  const q = new URLSearchParams({ address, token })
  if (destinationTag) q.set('destination_tag', String(destinationTag))
  return `${apiBase()}/api/pay/stream?${q.toString()}`
}

export interface CheckoutApiResult {
  ok: boolean
  status: number
  message?: string
  data?: any
}

export async function checkoutApi(
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<CheckoutApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(`${apiBase()}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, message: json?.message, data: json?.data }
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message || 'Network error' }
  }
}

/**
 * Fetch the server-generated PDF receipt as a Blob (POST /pay/receipt).
 * Returns the blob + suggested filename; throws on non-2xx so the caller can
 * surface an error state.
 */
export async function fetchReceiptBlob(
  address: string,
  token: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${apiBase()}/api/pay/receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ address }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const dispo = res.headers.get('Content-Disposition') || ''
  const nameMatch = dispo.match(/filename="?([^";]+)"?/)
  const filename = nameMatch?.[1] || `Dynopay_Receipt_${Date.now()}.pdf`
  return { blob, filename }
}

/**
 * Authenticated (merchant-session) transport for the LEGACY `cryptoTransfer`
 * checkout, which uses the app-wide axios instance (request interceptor +
 * localStorage token) — a DIFFERENT auth model from the fetch/Bearer client
 * above. These wrappers are literal pass-throughs: they return the raw
 * AxiosResponse and throw on non-2xx exactly like axios, so every call site's
 * `response.data?.data` and `catch (e) { e.response.status / .data.message }`
 * behaves identically. This keeps ALL checkout network calls in one module
 * without changing any auth model. Do NOT route the anonymous public surfaces
 * (they must never send a localStorage token) through payAxios.
 */
export const payAxios = {
  getConfiguredCurrencies: () => axiosBaseApi.get(API_ENDPOINTS.pay.configuredCurrencies),
  getCurrencyRates: (body: Record<string, unknown>) =>
    axiosBaseApi.post(API_ENDPOINTS.pay.getCurrencyRates, body),
  addPayment: (body: Record<string, unknown>) =>
    axiosBaseApi.post(API_ENDPOINTS.pay.addPayment, body),
  verifyCryptoPayment: (body: Record<string, unknown>) =>
    axiosBaseApi.post(API_ENDPOINTS.pay.verifyCryptoPayment, body),
}
