# Creator UX Roadmap — Payment Checkout Relevance, Support Widget, Handle UX, Auto-API-Key, Display Currency

**Status:** Living document. Update as items ship.  
**Created:** Session 38 (2026-07-13)  
**Owner:** Main agent (Dynopay)  
**Preview URL (this session):** https://merchant-portal-247.preview.emergentagent.com

---

## Overview

Five workstreams captured from user requests in Session 38. Two are code-complete pending QA; two are new and awaiting product decisions; one is a small backlog item.

| # | Workstream | Status | Blocker |
|---|---|---|---|
| A | Payment checkout donation-flavored copy | Backend ✅ shipped + 56/56 tests pass. Frontend code ✅ shipped, UI test aborted. | Frontend UI test |
| B | Support Widget on creator public page (Donate / Tip / Coffee) | Not started — UX analyzed, 5 open decisions | User decisions on 5 questions below |
| C | Handle/username editability UX improvements | Not started — analysis done | Coupled with (B), same decision batch |
| D | Auto-API-Key provisioning full frontend a11y+mobile sweep | Not started — code was shipped in Sessions 34-36; just needs a11y QA | Frontend testing agent invocation |
| E | Per-user display-currency override | Not started — company-level already ships (Rollout steps 1-2 done); this is optional Step 3 | Backlog priority |

---

## A) Payment Checkout Donation-Flavored Copy

### Background
When a donor picked an amount on a donation campaign, `/pay/startDonation` created a `contribution` child link and redirected to `/pay/{child_ref}`. That page had NO signal it was a donation — it rendered generic "Complete your payment" / "Order Details" / "Cryptocurrency" button / "Payment Successful, John!" copy. Root cause: `pay/getData` never surfaced `link_type` or the donor-context fields.

### What shipped this session (Session 38)

**Backend** (`backend/controller/payment/cryptoCheckout.ts`, `getData` handler):
- New non-fatal `contributionInfo` fetch block populates when `item.link_type === 'contribution'` and `item.parent_link_id` is set.
- Response payload now includes `link_type: 'standard' | 'donation' | 'contribution'` and a `contribution` object with 15 fields: `parent_link_id`, `campaign_title`, `campaign_description`, `campaign_image`, `campaign_currency`, `campaign_pay_url` (public share URL of parent), `goal_amount`, `raised_amount`, `supporters_count`, `progress_percent`, `show_progress`, `show_supporters`, `donor_name`, `donor_message`, `is_anonymous`.
- Merchant privacy settings (`show_progress`/`show_supporters`) gate aggregate fields (null when disabled).
- Backward-compat: standard/donation-parent flows unchanged.

**Frontend** (3 files):
- `pages/pay/index.tsx` — new `linkType` + `contributionInfo` state; `getTitle()` returns "Complete your donation" for contributions; `getSubtitle()` uses campaign title; Order Details header → "Donation Details"; Pay button → "Donate with crypto"; embed postMessage enriched with `{ linkType, parent_link_id, campaign_title, amount, currency, progress_percent }`.
- `Components/Page/Pay3Components/cryptoTransfer.tsx` — forwards `linkType` + `contributionInfo` to success card.
- `Components/UI/TransferExpectedCard/Index.tsx` — donation-flavored title ("Thank you for your donation, {name}!"), amount line ("You donated $25 to {campaign}"), donor message reveal block, campaign progress bar, Share/Back CTAs (`navigator.share()` with clipboard fallback; back = `campaign_pay_url`).

**i18n** — 17 new keys × 6 locales (en/es/fr/de/nl/pt) in `common.json` under `checkout.*` and `success.*`.

### Verification status
- ✅ **Backend:** 56/56 assertions across 7 scenarios (deep_testing_backend_v2 Session 38). All contribution fields correct, backward-compat verified, orphan-parent robustness verified. Test data cleaned up.
- ⚠️ **Frontend UI:** Testing agent was invoked but aborted before executing any Playwright script. **RE-RUN NEEDED** — see task in Section D below (combined sweep).

### Manual sanity commands
```bash
# Backend regression
curl -sS -X POST $EXT/api/pay/getData -H 'Content-Type: application/json' -H 'Cookie: token=<token>' \
  -d '{"data":"<standard_link_ref>","language":"en"}' | jq '.data | {link_type, contribution}'
# Expected: link_type is "standard" or absent; contribution is absent.

curl -sS -X POST $EXT/api/pay/getData -H 'Content-Type: application/json' -H 'Cookie: token=<token>' \
  -d '{"data":"<contribution_child_ref>","language":"en"}' | jq '.data | {link_type, contribution}'
# Expected: link_type === "contribution"; contribution object present.
```

---

## B) Support Widget on Creator Public Page — Donate / Tip / Coffee

### Problem statement (user's own words)
> "I thought donation, tip o buy me coffee button will appear on the creator public page. example /hostbay based on settings."

### Current gap (analyzed)
Public creator page `/{handle}` only shows donation campaigns/links the creator has manually created. There is NO **persistent, always-on "Support Widget"**. To receive tips, a creator must create a heavyweight donation campaign (title, description, goal, image). No lightweight "always accepting tips" mode. This is the primary UX gap vs Buy Me a Coffee, Ko-fi, and Patreon.

### Proposed feature scope

**Backend model — new columns on `tbl_user`:**
| Column | Type | Default | Purpose |
|---|---|---|---|
| `support_widget_enabled` | boolean | false | Master toggle |
| `support_widget_style` | varchar(20) | 'coffee' | `donation \| tip \| coffee \| support` — controls icon + vocabulary |
| `support_widget_label` | varchar(80) | null | Custom label override (else style-derived default) |
| `support_widget_preset_amounts` | jsonb | `[3, 5, 10, 25]` | Preset chips (max 5) |
| `support_widget_currency` | varchar(10) | 'USD' | Display + settle currency |
| `support_widget_min_amount` | numeric(10,2) | 1 | Floor for custom amount |
| `support_widget_allow_message` | boolean | true | Show supporter message input |
| `support_widget_thanks_message` | text | null | Custom post-tip thanks copy |

**Backend endpoints:**
- Extend `PUT /api/user/creator/profile` to accept the 8 new fields with validation
- Extend `GET /api/pay/creator/:handle` to include a `support_widget` object (only when enabled)
- **NEW** `POST /api/pay/tip { handle, amount, currency?, donor_name?, donor_message?, is_anonymous? }` — creates a contribution → returns `{ d, payment_link }`

**Frontend:**
- `CreatorPageSettings` — new "Support Widget" section (toggle, style radio with icon preview, custom label, preset chips, min amount, currency, allow message, thanks message)
- `CreatorProfile` (public /hostbay) — new `SupportWidget` component at top (above featured campaign), only when enabled
- `CreatorLivePreview` — mirror widget in the sticky preview
- i18n — ~30 new keys × 6 locales

### Open UX decisions (5 questions — awaiting user)

**Q1. Default style when widget is first enabled:**
- (a) `coffee` — Buy-Me-a-Coffee inspired ☕
- (b) `tip` — 💰 "Send a tip" (neutral)
- (c) `donation` — ❤️ "Support me" (formal)
- (d) Auto-detect from company type (nonprofit → donation, creator → coffee, freelancer → tip)

**Q2. Tip data model:**
- (a) Stand-alone `link_type='contribution'` with `parent_link_id=NULL` — clean but breaks existing FK constraint
- (b) **Lazy hidden "Tip Jar" parent** (`link_type='donation'`, `creator_page_visible=false`) auto-created on first tip. Aggregates lifetime tips per creator. **(RECOMMENDED — cleanest)**
- (c) New `link_type='tip'` variant — most semantically clear but touches many read-paths

**Q3. Frontend routing after preset amount tap:**
- (a) Immediate redirect to `/pay/{ref}` checkout
- (b) Modal on /hostbay for name/message/anonymous, THEN redirect
- (c) **Inline expansion** — name/message/anonymous appear inside the widget → single "Continue to checkout" CTA. **(RECOMMENDED — feels like BMC/Ko-fi)**

**Q4. Handle editability UX polish (from Section C):**
- (a) Just add pencil "Edit" affordance to the URL banner
- (b) Add pencil + warning modal on save ("This breaks existing shared links to old URL — continue?")
- (c) **Pencil + warning + also make display name editable inline in Creator Settings**. **(RECOMMENDED)**

**Q5. Testing strategy for the combined ship:**
- (a) One big combined frontend sweep at end covering Phase A + Support Widget + Auto-API-Key a11y
- (b) Test Support Widget standalone; Phase A + Auto-API-Key later

---

## C) Handle/Username Editability UX Improvements

### Current state
The handle IS 100% editable via `/creator` page → `CreatorPageSettings` panel:
- Live availability check (green ✅ / red ❌)
- Format validation (3-30 chars, lowercase, `-` `_`, must start with alphanumeric)
- Reserved-name blocklist (48 reserved terms: `admin`, `pay`, `api`, `dashboard`, `settings`, `creator`, etc.)
- Endpoint: `PUT /api/user/creator/profile { handle: 'new' }` — 409 on conflict, 400 on invalid format
- Public URL banner updates immediately after save

### Why user thought it wasn't editable
Looking at the current UI, the URL banner at the top of Creator Settings shows `dynopay.com/hostbay` prominently, but the "Handle" input **BELOW** it looks like a display field, not a change field. There's no "Edit handle" pencil icon, no "Change" button label, no confirmation dialog when saving a changed handle.

**Additionally:** The **display name** (shown as "hostbay" atop `/hostbay`) comes from `tbl_user.name` — currently editable only from the separate Profile page. So users may want to change their "name" but can't do it from the Creator Settings.

### Recommended UX fixes
1. Add a pencil "Edit" icon INSIDE the URL banner card — clearer affordance.
2. Show a change-warning modal on save when handle differs from saved: *"Changing your handle will break existing shared links to `dynopay.com/oldhandle`. Continue?"*
3. Add an inline "Display name" input at the top of Creator Settings (bound to `tbl_user.name`) — extend `PUT /api/user/creator/profile` to accept `name` too.
4. Client-side debounce increased from current 250ms to 400ms on availability check (avoid checking on every keystroke).

### Coupled with (B) — same delivery
This ships with the Support Widget in one PR/session because the settings page needs one visual refresh anyway.

---

## D) Auto-API-Key Provisioning — Frontend a11y + Mobile + Regression Sweep

### Background
Auto-API-Key Provisioning was shipped end-to-end across Sessions 34-36:
- Phase A backend (Session 34) — 21/21 tests passed
- Phase B frontend (Session 34) — manual browser verification
- Phase C "Try First Payment" cURL card (Session 36) — manual verification
- Sandbox enforcement hardening (Session 34+) — 21/21 tests passed

### What's pending
Item **B6** in `/app/memory/AUTO_API_KEY_PROVISIONING_PLAN.md`: **automated `auto_frontend_testing_agent` sweep covering accessibility (axe-core), mobile 390 viewport, and end-to-end regression**.

### Test areas (in the combined sweep from Section B, Q5-a)
- `/developer-keys` — Try First Payment card renders when sandbox key exists
- Masked → unmasked reveal-to-copy UX (clipboard always contains unmasked key)
- Mobile 390×844 layout (cards stack, cURL block horizontally scrollable, no clipping)
- Accessibility (keyboard nav, focus rings, aria-labels, WCAG AA contrast 4.5:1)
- i18n switching (Spanish/French) — labels translated
- Empty merchant → sandbox key auto-provisioned on first Create → card appears

---

## E) Per-User Display-Currency Override

### Background — per `/app/DISPLAY_CURRENCY_IMPLEMENTATION.md`
- **Step 1 (migration + resolver + swap 8 call-sites)** — ✅ DONE
- **Step 2 (`GET/PATCH /api/company/display-currency/:id` + Settings UI)** — ✅ DONE
- **Step 3 (per-user override — individuals in the same company can view different currency)** — ⏳ NOT STARTED

### Scope estimate
Small feature, ~150 LOC:
- Migration: `ADD COLUMN display_currency VARCHAR(10) NULL` to `tbl_user`
- Backend resolver update: `getDisplayCurrency(userId, companyId)` → chain `user.display_currency → company.display_currency → 'USD'`
- Backend endpoints: `GET /api/user/display-currency`, `PATCH /api/user/display-currency`
- Frontend: reuse `DisplayCurrencySelector` component with a user-scope prop; add to profile/settings page

### Priority
Low — company-level already covers 95% of use cases. Only needed for multi-user companies where individuals want different local views (e.g. UK employee wants GBP while company default is USD).

---

## Cross-cutting non-negotiables (all workstreams)

- ✅ Backward compatibility — no field removals, no route renames
- ✅ i18n coverage in all 6 locales (en/es/fr/de/nl/pt) — no English-only strings
- ✅ `data-testid` on every new interactive element for testing agent
- ✅ Screen-reader labels + WCAG AA contrast on all new UI
- ✅ Mobile 390 viewport tested for every new screen
- ✅ Company + Row-level permission checks respected (widget config = own user only; tip creation = public)
- ✅ Rate-limit new tip endpoint via existing `paymentRateLimiter`
- ✅ Cleanup test data after every automated run (LIVE Railway PG)
- ✅ Update `test_result.md` per protocol before/after every testing agent invocation

---

## Decision log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-07-13 (Session 38) | Confirmed A backend + frontend code shipped; frontend UI test needed | Backend 56/56 passed; frontend test aborted |
| 2026-07-13 (Session 38) | Bundled B + C in one delivery | Creator Settings page needs one visual refresh anyway; ships as one PR |
| 2026-07-13 (Session 38) | Deferred E as backlog | Low priority — company-level already covers 95% of use cases |

---

## Next actions (in order)

1. **[USER]** Answer Q1-Q5 in Section B (default style, tip data model, routing after tap, handle UX polish, testing strategy)
2. **[MAIN AGENT]** Implement Support Widget (B) + Handle UX polish (C) — bundled delivery
3. **[MAIN AGENT]** Add all new i18n keys × 6 locales
4. **[MAIN AGENT]** `next build` + service restart + `test_result.md` update
5. **[MAIN AGENT]** Invoke `deep_testing_backend_v2` for new backend endpoints
6. **[MAIN AGENT]** Invoke `auto_frontend_testing_agent` for the COMBINED sweep — Phase A donation checkout + Support Widget + Auto-API-Key a11y (per Q5)
7. **[MAIN AGENT]** After all above green, decide with user whether to ship E (per-user display currency)

---

## References
- `test_result.md` — Session 38 backend results (Phase A)
- `/app/memory/AUTO_API_KEY_PROVISIONING_PLAN.md` — item B6 status
- `/app/DISPLAY_CURRENCY_IMPLEMENTATION.md` — Rollout step 3
- `/app/memory/test_credentials.md` — QA accounts, ~30 sessions of history
