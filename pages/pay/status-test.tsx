/**
 * TEMPORARY harness — renders the exported CheckoutStatusTimeline across all
 * states (waiting / detected / underpaid / confirmed) so the new checkout
 * status UI can be verified without touching a live payment. Delete after.
 */
import React from 'react'
import { CheckoutStatusTimeline } from '@/Components/Page/Pay3Components/CleanCheckoutV2'

const tt = (k: string, o?: { defaultValue?: string }) => (o && o.defaultValue) || k

const STATES = [
  { title: 'Waiting (no tx yet)', phase: 'awaiting_payment', detected: false },
  { title: 'Detected / confirming', phase: 'awaiting_payment', detected: true },
  { title: 'Underpaid', phase: 'underpaid', detected: true },
  { title: 'Confirmed', phase: 'confirmed', detected: true },
]

export default function StatusTest() {
  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontFamily: 'sans-serif' }}>
      {[false, true].map((isDark) => (
        <div key={String(isDark)} style={{ background: isDark ? '#0F0F10' : '#ffffff', color: isDark ? '#fff' : '#111', padding: 16, borderRadius: 12, border: '1px solid #8883' }}>
          <h3>{isDark ? 'DARK' : 'LIGHT'}</h3>
          {STATES.map((s) => (
            <div key={s.title} data-testid={`state-${s.phase}-${s.detected}`} style={{ maxWidth: 440, marginBottom: 20, borderBottom: '1px dashed #8884', paddingBottom: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{s.title}</div>
              <CheckoutStatusTimeline phase={s.phase} detected={s.detected} timerLabel="04:59" isDark={isDark} t={tt} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
