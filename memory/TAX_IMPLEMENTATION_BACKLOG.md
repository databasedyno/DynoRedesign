# DynoPay Tax — Implementation Backlog

Derived from `TAX_SYSTEM_ASSESSMENT.md` (2026-09-14). Ordered by priority.
Effort: S ≈ <1 day, M ≈ 1–3 days, L ≈ multi-day/vendor. Build = in-house, Buy = vendor.

Legend: ⬜ todo · 🔨 in progress · ✅ done

## P0 — Compliance-critical
- ✅ **1. Live VIES in checkout reverse-charge** · Build · S — DONE 2026-09-14
  - `verifyVatId()` now calls the EU's **official VIES REST API**
    (`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{num}`,
    free, authoritative, no key). Parses `isValid` + captures `name`/`address`
    as proof. (The previous APILayer `/validate` returned `valid:false` even for
    genuinely-valid numbers → the feature would never have fired.)
  - Reverse-charge (EU B2B, cross-border, both EU) granted ONLY on a positive
    live/cached result. Results cached in `tbl_vat_validation` (90-day TTL).
    Fallback = **charge VAT** when unverifiable; a recent POSITIVE stale cache
    still counts during a VIES outage. Greece EU code `GR` ↔ VIES `EL` handled.
  - Persisted on the order: `vies_valid` / `vies_checked_at` / `vies_source`
    (`cartController` → `calculateTax` → order row). Migration 0028.
  - Verified via `backend/scripts/test_vies_tax.ts`: IE6388047V (Google) →
    valid/reverse-charge; invalid → VAT; same-country → VAT; cache written.
  - Config: `VIES_REST_BASE`, `VIES_CACHE_TTL_DAYS` (env, defaults built-in).
- ⬜ **2. US sales tax via tax engine** · Buy · L — Stripe Tax / TaxJar / Avalara. **Decision: vendor.**
- ⬜ **3. 1099-DA / PDAP broker determination + data pipeline** · Legal-first + Build · M.

## P1 — High value
- ✅ **4. Nexus / threshold monitoring + alerts** · Build · M — DONE 2026-09-14
  - `GET /api/tax/nexus-status` sums the merchant's current-year PAID orders per
    threshold (converting each order currency → the threshold currency) and
    reports ok / approaching (≥80%) / crossed for: EU pan-EU B2C €10k (OSS), UK
    £90k, AU A$75k, NZ NZ$60k, SG S$1M. Emails a one-off escalation alert per
    (threshold, level), deduped in `tbl_nexus_alert` (migration 0030), suppressed
    on this pod via DISABLE_OUTBOUND_EMAIL. In-app panel on the Collected-tax tab.
  - Files: `utils/nexusThresholds.ts`, `services/nexusService.ts`,
    `models/nexusAlertModel.ts`, `taxReportController.getNexusStatus`, taxRouter,
    `CollectedTaxReport.tsx` (Registration thresholds panel).
- ✅ **5. Apply reduced/zero rates + product taxability** · Build · M — DONE 2026-09-14
  - Product carries an explicit `tax_treatment` (standard | reduced | zero) +
    `reduced_category` (migration 0029). At checkout `calculateTax` applies the
    destination country's band via a curated `utils/reducedRates.ts` matrix
    (multi-band per country; falls back to standard → never under-collects; zero
    → 0% zero-rated). Cart derives a conservative cart-level treatment.
  - **AI auto-detect** (answering the user's "can AI solve this at the point of
    request?"): `POST /api/tax/suggest-treatment` uses the merchant's existing
    `OPENAI_API_KEY` via the native `openai` Node SDK (gpt-5.4-mini, same client
    pattern as supportChatController) to suggest treatment+category from the
    product title/description; merchant confirms.
  - Files: `utils/reducedRates.ts`, `taxService.ts`, `productModel.ts`,
    `productController.ts`, `cartController.ts`,
    `taxReportController.suggestTaxTreatment`, `ProductEditor/index.tsx`.
- ✅ **6. Buyer-side / OSS destination tax report + export** · Build · M — DONE 2026-09-14
  - New read-only, merchant-scoped report over `tbl_product_order` (paid) grouped
    by **buyer destination + currency**: `/api/tax/collected-report` (+ `/csv`).
  - Returns `by_country`, `by_period`, `by_currency`, EU `oss_lines`, and a
    **converted grand-total in the merchant's display currency** (reuses
    `convertToFiat`/`getUserDisplayCurrency`; per-currency source figures kept,
    no cross-FX in the tables). CSV adds a `Tax Collected (<DISPLAY>)` column +
    a TOTAL row.
  - New dashboard tab: Invoices → **"Collected tax"** (tab index 2, deep-link
    `?tab=collected`). Component `Components/Page/Invoices/CollectedTaxReport.tsx`.
  - Verified: backend via curl; frontend E2E testing_agent iteration_173 (100%).
- ⬜ **7. Crypto Tax Pack (income FMV + cost-basis/realised-gain export)** · Build · M/L (differentiator).

## P2
- ⬜ **8. Second location evidence + 10-yr retention** · Build · M.
- ⬜ **9. Sub-national CA (GST+PST/QST) / IN slabs** · Buy · M.
- ⬜ **10. DAC8 / CARF (RCASP) scoping** · Legal + Build · M.

## P3 — hardening
- ⬜ **11. VAT-invoice field audit** (sequential #, both VAT IDs, per-rate breakdown, RC legend) · S.
- ⬜ **12. Address validation / rooftop US sourcing** (comes with #2) · S.
- ⬜ **13. Marketplace-facilitator liability review** · Legal · S.
- ⬜ **14. Dated rate versioning + `tbl_tax_rate` cache TTL/refresh** · Build · S.
- ⬜ **15. Line-level tax for mixed-rate carts + taxability of DynoPay fees** · Build · M.

## Bugs fixed in passing (2026-09-14)
- **calculateTax under-collection for uncached countries.** The live-rate branch
  assigned APILayer's `standard_rate` object (`{rate:0.23,…}`) directly to
  `tax_rate` → tax computed as **0%** for any country not yet in `tbl_tax_rate`.
  Now coerces to a number, expands a fractional rate (0.23→23), and falls back
  to the static table when the API value is unusable (mirrors `taxController`).

---
**Done:** #1 (VIES), #4 (nexus alerts), #5 (reduced/zero + AI auto-detect), #6
(destination/OSS report). **Next candidates:** #7 Crypto Tax Pack (differentiator),
#8 second location evidence + retention. US sales tax (#2) + 1099-DA (#3) need a
vendor/legal decision from the user.
