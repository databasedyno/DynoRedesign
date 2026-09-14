/**
 * Pure checkout helpers — extracted from CleanCheckoutV2 (Session refactor).
 * No React, no side effects beyond the DOM clipboard/localStorage fallbacks.
 */
import type { PaymentUri } from './checkoutTypes'
import { toFixedStr } from '@/utils/money'

/** Format a crypto amount with reasonable precision per chain. */
export function formatCryptoAmount(amt: number, code: string): string {
  const precision =
    ['USDT', 'USDC', 'RLUSD', 'BUSD', 'DAI'].includes(code) ? 2
      : ['BTC', 'ETH', 'BCH', 'LTC'].includes(code) ? 8
      : 6
  return toFixedStr(amt, precision).replace(/\.?0+$/, '')
}

/**
 * Build a one-tap "open in wallet" payment URI (deep-link + QR encode).
 * ONLY native-coin chains (BIP-21 for BTC/LTC/DOGE/BCH, Solana Pay for SOL);
import { toFixedStr } from "@/utils/money";
 * token/EVM/TRON chains return null (their smallest-unit amount encoding is
 * error-prone and a wrong amount could cause an underpayment).
 */
export function buildPaymentUri(
  networkCode: string,
  address: string,
  amount: number,
  cryptoBase: string,
): PaymentUri {
  if (!address) return null
  const amt = formatCryptoAmount(amount, cryptoBase)
  switch ((networkCode || '').toUpperCase()) {
    case 'BTC':
      return { uri: `bitcoin:${address}?amount=${amt}` }
    case 'LTC':
      return { uri: `litecoin:${address}?amount=${amt}` }
    case 'DOGE':
      return { uri: `dogecoin:${address}?amount=${amt}` }
    case 'BCH':
      return { uri: `bitcoincash:${address.replace(/^bitcoincash:/i, '')}?amount=${amt}` }
    case 'SOL':
      return { uri: `solana:${address}?amount=${amt}` }
    default:
      return null
  }
}

/** Copy to clipboard with a legacy fallback for insecure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-999999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}

/** Per-device checkout preference reads/writes (SSR-safe). */
export const readCheckoutPref = (k: string): string => {
  try { return typeof window !== 'undefined' ? localStorage.getItem(k) || '' : '' } catch { return '' }
}
export const writeCheckoutPref = (k: string, v: string) => {
  try { if (typeof window !== 'undefined' && v) localStorage.setItem(k, v) } catch { /* ignore */ }
}
