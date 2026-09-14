import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CheckoutStatusTimeline } from '@/Components/Page/Pay3Components/CleanCheckoutV2'

const t = (_k: string, o?: { defaultValue?: string }) => o?.defaultValue || _k

const render = (phase: string, detected: boolean) =>
  renderToStaticMarkup(
    <CheckoutStatusTimeline
      phase={phase}
      detected={detected}
      timerLabel="14:59"
      secondsRemaining={899}
      totalSeconds={900}
      isDark={false}
      t={t}
    />,
  )

const HUMAN = 'We can see your payment — waiting for network confirmations (usually 5–15 min).'

const cases: [string, string, boolean, boolean][] = [
  ['confirming (detected)', 'awaiting_payment', true, true],
  ['waiting (not detected)', 'awaiting_payment', false, false],
  ['confirmed', 'confirmed', true, false],
  ['underpaid', 'underpaid', true, false],
]

let fail = 0
for (const [name, phase, detected, expectHuman] of cases) {
  const html = render(phase, detected)
  const has = html.includes(HUMAN)
  const ok = has === expectHuman
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}: human line ${has ? 'present' : 'absent'} (expected ${expectHuman ? 'present' : 'absent'})`)
  if (name === 'confirming (detected)') {
    const checks = [
      ['status text', html.includes('Payment detected — confirming…')],
      ['testid human line', html.includes('checkout-human-confirming')],
      ['timeline steps', html.includes('Waiting') && html.includes('Detected') && html.includes('Confirmed')],
      ['countdown bar', html.includes('checkout-countdown-bar')],
    ] as const
    for (const [label, pass] of checks) {
      if (!pass) fail++
      console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${label}`)
    }
  }
}
process.exit(fail ? 1 : 0)
