/**
 * Row builders for the checkout order summary. Stripe-style: Amount [+ Tax]
 * [+ Processing fee, only when the buyer pays it] → Total. The merchant share
 * and who absorbs the Dynopay fee are never shown to the buyer.
 */
import type { BreakdownRow } from './PriceBreakdown'
import type { CryptoSplit } from './checkoutTypes'
import { toNumber } from '@/utils/money'

type Tr = (key: string, opts: { defaultValue: string }) => string

export type FiatBreakdownInput = {
  t: Tr
  fmtFiat: (n: number) => string
  baseAmt: number
  taxAmt: number
  feePayerIsCustomer: boolean
  /** Dynopay (tier) fee in fiat — exact after the rate lock, estimated before */
  feeFiat: number
  /** Network-fee buffer in fiat (customer-pays only) */
  networkFeeFiat: number
  feeIsEstimate: boolean
  /** What the customer pays in fiat (base + tax [+ processing fee when customer pays]) */
  totalFiat: number
  split: CryptoSplit | null
  /** Reserved coin code — when set with `split`, the fee row also shows the exact crypto amount */
  code?: string | null
}

/** Fiat value of a crypto part, proportional to the customer's total (display-only, marked ≈). */
const fiatOf = (totalFiat: number, split: CryptoSplit, part: number): number =>
  split.customer > 0 ? toNumber((totalFiat * part) / split.customer, 2) : 0

const withEst = (t: Tr, label: string, est: boolean) =>
  est ? `${label} (${t('checkout.estimated', { defaultValue: 'est.' })})` : label

/** Has anything to itemise beyond the bare amount (tax or a buyer-paid fee)? */
export const hasBreakdownRows = (i: Pick<FiatBreakdownInput, 'taxAmt' | 'feePayerIsCustomer'>): boolean =>
  i.taxAmt > 0 || i.feePayerIsCustomer

export const buildFiatRows = (i: FiatBreakdownInput): BreakdownRow[] => {
  const { t, fmtFiat, split } = i
  const exact = !!split
  const est = !exact && i.feeIsEstimate
  const rows: BreakdownRow[] = [
    { key: 'base', label: t('checkout.amount', { defaultValue: 'Amount' }), value: fmtFiat(i.baseAmt), testId: 'clean-checkout-breakdown-base' },
  ]
  if (i.taxAmt > 0) {
    rows.push({ key: 'tax', label: t('checkout.tax', { defaultValue: 'Tax' }), value: `+${fmtFiat(i.taxAmt)}`, testId: 'clean-checkout-breakdown-tax' })
  }
  if (i.feePayerIsCustomer) {
    // One line for everything the buyer pays on top (Dynopay fee + network buffer).
    const feeFiat = toNumber((exact ? fiatOf(i.totalFiat, split, split.fee) : i.feeFiat) + i.networkFeeFiat, 2)
    rows.push({
      key: 'fee',
      label: withEst(t, t('checkout.processingFee', { defaultValue: 'Processing fee' }), est),
      value: `+${fmtFiat(feeFiat)}`,
      testId: 'clean-checkout-breakdown-fee',
    })
  }
  rows.push({
    key: 'total',
    label: t('checkout.totalYouPay', { defaultValue: 'Total you pay' }),
    value: fmtFiat(i.totalFiat),
    emphasis: true,
    dividerBefore: true,
    testId: 'clean-checkout-amount',
  })
  return rows
}
