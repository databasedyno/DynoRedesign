# Tax System — Industry-Standard Analysis

## Objective
Produce a written assessment of DynoPay's existing tax handling, measured against
2026 industry standards for online-payment tax compliance, and a prioritized list
of gaps with recommended fixes. This pass produces the **assessment** (a document).
It does not change how tax is calculated, configured, or collected.

## What you'll get (the deliverable)
A single analysis report containing:
1. **Current-state inventory** — a plain-language summary of what the tax system
   does today.
2. **Benchmark** — how it compares to the two recognised industry tiers
   (a *calculation engine* like Stripe Tax / Quaderno, vs a *merchant-of-record*
   like Paddle) and to the statutory rules that matter (EU VAT & OSS, UK VAT,
   US sales tax & economic nexus, and the main GST regimes).
3. **Gap list** — every gap rated Critical / High / Medium / Low, with the concrete
   compliance risk each one creates.
4. **Crypto-specific section** — merchant income, cost-basis and capital-gains
   record-keeping, plus the new 1099-DA / DAC8 / CARF reporting climate. This is a
   gap area unique to a crypto payment processor and a potential differentiator.
5. **Prioritized recommendations** — what to do to close each gap, each with a
   short *build-vs-buy* note (extend the in-house logic vs integrate a tax engine).

## Preview of the main findings (so you can steer priorities)
**Already strong today:** destination-based VAT/GST rates for ~45 countries (live
API with a hard-coded fallback), tax-inclusive and tax-exclusive pricing,
per-product tax categories, EU B2B reverse-charge, per-company and per-payment-link
tax settings, tax shown on receipts, and tax figures stored on every order for an
audit trail.

**Biggest gaps vs the standard:**
- **No US sales tax** — US is currently treated as 0%. Real support needs
  state + local rates, sourcing rules, product taxability, and marketplace rules.
- **EU reverse-charge is format-check only**, not live VIES verification — which
  auditors treat as insufficient evidence for a 0% B2B sale.
- **No economic-nexus / threshold monitoring or alerts** (US *Wayfair* state
  thresholds, EU €10,000 cross-border threshold).
- **Only standard rates are applied** — reduced/zero rates and per-jurisdiction
  product taxability are not used (a `reduced_rates` field exists but is ignored).
- **Single location signal** (IP or shipping) rather than the two non-contradictory
  pieces of evidence (with ~10-year retention) required for EU B2C digital sales.
- **No tax reporting / exports** for filing, and no OSS-return-ready summaries.
- **No crypto cost-basis / capital-gains records** for merchants who hold rather
  than auto-convert.

## Scope & positioning (proposed — confirm or change)
- **Benchmark bar = "tax calculation & collection engine"** (DynoPay computes and
  collects; the merchant remits). This matches how the product already describes
  itself. Becoming a full **Merchant of Record** (DynoPay becomes the legal seller
  and files/remits returns) is a much larger strategic and legal change; it will be
  noted as an option but treated as out of scope for the assessment.
- **Jurisdictions benchmarked:** EU (plus UK), US sales tax, and the main GST
  countries already in the rate table (AU, CA, NZ, SG, IN, and similar).
- **Crypto-specific tax section:** included.

## Out of scope for this pass
- Any change to tax calculation, settings UI, or checkout behaviour (analysis only).
- Becoming a Merchant of Record, or actually filing/remitting tax anywhere.
- Legal or accounting sign-off. The report is a product/engineering assessment and
  reflects public 2026 guidance; it is not tax advice.

## Decisions to confirm
1. **Deliverable depth:**
   a. Analysis report only. *(default)*
   b. Analysis report, then start building the Critical/High fixes straight after.
2. **If fixes are built later, preferred direction:**
   a. Extend the in-house rate table and calculation logic.
   b. Integrate a third-party tax engine (e.g. Stripe Tax API, Quaderno, or
      TaxJar/Avalara) for rates, nexus tracking, and VIES validation.
   c. Let the report recommend the best route per gap. *(default)*
3. **Crypto cost-basis / capital-gains + 1099-DA / DAC8 / CARF** merchant
   record-keeping analysis — include it? *(default: yes)*

## Assumptions
- The report is delivered as a markdown document kept in the repo for the team.
- No production data is touched; SAFE MODE is unchanged.
