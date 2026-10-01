# Onboarding UX analysis — all 4 tracks (2026-10-01, pod 31539451)
_Read-only review: code (Components/Page/GetStarted/*, Dashboard/v2026, FeeFree*, backend dashboardController + creator profile) + live screenshots with QA user 221 (brand 231, fresh) and the owner (brand 165, all done)._

## 1. Flow today
PurposePicker pill (merchant / fundraiser / creator / API dev, or skipped) → `/get-started`
→ 1 Secure (2FA) → 2 About you → 3 Where payouts go → 4 {payment link | API key | @handle | campaign} → 5 {share link | test payment | share page | share campaign}
→ Finish → merchants `/dashboard`, devs `/developer-keys`, creators `/storefront?tab=page`, fundraisers `/pay-links`
→ `/dashboard` stays in **Getting-started mode** (hero + 5-step list + faded preview of money/trend) while `!hasPayment`
→ first **settled, non-sandbox** transaction → full dashboard + one-time FirstPaymentCelebrationModal; sidebar ring disappears.

`hasPayment` (useSetupProgress) = stats.totalTransactions>0 || totalVolume>0 || any wallet amount_in_usd>0 || any settled recentTransaction. Source-agnostic (link, tip, donation, API, product) — backend excludes `environment='development'`.

## 2. Does every track reach the full dashboard after the first payment?
| Track | Step-4 artefact gated on payout wallet? | First payment counted? | Verdict |
|---|---|---|---|
| merchants | yes (inline wallet modal) | yes | ✅ |
| fundraisers | yes (same pattern) | yes (donation child txs) | ✅ |
| creators | **no** — handle can be claimed with 0 wallets, and `?step=link` is reachable with steps 2–3 undone | tips would count… | ❌ **dead end**: wizard never sets `support_widget_enabled` (DB default false) → the shared page has NO tip button (`creator-empty` state). "Your page is live — tips land in your wallet" is false until the creator finds Storefront → Support widget. |
| developers | n/a (sandbox) | **never** — sandbox txs are excluded by design | ⚠️ stays in Getting-started mode forever ("You're all set — go live when you're ready"); no way to see the full dashboard until a real payment. |

Other graduation inconsistencies:
* Dashboard2026 computes its own `hasPayment` (no `walletProcessed`) while sidebar ring/hero use useSetupProgress → can disagree.
* FirstRunRedirect checks only wallet/link/payment → creators (handle, no wallet) and devs (key, no wallet) are pushed to `/get-started` once per *session*, every session.

## 3. Findings (severity-ranked)
**P0**
- A. Creator dead end (above). Fix: on claim set `support_widget_enabled: true` (+ default presets 10/25/50, currency = brand currency) and gate step 4/5 on a payout wallet exactly like StepFirstCampaign ("Design now — goes live when you add the payout address"). Step-5 page copy stays true.
- B. Dashboard interruption stack: first `/dashboard` visit shows FeeFreeWelcomeModal ("You're in! … Create your first payment link") + FeeFreeBanner ("Start accepting payments →") + header "payout address setup" chip + hero + sidebar ring. Modal/banner CTAs push to `/create-pay-link` for ALL tracks (wrong vocabulary for creators/fundraisers/devs; bypasses the wizard). Fix: suppress modal+banner while Getting-started mode is on; put the fee-free promise inside the hero as a chip; CTA → `/get-started?step=link`.

**P1**
- C. GettingStartedHero copy branches only on developers: "Almost there — share your link", "Your link is out there", CTA "Share your link" for creators/fundraisers. Needs a track switch (page / campaign).
- D. Shared steps 1–3 use merchant vocabulary ("unlock payment links", "shown to customers at checkout") — light per-track variants for the payouts + about subtitles.
- E. "Ready but not paid" state (all 5 done): hero still owns the page with a faded, inert preview. Industry pattern (Stripe/Shopify): full dashboard with empty states + a collapsible "setup complete — waiting for first payment" strip. Also solves the developer forever-onboarding case.
- F. Reachability mismatch: rail/stepper lock steps beyond firstIncomplete, but `?step=` deep links only guard 2FA and the share artefact (confirmed: step 4 opened with 2–3 undone). Either allow forward peeking or guard the URL the same way (redirect to firstIncomplete).
- G. Primary CTA below the fold at 1920×800 on step 2 (About) and step 5 (Share) → sticky in-card footer on short viewports.
- H. FirstRunRedirect uses sessionStorage → zero-progress users get redirected every new session. Use a localStorage cooldown (e.g. 24 h) after "Do this later".

**P2**
- I. WizardShell title/subtitle generic ("Set up Dynopay / Five short steps") → per-track eyebrow e.g. "Getting started · Creator".
- J. Unify `hasPayment` (dashboard should consume useSetupProgress).
- K. Step 4 creator subtitle says "no other setup needed" — remove once A is fixed; the secondary "Open page editor" is an exit mid-wizard (acceptable, but label it "Open the full editor →" like fundraisers).
- L. Mobile 390: fine (no overflow; stepper + single column). Dark mode: verified by iteration_246.

## 4. Recommended target model (three brand states)
1. **Setting up** (doneCount < 5): wizard + dashboard hero (as today, minus the competing fee-free modal/banner/header chip).
2. **Ready — waiting for first payment** (5/5, no live payment): full interactive dashboard with empty states + compact strip "Setup complete · 1st payment is fee-free · Share again / Open page / Open Developers" + sidebar ring stays.
3. **Live** (first settled payment): celebration once, strip + ring disappear.
Per-track "ready": merchant/fundraiser/creator = artefact shared; developer = sandbox payment settled.

## 5. Status
Analysis only — nothing changed. Decide which of A–L to implement (A+B+C+E recommended first).
