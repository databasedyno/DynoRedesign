# Dynopay — User Research & Testing Report (Simulated)
**Date:** 2026-07-12 · **Method:** persona-based walkthroughs + task-based usability testing via browser automation (real device emulation), heuristic evaluation, behavioral evidence from live account data.
**Honest scope note:** no live human participants were recruited (not possible from this environment). Personas are grounded in the platform's real user segments and in real account data (a $18k-volume merchant with 386 transactions, a brand-new empty account, anonymous visitors). Findings are evidence-based (screenshots, coordinate probes, task completion), not opinion-only.

---

## 1. Who uses Dynopay — persona set

| Persona | Segment | Primary job-to-be-done |
|---|---|---|
| **Fatima** — first-time merchant | New signup, small online store | "Accept my first crypto payment this week without reading docs." |
| **Hugo** — power merchant *(mirrors `hostbay`)* | 386 txns, 13 wallets, $18k lifetime | "Monitor settlements daily, reconcile, never miss a stuck payment." |
| **Dana** — integrating developer | SaaS team | "Evaluate the API in 15 minutes; wire checkout + webhooks safely." |
| **Carlos** — end customer (payer) | Mobile-first buyer | "Pay this invoice in crypto without screwing up the network/amount." |
| **Priya** — donor | Casual, non-crypto-native | "Support a campaign in 3 taps; feel my money arrived." |
| **Kai** — creator | Streamer/indie | "A link-in-bio page where fans can pay/support me." |

---

## 2. Task-based testing results (7 flows, mobile + desktop)

**All 7 flows completed** — no broken funnels. Friction observed inside flows is listed per persona below. (Full QA log: `/app/test_reports/iteration_27.json`.)

| # | Task | Device | Result |
|---|---|---|---|
| 1 | New merchant first-run (dashboard → company wizard) | Mobile 390 | ✅ done, 2 frictions |
| 2 | Create + copy + delete a $10 payment link | Desktop | ✅ done, live preview updates in real time |
| 3 | Pay an order via checkout demo (coin → QR/address) | Mobile 390 | ✅ done |
| 4 | Donate via donation checkout (preset + custom) | Mobile 390 | ✅ done, no hydration errors on mobile |
| 5 | Evaluate docs (search, section jump, language tabs, copy) | Desktop | ✅ done — tabs verified working |
| 6 | Mobile navigation sweep + occlusion probes | Mobile 390 | ✅ nav works; FAB occlusion confirmed with coordinates |
| 7 | Login error handling + keyboard access | Desktop | ✅ friendly error; ❌ no visible focus rings |

---

## 3. Needs & pain points by persona

### Fatima — first-time merchant
**What works:** SSO-first signup; auto-opened 2-step company wizard with "I'll do this later"; onboarding checklist on the empty dashboard; the **$500 fee-free welcome is a genuine delight moment** and answers "what does this cost me?" before she asks.
**Pain points:**
1. 🔴 On her phone, the chat bubble sits **on the "Create Company" button** — the single most important tap of her first session (verified tap-interception on the right side).
2. 🟠 Two modals stack (company wizard + $500 promo) — first-run feels chaotic; she can't tell which to deal with first.
3. 🟠 If her hotel Wi-Fi drops a request, the app tells her she has no company (error rendered as empty state) — trust-destroying for a *payments* product.
4. 🟡 She hesitates on "Blockchain fees paid by: Customer / Company" — good copy, but no "which should I pick?" hint or default explanation.
**Unmet need:** *reassurance under failure* — a payments product must never look broken when a request fails.

### Hugo — power merchant
**What works:** dashboard reads at a glance; recent transactions + statuses clear; wallet cards with copy buttons; transactions filter/search/export; settings→sections layout; creator page discoverable.
**Pain points:**
1. 🟠 **573 unread notifications** — every payment fires 2–3 entries; he has learned to ignore the badge, which defeats notifications entirely. Wants: grouping per payment + digest.
2. 🟠 "Lifetime volume ↓68.2% vs last month" reads like he *lost* money (impossible for a cumulative metric) — he double-checks his wallet because of a label.
3. 🟠 The Customers page shows 24 synthetic "$0 / 0 txns Recovered/API" rows and none of his actual payers — he stops visiting the page.
4. 🟡 Copying a pay-link URL from the table requires decoding unlabeled 14px icons.
5. 🟡 Invoice totals lack a currency symbol — he can't forward them to his accountant as-is.
**Unmet need:** *signal over noise* — high-volume merchants need aggregation (grouped notifications, real-customer segmentation), not row-per-event feeds.

### Dana — developer
**What works:** docs hero states the base URL immediately; sidebar search filters; cURL/Node/Python tabs (verified); endpoint cards with full production URLs; /developer-keys shows working embedded-checkout snippets with the real origin; publishable-key concept labeled.
**Pain points:**
1. 🟡 Copy buttons give no "Copied!" confirmation (and none announced to screen readers).
2. 🟡 API key page actions (regenerate/disable) are compact and close together — a destructive `Regenerate` sits one slip away from `Disable` with no spacing/confirm affordance visible on the card.
3. 🟡 No visible sandbox/test-mode framing in docs — Dana wants to know "can I test without real funds?" in the first screen (Try-It-Live partially covers this; make it prominent).
**Unmet need:** *confidence to experiment* — test-mode visibility and undo-safety around key management.

### Carlos — end customer paying on mobile
**What works:** checkout is the strongest surface in the product — order summary with VAT + fee transparency ("Fees covered by merchant"), stepper, expiry countdown, "Secure payment by Dynopay" trust mark, excellent dark mode, coin tile grid, network pills, copy-address affordances.
**Pain points:**
1. 🟡 The copy-invoice button is 22×21px — fiddly mid-checkout.
2. 🟡 9–9.5px labels (INVOICE / ORDER DETAILS) are at the edge of legibility outdoors.
3. 🟡 Expiry "6d : 23h : 59m : 56s" ticks every second at the payment step — creates false urgency for a 7-day window; consider "Expires July 18" until <24h remain.
**Unmet need:** none blocking — this flow is in good shape; polish only.

### Priya — donor
**What works:** campaign page is compelling — cover image, goal bar, "213 supporters / 65% funded / $8,760 to go", preset tiles, anonymity option; demo states (crowdfunding / tip jar / goal reached) all render.
**Pain points:**
1. 🟠 Hydration errors on desktop/tablet (React #418/423/425) — no visible breakage observed, but this class of bug can kill button handlers silently; needs a dev trace.
2. 🟡 Donation inputs (amount, name, message) lack accessible labels — screen-reader donors can't complete the flow confidently.
3. 🟡 "65% funded" appears twice within one viewport (badge + stat).
**Unmet need:** *inclusive giving* — donation flows attract the least crypto-savvy users; accessibility matters most exactly here.

### Kai — creator
**What works:** claiming flow is discoverable (sidebar NEW pill, dashboard card, user menu); settings page with live preview, cover, socials, stats tiles.
**Pain points:**
1. 🟠 His public page on mobile clips the avatar under the fixed header — the first impression fans get is a cropped face.
2. 🟠 A published page with no payment links is a dead end: bio says "Support my work below!" and below is "Nothing here yet." Visitors bounce; Kai never knows.
3. 🟡 Stats tiles (Total visits / This week / Supporters) render labels at 10.5px.
**Unmet need:** *a default way to get paid* — an automatic tip-jar block whenever no links are published would make every claimed page monetizable from minute one.

---

## 4. Cross-persona synthesis — the 5 core user needs

1. **Never look broken** (Fatima, Hugo): differentiate error vs empty states; retry affordances; graceful image fallbacks. A payments UI that shows wrong "you have nothing" states loses trust instantly.
2. **Mobile thumb ergonomics** (all): the chat FAB placement + sub-40px targets are the biggest friction multipliers on the device class most payers actually use.
3. **Signal over noise** (Hugo): grouped notifications, real-customer segmentation, currency-labeled documents.
4. **Fidelity & consistency** (Fatima, Carlos): the preview must equal the checkout; one canonical fee story (0.5% vs 0.7% vs 2.5% examples currently coexist).
5. **Accessibility as a growth lever** (Priya, Dana): focus rings, labeled inputs, announced copy actions — the donation/checkout surfaces serve the least technical audience in the funnel.

## 5. Prioritized recommendations

| Priority | Recommendation | Personas served | Effort |
|---|---|---|---|
| P0 | Hide/relocate chat FAB when modal open + on mobile | All mobile | S |
| P0 | Theme-level visible `:focus-visible` rings | Priya, Dana, all | S |
| P0 | Error-vs-empty state separation + retry banner | Fatima, Hugo | M |
| P0 | Label pay-links row actions (tooltips + aria) | Hugo | S |
| P1 | Group payment notifications + auto-read + digest | Hugo | M |
| P1 | Fix "Lifetime volume" delta semantics; remove dangling "vs yesterday" | Hugo | S |
| P1 | Merge/sequence first-run modals ($500 promo → banner) | Fatima | S |
| P1 | Preview↔checkout single source of truth (CTA color, coin count) | Fatima | S-M |
| P1 | Customers page: segment real vs API/recovered records | Hugo | M |
| P1 | Creator page: fix mobile avatar clip + default tip-jar empty state | Kai | S-M |
| P2 | Touch-target pass (≥40px), micro-type floor ≥10px | Carlos, all | M |
| P2 | Invoice currency labels; suppress $0 invoices | Hugo | S |
| P2 | aria-labels on all search/donation/creator inputs; `h1` semantics | Priya | M |
| P2 | Docs "Copied!" feedback + aria-live | Dana | S |
| P2 | Trace donation-demo hydration mismatch (desktop/tablet) | Priya | M |

## 6. Suggested next research steps (when real users are reachable)
1. **5-user moderated test** of the first-run flow (signup → company → wallet → first link) on personal phones — validates F1/F5 impact on activation rate.
2. **Notification diary study** with 3 active merchants for one week — validates grouping/digest design before building.
3. **Checkout intercept survey** (1 question post-payment: "How easy was that?") — establishes a baseline CES for the payer funnel.
4. **Analytics to add:** funnel events for company-wizard step abandonment, pay-link copy actions, notification open rate, creator-page visit→payment conversion (visits are already counted in Redis).

*Companion document: `/app/memory/UX_AUDIT_REPORT.md` (full severity-ranked findings F1–F24 with device matrix).*
