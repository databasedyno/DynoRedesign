# Dynopay Copywriting Audit & Rewrite Log — 2026-06

User approved the full plan ("okay to all") with one constraint: **no real testimonials exist yet →
nothing fabricated.** Social proof = verifiable facts only.

## Voice standard (the "v3" voice — the target for ALL copy)
- Merchant-first, second person, present tense. Short sentences. Sentence case.
- Honest by default: no invented volume/user numbers, no speed claims the chain can't guarantee.
- Recurring proof points (safe to reuse anywhere): Non-custodial · from 0.5% · no chargebacks ·
  15+ networks · keep the coin or auto-convert to USDC/USDT · Encrypted · GDPR / KYC-AML.
- CTA system (unified this session):
  - **Primary section CTA:** "Start accepting payments" (localized = `v3.hero.primaryCta`)
  - **Compact/header CTA:** "Start free" (`getStarted` / `startFree`)
  - Killed variants: "Create your free account", "Start earning — free", "Get Started Fee-Free".

## Audit findings → what was done (Phase 1, executed 2026-06)

| # | Finding | Action |
|---|---------|--------|
| 1 | fees.json carried an entire DEAD legacy page voice (64 unused keys: heroTitle…feeFreeBanner*) contradicting the live v3 /fees page | Deleted the 64 dead keys from all 6 locales. Live keys kept: calculator labels, ffWelcome*, v3.* |
| 2 | Footer tagline "modern payment gateway for forward-thinking businesses" = generic slop, on every public page | Rewritten: "Crypto payments that settle straight to a wallet you control." + "Non-custodial. From 0.5%. No chargebacks." (6 locales) |
| 3 | Auth brand panel (login/register) still showed FABRICATED "1,000+ Businesses" and "<1min Settlements" (missed by the earlier honesty pass) | Replaced with factual tiles: **0 Chargebacks** ("crypto settles final"), **15+ Networks**, **24/7 Always on** (code + 6 auth.json locales) |
| 4 | Speed over-claims survived: `v3.features.convert.desc` "settle … in about four seconds", `v3.story.step2.body` "on-chain in seconds" + internal "Binance rates" leak, AudienceDoors creator stat "~4s" | Reworded to confirmation-based language ("the moment the payment confirms"), "Live market rates", creator stat → "Direct / payout to wallet" |
| 5 | CTA sprawl (5+ primary variants) | Unified per CTA system above: `createFreeAccount` key now = `v3.hero.primaryCta` (SEO pages + blog), fees `v3.calcCta` = primaryCta, about.tsx bottom CTA = "Start accepting payments" |
| 6 | Brand casing split: "DynoPay" vs "Dynopay" in user-facing strings | Standardized to **Dynopay** in locales (nav about title, share text, invoice metaTitle, dashboard eyebrow) + code (kyc/complete title, orders refund note, EmptyHero/VolumeHero, CleanCheckoutV2 share, CryptoRefundModal, QA page). **KEPT `X-DynoPay-*`** — real webhook header names (API contract, do not change) |
| 7 | Weak microcopy: blogSubtitle run-on, Help & Support description flat | Tightened in all 6 locales |
| 8 | **Zero social proof / testimonials** | NO fabrication (user confirmed none exist). Factual trust bands remain the proof layer. **Deferred:** a real-testimonial slot on landing + fees when quotes exist |

## Untouched on purpose
- v3 landing hero / how-it-works / numbers / FAQ — already the voice standard (prior tested pass).
- `X-DynoPay-*` headers in documentation.tsx + backend — API contract names.
- Styled-component identifiers / code comments with "DynoPay" — not user-facing.
- about.tsx remains hardcoded English (i18n gap logged, separate task). Copy itself is on-voice.
- Hardcoded English microcopy in ExitIntentModal / blog CTA body — decent copy, i18n gap only.

## Phase 2 candidates (not started)
- Real testimonials section (blocked on actual customer quotes).
- about.tsx + ExitIntentModal + blog CTA body → i18n keys (6 locales).
- Documentation page copy pass (dev tone audit).
- Email templates voice pass (backend/services/email/*) for consistency with v3 voice.

## Phase 2 — EXECUTED 2026-08 (pod 6fe4ee0c). User approved "all three ready items" (2a).

### 1. i18n migration (about.tsx + ExitIntentModal + blog CTA) — DONE
- `langs/locales/*/landing.json` +27 keys per locale (6 locales, parity check green):
  root `exitIntentEyebrow/Body/ClaimCta/Close`, `blogReadyCtaBody`, and full `about.*` block
  (metaTitle/metaDescription/eyebrow/heroTitle/heroBody/talkToUs/stats.*/values.*/buildTitle/
  buildBody/ctaTitle/ctaBody). Script: `scripts/i18n_add_phase2_copy.py` (idempotent).
- `pages/about.tsx`: all copy → t(); hero CTA reuses `startFree`; **bottom CTA unified**
  "Create your free account" (killed variant that survived Phase 1) → `v3.hero.primaryCta`.
- `Components/Modals/ExitIntentModal.tsx`: eyebrow/body/claim-CTA/close aria → t();
  Copy/Copied reuses `v3.tryit.copyBtn/copiedBtn`.
- `pages/blog/[slug].tsx`: CTA body → `blogReadyCtaBody`; button "Start Accepting Crypto"
  (Title Case, off-system) → `v3.hero.primaryCta`.
- Verified in browser: /about EN + DE fully translated (H1, stats, values, CTAs).

### 2. Documentation page copy pass (dev tone) — DONE (4 fixes; rest already factual)
- "Payments are instantly forwarded…" → "forwarded … as soon as they confirm on-chain" (Overview).
- Quick Integration box: "funds are forwarded instantly" → "funds forward … once the payment confirms".
- Getting Started step 2: dropped "!" + "instantly" → confirmation-based.
- Bottom CTA body: "Join merchants worldwide accepting crypto with Dynopay" (unverifiable scale
  implication) → "Non-custodial, from 0.5%, no chargebacks — create your API key and take your
  first payment."
- UNTOUCHED on purpose: `X-DynoPay-*` header names, verbatim API response samples
  ("Payment Created!" etc. — contract), section headings (Title Case = API-docs convention).

### 3. Email templates voice pass (backend) — DONE (46 fixes across 6 locales + 2 .ts)
- Script: `backend/scripts/email_voice_pass_phase2.py` (idempotent).
- Brand casing: last 2 user-facing "DynoPay" → "Dynopay" (`overpayment.merchantBody`,
  `payoutDigest.intro`) in all 6 `backend/locales/*/emails.json`.
- Puffery/speed claims rewritten in all 6 locales: `common.securedBy` "trusted" →
  "non-custodial"; `merchant.welcome.intro2` dropped "fast" → wallet-control fact;
  `companyContactWelcome.intro2` "easily and safely" → non-custodial fact; `.means2`
  "Fast and secure transactions" → "Funds settle straight to a wallet you control".
- EN-only sentence-case subjects: paymentConfirming, paymentPartialExpired ×2,
  customerPaymentConfirmation, profileUpdated ×2, walletOtp ("OTP for Wallet Address
  Validation" → "Confirm your wallet address" — matches the Confirm-your… family).
- Hardcoded .ts: conversionEmails "instantly converting" → "automatically converting";
  linkCampaignEmails ×2 "Instant notifications…" → "Notifications the moment a payment
  confirms, and a clean dashboard".
- Kept: security-notice "immediately" (urgency instruction, not a speed claim);
  `merchant.autoConversion.subject` Payout Complete casing left for the localized-subject
  sweep below.

## Phase 3 candidates (not started)
- Real testimonials section (still blocked on actual customer quotes).
- Non-EN email subject sweep (casing/tone per-language norms).
- Pre-existing locale-parity gap: de/es/fr/nl/pt emails.json miss EN key merchant.locked.suspendedLine.

## Phase 3 — PARTIALLY EXECUTED 2026-08-28 (pod 6fe4ee0c, same session as Phase 2)
- DONE Email i18n gaps: volumeTierUpgrade + referee reminder/invite emails fully keyed
  (backend/scripts/email_i18n_gap_fill.py, 42 keys x 6 locales; "Why Dynopay?" lists unified;
  subject bugs fixed: hardcoded "50%" and "3 days" now parameterized; sentence-case subjects/CTAs).
- DONE Blog index Head localized (blogIndex.* x 6 + pageTitles blog_*/press_* x 6).
- DONE /press press-kit page (press.* x 6, downloadable logos in public/press/, nav.mega.press entry).
- DONE Brand casing sweep on FRONTEND catalogs: "DynoPay" -> "Dynopay" (18 strings, incl. header nav
  "About DynoPay") + _app.tsx JSON-LD speed-claim fixes ("instantly"/"instant" -> direct/automatic).
