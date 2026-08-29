# Landing / Fees — Feature Gap Analysis & Recommendations (2026-06)

## A. What the product ACTUALLY does (evidence from code)

### Fee models
- **Dual fee payer** — per link/checkout choice: merchant absorbs ("I pay") OR customer pays the fee on top ("Customer pays" / "Donor pays"). (CreatePaymentLink index.tsx L1889; DonationSettingsSection L613-614 company/customer.)
- **Volume tiers** — 1.5% (Starter) → 1.0% (Growth) → 0.7% (Scale) → 0.5% (Enterprise). (.env VOLUME_TIER_*.)
- **Fixed component** — + $1 per successful payment.
- **First payment fee-free** — platform fee waived on first payment.
- **No monthly / no setup / no chargebacks.**
- Underpayment/overpayment handling + grace period + dust tolerance (webhookProcessor).

### Integration methods (the app has 9; landing shows 2)
1. Payment Links — shareable, buyer needs no account.
2. Hosted Checkout (CleanCheckoutV2) — drop-in.
3. REST API / Charges (API keys).
4. Buy Buttons — embeddable (API/BuyButtonsSection).
5. Publishable keys / Embeddable Elements (API/PublishableKeysSection).
6. Storefront / Shop — product catalog (digital / physical / service), variants, cart, VAT.
7. Creator tip pages (@handle).
8. Donation / Fundraiser campaigns (contribution links, goals).
9. Invoices — with VAT / EU reverse-charge, PDF receipts.

### Money features
- Auto-conversion to stablecoin — KEEP original coin OR auto-convert to USDC/USDT (merchant's choice), Binance-backed, savings-protection tracking, weekly digest.
- Crypto Payouts — balances, on-chain settlement to merchant-controlled wallet, pending tracker, CSV exports (custom range, settled-only).
- Crypto Refunds — per-chain, merchant-entered address, receipt emails. (Rare in crypto PSPs — strong trust signal.)
- Multi-chain — 15 coins & tokens across 9 chains (BTC, ETH, LTC, DOGE, BCH, SOL, TRON, XRP, Polygon) + stablecoins USDT (ERC20/TRC20/Polygon), USDC, RLUSD.
- Webhooks — signed (HMAC), opt-in events, retries, DLQ, webhook console.
- Notifications — buyer email receipts + browser notify.
- Referrals — give 50% / get 50%.
- Customers — directory + "request payment" prefill.
- Tax/VAT — EU reverse-charge, tax reporting.
- Compliance — KYC (Veriff), AML, GDPR, non-custodial (Google KMS).
- i18n — localized buyer journey in 6 languages.

## B. What the site says TODAY
- Landing sections: Hero → 3-step HowItWorks → 4 audience doors (Merchants/Fundraisers/Creators/Developers) → **only 3 product cards (Checkout / Auto-convert / API)** → stats band (1.5% · 9 chains · 0 chargebacks · 24/7) + 4 compliance badges → docs/learn/fees → FAQ → final CTA.
- Nav mega DOES link: Payment Links, Checkout, Creator Pages, Crypto Payouts, Docs, API, Webhooks, Fees, Status (but no landing surface explains them).
- Fees page: tiers, calculator, comparison table, +$1, non-custodial/KYC/GDPR.

## C. The gaps (features the landing/fees are SILENT on)
- Dual fee payer (business vs customer pays) — nowhere, despite being a core differentiator.
- 7 of 9 integration methods (Payment Links, Buy Buttons, Elements/embed, Storefront/Shop, Invoices, Donations, Payouts) — not on the landing.
- Refunds — not surfaced at all (big trust gap).
- Stablecoins / coin list — "9 chains" only; no coin/stablecoin showcase.
- Auto-convert depth (keep-or-convert choice, savings) — one shallow card.
- Tax/VAT, Customers, Referrals, Receipts/notifications, i18n — silent.

## D. Recommendations (proposed)
1. **Landing: "Ways to get paid" band** — grid of the 9 integration methods (icon + one-liner + link), replacing/augmenting the 3-card ProductFeatureCards. (Coinbase/Stripe "products" pattern.)
2. **Landing: "You choose who pays the fee" mini-section** — visual toggle (You pay 1.5% vs Customer pays, you keep 100%). Unique differentiator.
3. **Landing: Stablecoin/coin marquee** — logos of the 15 coins + "keep it or auto-convert to USDC/USDT".
4. **Landing: Refunds + trust row** — "Yes, you can refund crypto" + non-custodial + signed webhooks.
5. **Fees page additions:** (a) "Who pays the fee?" explainer with both math examples; (b) "What's included free" list (payouts, refunds, webhooks, storefront, invoices, auto-convert, 6 languages, no monthly).
6. **IA:** turn the 4 audience doors into a richer "Solutions" surface (e-commerce, SaaS, digital downloads, freelancers, remittance, gaming already exist as SEO verticals).

## E. Suggested build order (await user pick)
- P0: "Ways to get paid" integration band + "Who pays the fee" section (landing) — highest clarity gain.
- P0: Fees page "Who pays the fee" + "Everything included" — directly requested ("this includes fee pages").
- P1: Stablecoin/coin showcase; Refunds/trust row.
- P2: Expand Solutions/verticals surface.
All frontend-only, i18n across 6 locales, no money-path change.
