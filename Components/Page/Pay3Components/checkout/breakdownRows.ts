/**
 * Row builders for the checkout price breakdown ("you pay / merchant receives /
 * Dynopay fee"). Pure functions — no React, no network — so the three surfaces
 * (fiat header, exact-crypto card, success receipt) render identical semantics.
 */
import type { BreakdownRow } from './PriceBreakdown'
import type { CryptoSplit } from './checkoutTypes'
import { formatCryptoAmount } from './checkoutHelpers'
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
  /** Network-fee buffer in fiat (customer-pays only; rides with the merchant share) */
  networkFeeFiat: number
  feeIsEstimate: boolean
  /** What the customer pays in fiat (base + tax [+ Dynopay fee + network fee when customer pays]) */
  totalFiat: number
  split: CryptoSplit | null
}

/** Fiat value of a crypto part, proportional to the customer's total (display-only, marked ≈). */
const fiatOf = (totalFiat: number, split: CryptoSplit, part: number): number =>
  split.customer > 0 ? toNumber((totalFiat * part) / split.customer, 2) : 0

const feeNote = (t: Tr, feePayerIsCustomer: boolean) =>
  feePayerIsCustomer
    ? t('checkout.feePaidByCustomer', { defaultValue: 'added to your total' })
    : t('checkout.feePaidByMerchant', { defaultValue: 'paid by the merchant' })

const withEst = (t: Tr, label: string, est: boolean) =>
  est ? `${label} (${t('checkout.estimated', { defaultValue: 'est.' })})` : label

export const buildFiatRows = (i: FiatBreakdownInput): BreakdownRow[] => {
  const { t, fmtFiat, split } = i
  const exact = !!split
  const feeFiat = exact ? fiatOf(i.totalFiat, split, split.fee) : i.feeFiat
  const merchantFiat = i.feePayerIsCustomer
    ? toNumber(i.baseAmt + i.taxAmt, 2)
    : exact
      ? fiatOf(i.totalFiat, split, split.merchant)
      : toNumber(i.baseAmt + i.taxAmt - i.feeFiat, 2)
  const est = !exact && (i.feeIsEstimate || !i.feePayerIsCustomer)
  const feeLabel = withEst(t, t('checkout.dynopayFee', { defaultValue: 'Dynopay fee' }), est)
  const rows: BreakdownRow[] = [
    { key: 'base', label: t('checkout.amount', { defaultValue: 'Amount' }), value: fmtFiat(i.baseAmt), testId: 'clean-checkout-breakdown-base' },
  ]
  if (i.taxAmt > 0) {
    rows.push({ key: 'tax', label: t('checkout.tax', { defaultValue: 'Tax' }), value: `+${fmtFiat(i.taxAmt)}`, testId: 'clean-checkout-breakdown-tax' })
  }
  if (i.feePayerIsCustomer) {
    rows.push({ key: 'fee', label: feeLabel, note: feeNote(t, true), value: `+${fmtFiat(feeFiat)}`, testId: 'clean-checkout-breakdown-fee' })
    if (i.networkFeeFiat > 0) {
      rows.push({
        key: 'network',
        label: withEst(t, t('checkout.networkFee', { defaultValue: 'Network fee' }), est),
        note: feeNote(t, true),
        value: `+${fmtFiat(i.networkFeeFiat)}`,
        testId: 'clean-checkout-breakdown-network',
      })
    }
  }
  rows.push({
    key: 'total',
    label: t('checkout.totalYouPay', { defaultValue: 'Total you pay' }),
    value: fmtFiat(i.totalFiat),
    emphasis: true,
    dividerBefore: true,
    testId: 'clean-checkout-amount',
  })
  rows.push({
    key: 'merchant',
    label: withEst(t, t('checkout.merchantReceives', { defaultValue: 'Merchant receives' }), est && !i.feePayerIsCustomer),
    note: i.feePayerIsCustomer && i.networkFeeFiat > 0 ? t('checkout.plusNetworkCover', { defaultValue: '+ network fee cover' }) : undefined,
    value: fmtFiat(merchantFiat),
    testId: 'clean-checkout-breakdown-merchant',
  })
  if (!i.feePayerIsCustomer) {
    rows.push({ key: 'fee', label: feeLabel, note: feeNote(t, false), value: fmtFiat(feeFiat), testId: 'clean-checkout-breakdown-fee' })
  }
  return rows
}

export type CryptoBreakdownInput = {
  t: Tr
  fmtFiat: (n: number) => string
  split: CryptoSplit
  code: string
  totalFiat: number
  /** Network-fee buffer in fiat (customer-pays) — flagged on the merchant row */
  networkFeeFiat?: number
}

/** Exact crypto split shown next to the amount to send (after address reservation). */
export const buildCryptoRows = ({ t, fmtFiat, split, code, totalFiat, networkFeeFiat = 0 }: CryptoBreakdownInput): BreakdownRow[] => [
  {
    key: 'merchant',
    label: t('checkout.merchantReceives', { defaultValue: 'Merchant receives' }),
    note: split.feePayer === 'customer' && networkFeeFiat > 0 ? t('checkout.inclNetworkCover', { defaultValue: 'incl. network fee cover' }) : undefined,
    value: `${formatCryptoAmount(split.merchant, code)} ${code}`,
    sub: `≈ ${fmtFiat(fiatOf(totalFiat, split, split.merchant))}`,
    testId: 'clean-checkout-crypto-merchant',
  },
  {
    key: 'fee',
    label: t('checkout.dynopayFee', { defaultValue: 'Dynopay fee' }),
    note: feeNote(t, split.feePayer === 'customer'),
    value: `${formatCryptoAmount(split.fee, code)} ${code}`,
    sub: `≈ ${fmtFiat(fiatOf(totalFiat, split, split.fee))}`,
    testId: 'clean-checkout-crypto-fee',
  },
]

export type SuccessBreakdownInput = {
  t: Tr
  fmtFiat: (n: number) => string
  code: string
  paidCrypto: number
  paidFiat: number
  merchant: number
  fee: number
  feePayer: 'customer' | 'company'
  networkFeeFiat?: number
}

/** Settled figures on the paid card — "you paid / merchant receives / Dynopay fee". */
export const buildSuccessRows = ({ t, fmtFiat, code, paidCrypto, paidFiat, merchant, fee, feePayer, networkFeeFiat = 0 }: SuccessBreakdownInput): BreakdownRow[] => {
  const split: CryptoSplit = { customer: paidCrypto, merchant, fee, feePayer }
  return [
    {
      key: 'paid',
      label: t('checkout.youPaid', { defaultValue: 'You paid' }),
      value: `${formatCryptoAmount(paidCrypto, code)} ${code}`,
      sub: fmtFiat(paidFiat),
      emphasis: true,
      testId: 'clean-checkout-success-paid',
    },
    {
      key: 'merchant',
      label: t('checkout.merchantReceives', { defaultValue: 'Merchant receives' }),
      note: feePayer === 'customer' && networkFeeFiat > 0 ? t('checkout.inclNetworkCover', { defaultValue: 'incl. network fee cover' }) : undefined,
      value: `${formatCryptoAmount(merchant, code)} ${code}`,
      sub: `≈ ${fmtFiat(fiatOf(paidFiat, split, merchant))}`,
      testId: 'clean-checkout-success-merchant',
    },
    {
      key: 'fee',
      label: t('checkout.dynopayFee', { defaultValue: 'Dynopay fee' }),
      note: feeNote(t, feePayer === 'customer'),
      value: `${formatCryptoAmount(fee, code)} ${code}`,
      sub: `≈ ${fmtFiat(fiatOf(paidFiat, split, fee))}`,
      testId: 'clean-checkout-success-fee',
    },
  ]
}
