# DynoPay UI/UX Audit — 2026-06 (read-only, no code changed)

> STATUS UPDATE (same session, later): ALL P1 + P2 issues below were FIXED and
> verified by testing agent (test_reports/iteration_51.json + iteration_52.json,
> 14/14 PASS). Exception: P2 #12 (API docs base URL) was verified CORRECT as-is
> (merchant endpoints genuinely live under /api/user) — no change made.

Method: live screenshot review of 27 surfaces — desktop 1920, tablet 1024 & 768, mobile 390; dark + light in-app modes; logged in as hostbay (LIVE prod DB, view-only). Rated against modern fintech/payment-gateway UX principles (Stripe/Coinbase-class benchmarks): usability, visual design, copy clarity, consistency, responsiveness.

## OVERALL: 8.4 / 10 — polished, distinctive, production-grade; held back by consistency nits, not by design quality.

## Scores per page (Usability / Visual / Copy / Consistency → avg)
| Surface | U | V | C | Cons | Avg |
|---|---|---|---|---|---|
| Fees (marketing) | 9 | 9.5 | 10 | 9 | **9.3** |
| Referrals | 9 | 9 | 9.5 | 9 | **9.1** |
| Checkout /pay (desktop+mobile) | 9.5 | 9 | 8.5 | 9 | **9.1** |
| Register (persona picker) | 9.5 | 8.5 | 9 | 8 | **8.9** |
| Dashboard (dark+light) | 9 | 9 | 8.5 | 8.5 | **8.9** |
| Wallets | 9 | 9 | 9 | 8.5 | **8.9** |
| Landing / | 9 | 9 | 9 | 8 | **8.8** |
| Blog | 8.5 | 8.5 | 9 | 9 | **8.7** |
| Login | 9 | 8.5 | 9 | 8 | **8.6** |
| Transactions | 9 | 9 | 8.5 | 7.5 | **8.5** |
| Notifications | 8.5 | 8.5 | 8 | 9 | **8.5** |
| API Documentation | 8.5 | 9 | 8.5 | 8 | **8.5** |
| Invoices (Receipts & Tax) | 8.5 | 8 | 8.5 | 8.5 | **8.4** |
| Public creator page /hostbay | 8.5 | 8 | 9 | 8 | **8.4** |
| Create Payment Link | 8.5 | 8 | 8.5 | 8 | **8.3** |
| Storefront hub | 8.5 | 8.5 | 8.5 | 7.5 | **8.3** |
| Settings | 8.5 | 8 | 8 | 8.5 | **8.3** |
| Shop /hostbay/shop | 8.5 | 8.5 | 8.5 | 7.5 | **8.3** |
| API Keys / Developers | 8.5 | 7.5 | 8.5 | 8 | **8.1** |
| About | 8 | 8.5 | 8.5 | 7 | **8.0** |
| Help & Support | 8 | 7.5 | 8.5 | 8 | **8.0** |
| Terms / legal | 8 | 8 | 8.5 | 8 | **8.0** |
| /for/[vertical] SEO pages | 8 | 8 | 8 | 7 | **7.7** |
| System status | 8.5 | 7 | 8.5 | 7 | **7.7** |
| Payment Links list | 7.5 | 8 | 7.5 | 7 | **7.5** |
| Customers | 7 | 8 | 6.5 | 8 | **7.4** |

Responsiveness: mobile 390 = 9/10 (bottom tab bar, card lists, sticky checkout action bar are excellent). Tablet 768 = 8/10. Tablet 1024 = 6.5/10 (weakest breakpoint).

## STRENGTHS (keep)
- Cohesive indigo Aurora brand, first-class dark mode, mono tabular figures for all money values.
- Checkout is best-in-class: WAITING banner with plain-language microcopy, network/coin selectors, QR, mobile sticky "SEND EXACTLY … / Open in wallet app" bar.
- Marketing copy: "One number to remember. 1.5% → 0.5% as you grow." (fees) and hero "Get paid in crypto. Every way you sell." are excellent.
- Onboarding: register persona picker, quick-actions spotlight, fee-tier progress, referral card.

## ISSUES — P1 (fix first)
1. **Trust-stat contradictions**: landing "$42M+ settled" vs login/register "$24M+ processed"; About "8+ blockchains" vs footer/fees "15+ chains". Credibility risk on a payments product.
2. **Date-format chaos**: Transactions `13.08.2026` (DD.MM) vs Payment Links `08.13.2026` (MM.DD) vs API Keys `18.04.2026` (DD.MM). Ambiguous dates in financial records. Standardize (ideally locale-aware or `13 Aug 2026`).
3. **Payment Links table clipping**: Actions column icons cut off at 1920px; no horizontal scroll affordance.
4. **Tablet 1024 truncation**: Transactions table hides Date & Status columns with no scroll hint + large dead space below; phone-style bottom nav on a 1024 canvas.
5. **Serif font fallback** on page subtitles (e.g. "Overview of your cryptocurrency payment activity") and system-status headings — brand font not applied, reads unpolished.
6. **Domain mismatch**: hero claims `dynopay.me/@handle`, /for/creators says `dynopay.com/@handle`.

## ISSUES — P2
7. Checkout fallback title "Pay Merchant" (use company name) + "INVOICE · INV-2026-171" jargon on a payment link.
8. Customers page: 24 rows of "Recovered Customer / No customer details provided / $0.00 / 0 txns" — jargon + zero-value data; needs friendly fallback naming and an explainer.
9. "Account Setting" → "Account Settings"; sidebar "Checkout page" vs page H1 "Storefront" label mismatch.
10. Pay-links "No description" repeated — use em dash or auto-title.
11. API Keys page: broken-looking stretched gray logo blob in the API Documentation card; field label "API" vague.
12. API docs Base URL shows `https://dynopay.com/api/user` (odd base; should be `/api`).
13. Mobile create-pay-link: floating "Preview" pill overlaps bottom-nav labels.
14. Notification cards duplicate title as a chip ("Payment Received" twice per card).
15. Avatar color differs between /hostbay (teal) and /hostbay/shop (mustard).
16. Landing mid-scroll: large empty beige band between sections.
17. Settings: disabled inputs are gray-on-gray (low contrast); right column mostly empty at 1920.
18. Public creator/shop pages carry the full marketing header (Products/Developers/Start free) — competes with the creator's own brand; consider minimal chrome.

## Accessibility notes
- Micro uppercase labels (~10-11px) borderline for readability.
- Status pills use color+text (good). Disabled form fields fail contrast in dark mode.
- Checkout EUR formatting "€10,00" correctly localized.

## Ops note (not a product bug)
- One transient 502 on /transactions during audit — Next dev-server on-demand compile in preview; retried fine.
