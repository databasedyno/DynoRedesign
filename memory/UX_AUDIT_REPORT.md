# Dynopay — UX Usability Audit Report (All Device Types)
**Date:** 2026-07-12 · **Auditor:** E1 agent (automated instrumentation + visual review + QA task testing)
**Build audited:** production standalone build on preview (`8640b4d6…preview.emergentagent.com`), same code as dynopay.com

---

## 1. Methodology

| Layer | What was done |
|---|---|
| **Instrumented crawl** | 25 pages × 3 viewports (**mobile 390×844 touch DPR2, tablet 768×1024 touch, desktop 1440×900**) = 75 page loads. Programmatic checks: horizontal overflow, touch-target sizes, sub-11px text, unlabeled form fields, missing `alt`, `h1` semantics, console/page errors, hydration errors, load timing. |
| **Visual review** | ~30 screenshots reviewed (light + dark mode) across public, logged-in (data-rich + empty accounts) and checkout surfaces. |
| **Task-based QA testing** | 7 persona task flows executed by an independent QA agent with real device emulation (tap interception probes, focus-ring probes, live link create + delete). |
| **Accounts** | `hostbay` (386 txns, 13 wallets, $18k volume), `qa.empty` (brand-new empty account), anonymous visitor. |

**Pages covered:** landing, fees, documentation, blog, login, register, reset-password, system-status, checkout demo, donation demo, public creator page, dashboard (rich + empty), wallet, transactions, pay-links, create-pay-link, customers, settings, notifications, developer-keys, creator settings, invoices, referrals, help-support.

---

## 2. What is working well ✅

1. **Zero horizontal overflow on all 75 page×viewport combinations** — genuinely rare; the responsive foundation is excellent.
2. **Responsive architecture adapts properly**: sidebar → bottom tab bar on mobile; tables → cards; create-pay-link preview → bottom-sheet FAB; docs get a mobile sticky search.
3. **Checkout is clean on every device** and dark mode there is excellent (lime CTA, mono amounts, stepper, trust strip, fee transparency "Fees covered by merchant").
4. **Auth pages are best-in-class on mobile**: SSO-first register, referral-code affordance, clear login/register cross-links, friendly bad-credentials error ("Invalid email or password").
5. **Performance**: no page exceeded ~4s DOMContentLoaded on the production build; most were far faster.
6. **Empty account experience has real onboarding**: auto-opened company wizard (2-step Company → Wallet), onboarding checklist, $500 fee-free welcome — strong activation mechanics (with one stacking issue, see F5).
7. **Documentation**: base-URL pill, sidebar search filters sections, cURL/Node/Python tabs verified working, endpoint cards, Try-It-Live.
8. **Dark mode is consistent** across the app shell, dashboard, checkout (one minor sidebar watermark artifact, F22).

---

## 3. Findings — ranked by severity

### 🔴 P0 — fix first

**F1. Floating chat FAB occludes critical actions on mobile (390px)** — *verified with coordinate probes*
- Overlaps the last ~20px of the **"Create Company" CTA** inside the auto-opened onboarding modal (FAB x=318-374 vs CTA x=52-338, same y-band). Right-side thumb taps land on the FAB.
- Overlaps **"View all"** in Recent transactions on the dashboard (~39px horizontal overlap).
- Sits on top of **transaction row status/amount region** on /transactions and **"Total processed"** values on /wallet.
- Also clips the hero trust line on the mobile landing page.
- **Recommendation:** hide the FAB while any blocking Dialog is open; on <lg viewports, dock it above the content band (or into the Account tab). Precedent already exists — docs page back-to-top Fab was deliberately placed above the chat bubble.

**F2. No visible keyboard focus indicators on the login form (WCAG 2.4.7)**
- Email input, Continue button, Google and GitHub SSO buttons all report `focus-visible: none` (outline suppressed). Only the header link + language selector show rings. Keyboard users cannot see where they are on the single most important form. Likely a global MUI override → probably app-wide.
- **Recommendation:** add `&:focus-visible { outline: 2px solid #CCFF00; outline-offset: 2px }` at theme level.

**F3. Icon-only row actions on /pay-links (copy / view / edit / delete)**
- 14–20px icon buttons with **no aria-label, no tooltip, no text** (WCAG 4.1.2). Copying the link URL is the #1 job of this page and it is the least discoverable action; also far below the 44px touch guideline.
- **Recommendation:** `<Tooltip><IconButton aria-label="Copy link">` minimum; ideally a labelled "Copy link" pill on the row.

**F4. API failure states are indistinguishable from empty states**
- Under rate limiting (simulating a flaky network), `/create-pay-link` showed the **"Create a Company" onboarding gate to a merchant who HAS a company**; the header company selector rendered blank; icon `<img>`s rendered as broken-image glyphs ("logo", "BG Overlay" alt text visible). No error banner, no retry.
- Risk: users on poor mobile connections will believe their account/data is gone.
- **Recommendation:** distinguish `error` from `empty` in reducers (the fetch failed ≠ the list is empty); show a retry banner; add graceful fallbacks for decorative images; exempt static assets from rate limits.

### 🟠 P1 — high value

**F5. Stacked double onboarding modals for brand-new users** — "Create Your Company" opens, and the "$500 fee-free" celebration modal stacks **on top of it**. Dismissing one reveals the other. Make the promo a banner/toast, or sequence it after company creation.

**F6. Notification fatigue** — active merchant has **573 unread**; badge caps at "99+"; every payment emits 2–3 separate notifications (pending → received); a redundant chip repeats the title inside each row. Recommend: group per payment, auto-mark-read on inbox view, and a daily digest option.

**F7. Dashboard metric semantics**
- "LIFETIME VOLUME ↓ 68.2% vs last month": a cumulative lifetime metric cannot decline — the delta belongs to a *monthly volume* metric. Merchants will read this as "I lost 68% of my money."
- "TODAY'S REVENUE $0.00 / *vs yesterday*": when the delta chip is suppressed at 0, the dangling "vs yesterday" label remains.

**F8. Live preview fidelity on /create-pay-link** — preview CTA renders teal/green while the real checkout CTA is lime-on-ink; preview footer says "3 cryptocurrencies accepted" by default for a merchant with 13 wallets. Merchants must be able to trust the preview; render both from one shared style/config source.

**F9. Customers page swamped by synthetic rows** — 24 "Recovered Customer / API" records, all $0 / 0 txns, for a merchant with 386 real transactions. The page currently answers no merchant question. Recommend: segment tabs ("Customers | API records"), hide $0 synthetic rows by default, aggregate recovered records.

**F10. Public creator page (mobile)** — the avatar is clipped under the fixed header (insufficient top offset), and a published page with no links is a dead end ("Support my work below!" bio with nothing below). Suggest a fallback tip-jar CTA or clearer empty message to visitors.

**F11. React hydration errors (#418/#423/#425) on /pay/donation-demo** — reproduced on desktop **and** tablet (not mobile). Hydration mismatches can silently break interactivity; likely SSR/client divergence (time/locale-dependent render). Worth a dev-mode trace.

**F12. Invoices ambiguity** — Total column shows "0.68" / "0.00" with **no currency**; VAT shows "—"; a $0.00 invoice adds noise. Add currency code and suppress zero-value invoices.

### 🟡 P2 — polish

**F13. Touch targets below 44px on mobile (recurring inventory):** theme toggle 30×30 (every page), hamburger 24×36, landing carousel dots 8×8, footer links ~20px tall, checkout copy-invoice 22×21, language-menu items 30px tall, numerous 28–34px buttons (regenerate/disable API key, mark-all-read, upload buttons). None broken, all harder than needed.

**F14. Checkout micro-typography:** "INVOICE" 9px, "ORDER DETAILS" 9.5px on mobile; several 10–10.5px eyebrow labels (chart axis, wallet chips, status pills). Keep eyebrows ≥ 10px and data labels ≥ 11px.

**F15. Docs copy button gives no textual feedback** ("Copy" never becomes "Copied!") — fine for sighted mouse users if there is an icon change, invisible to screen-reader/keyboard users (`aria-live` recommended).

**F16. Heading semantics/SEO:** 10 public pages have **no `<h1>`** (documentation, blog, login, register, checkout pages, help-support, creator public, system-status). Visual hierarchy exists; semantic hierarchy doesn't.

**F17. Unlabeled inputs (a11y inventory):** donation custom-amount / donor-name / donor-message; creator handle/bio/socials; search fields on transactions/pay-links/customers/help; phone + country + currency in company wizard. All need `aria-label` or associated `<label>`.

**F18. In-app header logo on mobile/tablet** is a ~30px squished blue mark (illegible, off-brand vs the marketing wordmark).

**F19. Fee narrative inconsistency:** hero "Fees from 0.5%", terminal mockup "fee 0.7%", checkout demo fee €2.50 on €100 (2.5%). Pick one canonical example.

**F20. Referral duplication + hierarchy:** referral code card occupies the top slot of the dashboard (above revenue) *and* repeats in the sidebar footer. Revenue should outrank referrals for a payments product.

**F21. Pay-links table:** first column is a raw numeric Link ID; "No description" placeholder rows; key columns (status, payments received) require horizontal scroll at 1440px sidebar layouts.

**F22. Dark-mode sidebar referral card** shows a light logo-watermark patch that reads as a rendering glitch.

**F23. Settings friction notes:** name fields locked ("contact support to update") — consider self-serve with verification; "You signed up without a password. Set one now" renders at 10px.

**F24. Help center (mobile):** no page title/search visible above the fold; article cards carry large dead space with a bottom-right arrow-only affordance.

---

## 4. Device matrix summary

| Area | Mobile 390 | Tablet 768 | Desktop 1440 |
|---|---|---|---|
| Layout integrity (overflow) | ✅ 0px everywhere | ✅ 0px | ✅ 0px |
| Occlusion (chat FAB) | 🔴 F1 | 🟡 minor | ✅ |
| Touch targets | 🟠 F13 inventory | 🟡 few | n/a |
| Checkout | ✅ (micro-type F14) | ✅ | ✅ |
| Dashboard | 🟠 F1/F7 | ✅ | ✅ (F7) |
| Docs | ✅ | ✅ | ✅ (F15) |
| Donation demo | ✅ | 🟠 F11 hydration | 🟠 F11 hydration |
| Creator public | 🟠 F10 avatar clip | ✅ | ✅ |
| Dark mode | ✅ | ✅ | ✅ (F22) |

## 5. Quick-win shortlist (highest impact ÷ effort)
1. Hide chat FAB when a Dialog is open + lift it on mobile (F1) — 1 component.
2. Theme-level `:focus-visible` ring (F2) — a few lines, app-wide fix.
3. Tooltips + aria-labels on pay-links row actions (F3).
4. Fix "Lifetime volume" delta label → "Volume this month" or move delta (F7).
5. Add currency to invoice totals (F12).
6. Make $500 promo a banner instead of stacked modal (F5).

*Artifacts: screenshots at `/tmp/uxaudit/{mobile,tablet,desktop,pass2,dark}/*.jpg`, raw metrics at `/tmp/uxaudit/results.json`, QA task report at `/app/test_reports/iteration_27.json`.*
