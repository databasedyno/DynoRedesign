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
