# DynoPay Tax System — Industry-Standard Assessment (2026)

**Type:** Product/engineering assessment · **Date:** 2026-09-14 · **Status:** Analysis only — no tax logic, settings, or checkout behaviour was changed.
**Not tax advice.** Reflects public 2026 guidance (IRS, EU/OECD, HMRC, national revenue bodies). Have tax counsel confirm before acting on anything here.

---

## 0. Executive summary

DynoPay already behaves like a competent **tax calculation & collection engine** for VAT/GST: destination-based standard rates for ~39 hard-coded countries (extended live via an APILayer cache), tax-inclusive/exclusive pricing, per-product categories, EU B2B reverse-charge, per-account / per-company / per-payment-link settings, tax on receipts, and full tax figures persisted on every order and settlement row for an audit trail. That is a real head start — most crypto processors collect **no** tax at all.

Measured against the 2026 standard for a calculation engine (Stripe Tax / Quaderno / TaxJar / Avalara class), the material gaps are:

- **US sales tax is not supported at all** (US is hard-coded to 0%). *(Critical)*
- **EU B2B reverse-charge relies on a regex format check, not live VIES verification** — auditors treat format-only as insufficient evidence for a 0% B2B sale. *(Critical)*
- **No economic-nexus / registration-threshold monitoring** (US *Wayfair* state thresholds, EU €10,000 pan-EU threshold, national GST thresholds). *(High)*
- **Only standard rates are applied** — reduced/zero rates and per-jurisdiction product taxability are ignored (a `reduced_rates` column is stored but never read). *(High)*
- **Single location signal** (IP, or shipping for goods) rather than the **two non-contradictory pieces of evidence with ~10-year retention** the EU requires for B2C digital sales. *(High)*
- **No buyer-side VAT/OSS reporting.** An invoice tax-report + CSV *does* exist, but it reports VAT on DynoPay's own **fee invoices** grouped by the **merchant's** country — not the destination VAT/GST the merchant **collected from buyers** (the figures an OSS/VAT return actually needs). *(High)*
- **No crypto cost-basis / capital-gains records** for merchants who hold rather than auto-convert, and **no 1099-DA / DAC8 / CARF posture** — even though 2026 US final regs explicitly name *digital-asset payment processors (PDAPs)* as brokers. *(Crypto-specific; part Critical for US)*

**Recommended posture:** stay a Tier-1 **calculation & collection engine** (DynoPay computes and collects, the merchant remits). Becoming a **Merchant of Record** (Paddle-style: DynoPay is the legal seller and files/remits) is a much larger legal/strategic move — noted as an option, out of scope here.

---

## 1. Scope & positioning

- **Benchmark bar = "tax calculation & collection engine."** DynoPay computes + collects; the merchant remits. This matches how the product already describes itself in code (`taxService.ts` header: *"Dynopay is a PAYMENT PROCESSOR — we compute + collect, merchant remits."*).
- **Merchant-of-Record (MoR)** is treated as a strategic option only, not the bar.
- **Jurisdictions benchmarked:** EU + UK, US sales tax, and the main GST regimes already in the rate table (AU, CA, NZ, SG, IN, plus CH/NO).
- **Crypto-specific tax section:** included (§5).
- **Out of scope:** any change to calculation/UI/checkout; becoming an MoR; actually filing/remitting; legal/accounting sign-off.

---

## 2. Current-state inventory (what the system does today)

### 2.1 Where the numbers come from
- **Rate resolution is cache-first** (`controller/payment/taxService.ts › calculateTax`, mirrored in `controller/taxController.ts › getTaxRate`):
  1. `tbl_tax_rate` (`models/taxRateModel.ts`) — a per-country cache row (`standard_rate`, `tax_acronym`, `country_name`, `reduced_rates` JSONB).
  2. If not cached and an API key is set → **APILayer `tax_data/tax_rates`** live lookup, then written back to the cache.
  3. Else → **`FALLBACK_TAX_RATES`** hard-coded map (`utils/taxData.ts`).
- **Hard-coded fallback coverage (~39 countries):** all 27 EU members, plus GB, CH (8.1%), NO, IS, LI, and RoW: **US = 0**, CA = 5, AU = 10, NZ = 15, JP = 10, SG = 9, IN = 18. `COUNTRY_NAMES`/`TAX_ID_ACRONYMS` list ~68 countries, so the live API can extend coverage beyond the fallback set.

### 2.2 Calculation logic (`controller/payment/taxService.ts`)
- `calculateTax({ countryCode, amount, currency, taxInclusive, taxCategory, merchantCountry, customerVatId })` handles, in order:
  - **`taxCategory === 'exempt'`** → 0%, `exempt_reason = 'product_exempt'`.
  - **EU B2B reverse-charge** → 0%, `reverse_charge = true`, `exempt_reason = 'eu_b2b_reverse_charge'`.
  - **Rate resolution** (cache → API → fallback), **standard rate only**.
  - **Tax-inclusive back-out** (`subtotal = gross / (1 + rate)`, exact-decimal via `utils/money`) vs **tax-exclusive** (tax added on top).
- Categories exist (`'digital' | 'physical' | 'service' | 'exempt'`) but only **exempt** changes the rate; digital/physical/service all get the **same standard rate**.
- `checkoutMath.ts` splits the crypto amount so `base + tax` reconcile exactly and tax always flows to the merchant (never into DynoPay's fee).

### 2.3 VAT-ID / reverse-charge
- **Checkout path is regex-only.** `validateVatId()` structurally checks the ID against `VAT_ID_REGEX` (27 EU + GB) and requires the prefix to differ from the merchant country; `shouldReverseCharge()` then requires both parties in `EU_COUNTRIES` and different countries. **No live VIES call is made in the checkout decision.**
- A **separate manual endpoint** `POST /api/tax/validate` (`taxController.validateTaxId`) *does* call APILayer's `/validate` (real lookup, returns `company_name`/`company_address`) — but it is **not wired into** the checkout reverse-charge decision.

### 2.4 Configuration model
- **Per-account defaults** on `tbl_user`: `default_apply_tax`, `default_tax_inclusive`, `merchant_country_code`, `merchant_vat_id`.
- **Per-company override** (`services/companyTaxService.ts › resolveTaxSettings`): if `company.tax_configured`, the company's own values are authoritative; else inherit the account.
- **Per-payment-link:** `tbl_payment_link.tax_inclusive` (UI: `Components/UI/pay-link/TaxSection.tsx`).
- **Per-product:** `tbl_product.tax_category` (+ `apply_tax_override`).
- Settings UI: `Components/UI/CompanySettingsDialog/CompanyDetailsSection.tsx` (company) and the pay-link Tax section.

### 2.5 Buyer-location detection
- `controller/payment/cryptoCheckout.ts` uses `getCountryFromIP(clientIP, headers)` with `cf-ipcountry` and a `getCountryFromTimezone` fallback (`utils/geolocation`). For **physical goods**, shipping-address country is preferred over IP. **One signal is used** — there is no second corroborating evidence and no long-term evidence archive.

### 2.6 Audit trail (a genuine strength)
- Migration `addTaxFields2026_07_16.ts` persists tax on both the order and the settlement:
  - `tbl_product_order`: `tax_rate`, `tax_label`, `tax_country_code`, `customer_vat_id`, `reverse_charge`, `tax_inclusive`.
  - `tbl_user_transaction`: `tax_amount`, `tax_rate`, `tax_label`, `tax_country_code`, `customer_vat_id`, `reverse_charge`.
- Tax appears on receipts/PDF (`services/email/orderEmails.ts`, `services/pdfService.ts`; regression `tests/test_iter66_tax_receipt_render.ts`).

### 2.7 Tax API surface
`GET /api/tax/rate/:countryCode` · `POST /api/tax/validate` · `GET /api/tax/acronyms` · `GET /api/tax/lookup?country=` (`routes/taxRouter.ts`, `controller/taxController.ts`).
There is **also** an invoice tax-report: `GET /api/invoices/tax-report` (+ `/csv`) in `controller/invoiceController.ts`. **Important:** it aggregates VAT on **DynoPay's own service-fee invoices** (`tbl_invoice`: `total_usd`, `vat_amount`, `vat_rate`) grouped **by the merchant's own country** — it does **not** report the destination VAT/GST the merchant **collected from buyers** at checkout. So it is a fee-invoice report, not a merchant VAT-return / OSS report (see G6).

### 2.8 What is NOT present today
No US sales tax, no reduced/zero-rate application, no live VIES in checkout, no nexus/threshold tracking, **no buyer-side (destination) collected-tax report for the merchant's VAT/OSS return** (only the fee-invoice tax-report of §2.7 exists), no address validation/rooftop sourcing, no marketplace-facilitator handling, and no crypto cost-basis / capital-gains / broker-reporting artefacts.

---

## 3. Benchmark — the two industry tiers + the statutory rules

### 3.1 The two recognised tiers
| | **Tier 1 — Calculation & collection engine** *(DynoPay's bar)* | **Tier 2 — Merchant of Record** |
|---|---|---|
| Examples | Stripe Tax, Quaderno, TaxJar, Avalara | Paddle, Lemon Squeezy, FastSpring |
| Who is the seller | The merchant | The platform (legal reseller) |
| Who files/remits | The merchant | The platform, everywhere |
| What the tool must do | Correct rate + taxability by jurisdiction & product, ID validation (VIES/ABN), **nexus/threshold monitoring + alerts**, evidence capture, **filing-ready reports/returns**, address validation | Everything in Tier 1 **plus** global registrations, returns, remittance, liability |

**What a Tier-1 engine is expected to do in 2026 that DynoPay does not yet:** apply reduced/zero rates and product taxability per jurisdiction; validate EU VAT IDs against **VIES** and AU ABNs against the ABR; monitor **economic-nexus/registration thresholds** and warn before the merchant must register; capture **≥2 pieces of location evidence** and retain them; and emit **filing-ready reports** (EU OSS return lines, per-US-state liability, per-country VAT summaries).

### 3.2 Statutory rules that matter
**EU VAT & OSS (B2C digital services).**
- Destination-based (tax at the customer's country rate). ✅ DynoPay is destination-based.
- **€10,000 pan-EU micro-threshold**: below it, a small EU seller may charge home-country VAT; above it, destination rates + OSS. ❌ Not tracked.
- **Two non-contradictory pieces of evidence** of customer location, retained **10 years**. ❌ One signal, no retention policy.
- **B2B reverse-charge requires a valid VAT number** — best practice/expectation is **VIES-verified** with proof stored. ⚠️ Regex only in checkout.
- **OSS single quarterly return** consolidates pan-EU B2C VAT. ❌ No OSS-ready output.

**UK VAT (post-Brexit).** 20% standard; **non-UK-established** sellers of digital services to UK consumers generally must register from the **first** sale (no threshold); UK-established threshold £90k; B2B reverse-charge applies. ⚠️ DynoPay applies GB 20% but does not model the nil-threshold registration trigger or UK-specific reduced/zero rates.

**US sales tax.** No federal sales tax; ~13,000 state+local jurisdictions; **destination sourcing** in most states; **economic nexus (*South Dakota v. Wayfair*)** thresholds per state (commonly **$100k or 200 transactions**, though many states have dropped the 200-transaction test); **product taxability varies** (SaaS/digital goods taxable in some states, exempt in others); **marketplace-facilitator** laws can shift liability to the platform. ❌ DynoPay treats US as 0% end-to-end.

**Main GST regimes (already in the rate table).**
- **AU** GST 10%, A$75k registration threshold, low-value imported goods rules.
- **NZ** GST 15% on remote services to consumers.
- **CA** federal GST 5% **plus** provincial PST/RST/QST (e.g., QST in Québec) — a **single national rate is insufficient**.
- **SG** GST 9% (raised 2024); overseas-vendor registration for digital services.
- **IN** GST 18% typical but multi-slab, GSTIN + place-of-supply + e-invoicing complexity.
⚠️ DynoPay applies one national rate per country; CA/IN in particular need sub-national logic.

---

## 4. Gap list (rated, with the compliance risk each creates)

### Critical
- **G1 — No US sales tax (US hard-coded to 0%).** Any US-nexus merchant selling through DynoPay **under-collects**; once a state threshold is crossed the merchant owes uncollected tax + penalties out of pocket, and DynoPay looks like the cause. *(taxData.ts `US: 0`.)*
- **G2 — Reverse-charge is format-only, not VIES-verified.** A 0% B2B sale backed by a structurally-valid-but-unverified VAT ID is routinely **disallowed on audit**; the merchant is then assessed the VAT that was never collected. *(taxService.ts `validateVatId` regex path.)*

### High
- **G3 — No economic-nexus / threshold monitoring or alerts.** Merchants blow past EU €10k, US *Wayfair*, UK nil-threshold, AU A$75k, etc. with no warning → late registration, back-tax, penalties. *(No tracker exists; the `$10,000` KYC threshold in `helper/kycEnforcement.ts` is AML, not tax.)*
- **G4 — Only standard rates; reduced/zero rates & product taxability ignored.** `reduced_rates` is fetched and stored (`taxController`, `taxRateModel`) but **never read** by `calculateTax`. E-books, food, kids' items, some services are **over-taxed**; some jurisdictions expect 0%. Category exists but only `exempt` alters the rate.
- **G5 — Single location signal, no 2-evidence capture/retention.** Fails the EU B2C digital-services evidence standard (two non-contradictory items, 10-year retention). Weakens defensibility of every EU B2C sale.
- **G6 — Reporting covers the wrong dataset for VAT returns.** An invoice tax-report + CSV exists (`invoiceController.getTaxReport` / `exportTaxReportCSV`), but it aggregates VAT on **DynoPay's fee invoices** grouped by the **merchant's own country** — not the destination VAT/GST the merchant **collected from buyers** at checkout (stored on `tbl_product_order` / `tbl_user_transaction`). So there is still **no OSS-return-ready, per-destination summary** of collected tax. Low-effort win: the buyer-side data is already stored (§2.6).

### Medium
- **G7 — B2B VAT-invoice completeness unverified.** Confirm issued documents meet full VAT-invoice requirements (sequential invoice number, both parties' VAT IDs, tax broken out per rate, reverse-charge legend). Receipts exist; formal VAT-invoice compliance should be validated.
- **G8 — No address validation / rooftop US sourcing.** US local rates need street-level (rooftop) resolution; IP/country alone can't produce a correct combined state+county+city+district rate.
- **G9 — Sub-national regimes flattened.** CA (GST+PST/QST) and IN (multi-slab/place-of-supply) are modelled as one national rate.
- **G10 — No marketplace-facilitator handling.** If DynoPay is ever deemed a marketplace facilitator in a US state or under EU deemed-supplier rules, collection/liability can shift to the platform — currently unmodelled.

### Low
- **G11 — Rate-table staleness / no versioning.** Hard-coded fallbacks drift when statutory rates change; there's no dated versioning or scheduled refresh/expiry of the `tbl_tax_rate` cache.
- **G12 — Order-level (not line-level) tax.** Fine for single-rate carts; mixed-rate baskets (different categories/rates in one order) can't be represented precisely.
- **G13 — Taxability of DynoPay's own fees unconsidered.** Platform/network fees may themselves be taxable supplies in some jurisdictions.

---

## 5. Crypto-specific tax section (unique to a crypto processor — and a differentiator)

A fiat processor's tax story ends at "collect VAT/GST." A **crypto** processor has two extra layers most competitors ignore — which is exactly where DynoPay can lead.

### 5.1 Merchant income & FMV at receipt
- Income tax generally recognises revenue at the **fair-market value in fiat at the moment of receipt**. DynoPay already computes and stores a fiat `subtotal`/`tax_amount` at checkout plus the crypto settlement (§2.6), so the **income event is largely captured** — good.
- Gap: no consolidated, exportable **income report** (per period, per coin, FMV at receipt) that a merchant/accountant can drop into a return.

### 5.2 Cost-basis & capital-gains for HELD crypto *(the real gap)*
- Merchants who **auto-convert** to USDC/USDT realise little/no gain — simplest case.
- Merchants who **hold** the received crypto acquire a tax lot at the receipt-date FMV; when they later sell/spend it they owe **capital-gains** on the change in value. DynoPay records the acquisition value but produces **no lot inventory, no disposal tracking, and no realised-gain report** → the merchant has no basis records and faces reconstruction pain at filing.

### 5.3 The 2026 broker-reporting climate — potentially a DIRECT obligation
- **US Form 1099-DA.** Final regs require **gross-proceeds** reporting for digital-asset sales effected **on/after 1 Jan 2025**, and **cost-basis** reporting for covered securities **on/after 1 Jan 2026**. Critically, the broker definition **expressly includes "digital-asset payment processors (PDAPs)"** — a processor that stands ready to effect sales in the ordinary course. DynoPay's auto-convert flow (crypto in → stablecoin/fiat value out) may bring it within PDAP scope for US persons. **This is a possible obligation on DynoPay itself, not just a merchant convenience — get tax-counsel sign-off.**
- **EU DAC8.** Transposition was due **31 Dec 2025**, rules apply from **1 Jan 2026**; Reporting Crypto-Asset Service Providers (RCASPs) must **collect user/transaction data from 1 Jan 2026**, with cross-border exchange by **30 Sep 2027**. DAC8 also folds e-money/CBDC into CRS 2.0.
- **OECD CARF waves:** first exchanges **2027** (EU via DAC8, UK, JP, BR, ZA — collecting 2026 data), **2028** (AU, CA, SG, CH, HK), **2029** (US). If DynoPay is a CASP/RCASP in any of these, data-collection clocks are **already running**.

### 5.4 Crypto gaps (rated)
- **C1 (Critical, US) — 1099-DA / PDAP exposure unassessed.** No determination of whether DynoPay is a broker/PDAP; no 1099-DA data pipeline. Legal + engineering assessment needed now.
- **C2 (High) — DAC8/CARF (RCASP) status unassessed.** Data collection for first-wave jurisdictions began 1 Jan 2026; confirm whether DynoPay is in scope and, if so, start capturing the required fields.
- **C3 (High, differentiator) — No merchant crypto-tax pack.** No cost-basis lots, no realised-gain report, no FMV-at-receipt income export.
- **C4 (Medium) — Auto-convert gain/loss not surfaced.** The tiny conversion-moment delta isn't reported to the merchant.

### 5.5 The opportunity
A **"Crypto Tax Pack"** — per-period income at FMV, realised-gain/cost-basis lots (FIFO/spec-ID), auto-convert deltas, and exportable CSV/PDF — would be a genuine differentiator no mainstream processor offers, and it reuses data DynoPay already stores.

---

## 6. Prioritized recommendations (with build-vs-buy)

Priority order = compliance risk × merchant blast-radius.

| # | Gap | Recommendation | Build vs Buy |
|---|-----|----------------|--------------|
| **P0** | G2 VIES | Wire real **VIES** verification into the checkout reverse-charge decision (reuse the existing `/api/tax/validate` APILayer path or call VIES directly); **store the proof** (request/response + timestamp) on the order; cache results to survive VIES downtime, and define a fallback policy (charge VAT if unverifiable). | **Build** — small, high value; you already have a validation endpoint. |
| **P0** | G1 US sales tax | Do **not** hand-roll ~13k jurisdictions. Integrate a **tax engine** (Stripe Tax API / TaxJar / Avalara) for US rates + product taxability + rooftop sourcing; keep the in-house engine for VAT/GST. | **Buy** (US) — infeasible to build accurately. |
| **P0** | C1 1099-DA/PDAP | Commission a **legal determination** of DynoPay's US broker/PDAP status; if in scope, design the 1099-DA data pipeline from the settlement data you already keep. | **Build** the data pipeline; **buy** the legal opinion. |
| **P1** | G3 Nexus alerts | Add **threshold monitoring**: per-merchant rolling counters for EU €10k, each US state's Wayfair test, UK/AU/etc., with "you're approaching / you've crossed — you may need to register" alerts. A bought tax engine includes this for US; EU/GST can be a light in-house tracker over data you already store. | **Buy** (US, via engine) **+ Build** (EU/GST tracker). |
| **P1** | G4 Reduced rates / taxability | **Consume `reduced_rates`** (already stored) and add a category→rate map so `digital/physical/service` resolve to the right reduced/zero rate per jurisdiction. For breadth beyond EU, defer to the tax engine. | **Build** (EU/simple) **+ Buy** (long tail). |
| **P1** | G6 Reporting/OSS | **Extend the existing tax-report to the buyer-side collected tax** (group by **destination**, not merchant country): OSS return lines, per-country VAT summary, per-US-state liability, CSV/PDF. The buyer-side data is already persisted. | **Build** — data already exists. |
| **P1** | C3 Crypto Tax Pack | Ship the merchant income + realised-gain/cost-basis export (§5.5). Differentiator. | **Build**. |
| **P2** | G5 Evidence | Capture a **second** location signal (e.g. IP country + declared/billing country or payment-network hint), flag contradictions, and **retain 10 years**. | **Build**. |
| **P2** | G9 Sub-national | Model CA (GST+PST/QST) and IN slabs — or let the tax engine own these countries. | **Buy** preferred. |
| **P2** | C2 DAC8/CARF | Confirm RCASP status; if in scope, capture required user/transaction fields (collection clock is running for 2027 first exchanges). | Legal + **Build**. |
| **P3** | G7/G8/G10–G13 | VAT-invoice field audit; address validation (comes with the US engine); marketplace-facilitator review; dated rate-versioning + cache TTL; consider line-level tax. | Mixed. |

**Overall build-vs-buy verdict:** *hybrid.* Keep and extend the strong in-house **VAT/GST** engine (VIES, reduced rates, OSS reports, evidence, crypto tax pack — all high-leverage builds over data you already hold). **Buy** a tax engine specifically for **US sales tax** (rates, rooftop sourcing, nexus, returns) where building is not realistic. Treat **1099-DA/DAC8/CARF** as a legal-first workstream because they may be **DynoPay's own** obligations, not just the merchant's.

**Strategic note (out of scope):** if DynoPay ever wants to remove tax burden from merchants entirely, the **Merchant-of-Record** model (Paddle-style) is the alternative — but it makes DynoPay the legal seller with global filing/remittance and liability, a company-level decision far beyond this engine work.

---

## 7. Quick reference (for implementers)

- **Rate resolution / calc:** `backend/controller/payment/taxService.ts` (`calculateTax`, `validateVatId`, `shouldReverseCharge`).
- **Rate cache + manual endpoints:** `backend/controller/taxController.ts`, `backend/routes/taxRouter.ts`, `backend/models/taxRateModel.ts`.
- **Static rates/labels/EU list:** `backend/utils/taxData.ts` (`FALLBACK_TAX_RATES`, `TAX_TYPE_ACRONYMS`, `EU_COUNTRIES`).
- **Settings resolution:** `backend/services/companyTaxService.ts` (`resolveTaxSettings`).
- **Persisted tax columns:** `backend/migrations/addTaxFields2026_07_16.ts` (`tbl_product_order`, `tbl_user_transaction`, `tbl_user`, `tbl_product`, `tbl_payment_link`).
- **Checkout money split:** `backend/controller/payment/checkoutMath.ts`.
- **Buyer location:** `backend/controller/payment/cryptoCheckout.ts` + `backend/utils/geolocation`.
- **Settings UI:** `Components/UI/pay-link/TaxSection.tsx`, `Components/UI/CompanySettingsDialog/CompanyDetailsSection.tsx`.
- **External dependency:** APILayer `tax_data` (`TAX_DATA_API_URL`, `TAX_DATA_API_KEY`).
