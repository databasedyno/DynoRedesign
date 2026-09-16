# Email Redesign — Notification Matrix (sign-off pack, 2026-09)

Legend: ✅ exists & fires today · 🟡 partial / needs surfacing · ❌ not built (proposal)

| # | Event | Recipient | Exists today? | Sender / gap | Proposed |
|---|-------|-----------|---------------|--------------|----------|
| A | **Referral credit applied to a fee** (credit covered part of the Dynopay fee on a payment) | Merchant | 🟡 Partial | A line (`paymentReceived.referralCredit`) can render on the payment email, but it is a footnote — it is NOT a row in the "Where the money went" breakdown, so it is easy to miss. Controller computes `referralCreditAppliedUsd`. | Add a dedicated **"Referral credit −$X · fee covered"** row *inside* the money card on **Payment settled**, plus a one-line "You saved $X in fees with referral credit." Makes the benefit unmissable. |
| B | **Referral credit running low** (balance below a threshold) | Merchant | ❌ No | No sender exists. | New low-priority nudge: *"Your referral credit is running low — $X left"* with a Refer-a-friend CTA. (Digest-style, not per-payment, to avoid noise.) |
| C | **Referral credit exhausted** (balance hit $0, standard fees resume) | Merchant | ❌ No | No sender exists. | New: *"Your referral credit is used up — standard fees resume from your next payment"* + Refer-a-friend CTA. |
| D | **Credit earned from a referee** (someone you referred transacted, you earned credit) | Referrer (Merchant) | ✅ Yes | `sendReferralAccrualEmail` | Re-skin to the new crisp layout + friendly voice; lead with a hero **"+$X earned"** amount. |
| E | **Auto-convert started** (conversion kicked off, before payout lands) | Merchant | ❌ No | Only the payout-complete email exists. | **Recommend SKIP** for fast conversions (would double the emails). Optional: only send if a conversion is pending > N minutes. Your call. |
| F | **Auto-convert converted & forwarded in USD** (crypto → USDC/USDT paid out, with rate + USD value) | Merchant | ✅ Yes | `sendAutoConversionPayoutEmail` (redesigned in this pack) | Ship the redesign — now leads with the **payout amount** hero + shows conversion rate, USD value, fee breakdown, savings. |
| G | **Payout delayed** | Merchant | ✅ Yes | `sendPayoutDelayedEmail` | Apply new layout + friendly, reassuring voice ("We've hit a short delay — here's what's happening"). |

## Recommendation for sign-off
- **Ship now (redesign + voice):** D, F, G (all already fire — just re-skinned).
- **Fix the gap (small backend + template work):** A — surface referral credit as a real row in the money breakdown.
- **Build new (optional, your call):** B and C (credit low / exhausted). E is recommended to skip.

## i18n gap note (found during the pass)
The auto-conversion payout email contains **hardcoded English** strings ("Gross Conversion", "Platform Fee", "Received", "Payout", "Market State", "Date", "Sent to", "Broadcasting…", savings/volatility copy). These have **no i18n keys**, so German/Spanish/French/Dutch/Portuguese recipients see English. The full 6-language rollout will add keys for all of these (part of "ensure no existing gaps").
