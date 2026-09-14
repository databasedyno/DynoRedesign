# Dynopay Product-Wide UX Roadmap

*Owner: main agent · Started: Session 44 (2026-07-13) · Scope: 5 phases covering checkout redesign, copy sweep, crowdfunding parity, inline pattern extension, P1/P2 backlog.*

> The product has outgrown "crypto payment gateway". It now spans creator pages, crowdfunding campaigns, invoices/tax, wallets, referrals, admin, multi-company. This roadmap brings the UX + copy up to what the product actually is.

---

## Phase 1 — Stripe-clean checkout v2 (target: Session 44-45)

**Goal:** replace the stepper on `/pay?d=<xxx>` for standard-payment + contribution links with a single-panel Stripe-style checkout. Feature-flagged so we can compare side-by-side.

### Deliverables
1. **New component** `Components/Page/Pay3Components/CleanCheckoutV2.tsx` (~600 LOC). Single scrollable panel. Sections top-to-bottom:
   - **Header**: merchant/creator name as H1 (~32px bold), amount as mono subheadline
   - **Network / Currency**: two `<Select>` dropdowns, currency filtered by network
   - **Instruction row**: "Pay 20.00 USDC on Ethereum" (one sentence, small)
   - **QR + address + amount**: 240×240 QR centered, address and amount rows below with copy buttons (mono, break-all for long addresses)
   - **Warning callout**: soft yellow, "Sending any other asset/network → permanent loss"
   - **Refund address input**: collapsible, closed by default, saved to `payment_link.refund_address`
   - **Footer**: expiry countdown + Terms/Privacy/Refund-policy links + "Powered by Dynopay"
2. **Backend addition**: `refund_address` VARCHAR column on `tbl_payment_link`; PATCH `/api/pay/setRefundAddress` accepts `{d, refund_address}` and stores. Used by the cryptoSettlement pipeline in edge cases where wrong-asset payments arrive and can be refunded.
3. **Feature flag**: `NEXT_PUBLIC_CLEAN_CHECKOUT_V2=true` (default `true` for new sessions; `false` falls back to session-38/44 stepper). Env-only override — no user toggle.
4. **Backward compat**: donation-parent flow still renders `DonationCampaign` first (with rich story from Phase 3 later); after Donate click, `CleanCheckoutV2` mounts inline instead of the stepper.
5. **Copy adapts by link_type**:
   - `payment` → "Pay {merchant}" + "Contribute with crypto" removed
   - `contribution` → "Support {campaign}" + "Contribute with crypto"
   - `tip` → today's InlineTipCheckout mode='tip' (stays as-is)
6. **Design tokens**:
   - Colors: `#0A0A0B` (ink), `#FFFFFF` (paper), `#F6F6F7` (surface), `#71717A` (muted), `#FEF3C7` (warn-bg), `#F59E0B` (warn), lime `#CCFF00` (accent only on primary CTA)
   - Typography: Inter for text, existing mono for numbers/addresses
   - Border: 1px solid `#E4E4E7`, radius 12px on panels, 8px on inputs
   - Spacing: 16/20/24 px scale — generous whitespace like Stripe

### Testing
- Frontend: preview `/pay?d=<active parent>` — verify H1 = merchant name, amount prominent, two selects, QR + address + amount copies work, refund-address collapsible expands.
- Backend: `deep_testing_backend_v2` for `PATCH /api/pay/setRefundAddress` — 200 with valid ref, 404 for bad ref.

### Success criteria
- Zero page reloads inside a checkout session.
- All 13 accepted-crypto flows still work through the two dropdowns (Network→Currency cascade).
- Underpaid/overpaid/expired/failed all render in the same single-panel style.
- Bundle size delta ≤ +15 kB for `/pay` route.

---

## Phase 2 — Copy sweep + dynamic H1s (target: Session 45-46)

**Goal:** Copy across the app catches up with the product being merchant-platform + crowdfunding + creator + wallet. All 6 locales updated.

### Deliverables

**Page-by-page copy audit + rewrite (EN reference, then all 5 other locales):**

1. **Landing** — hero re-positioning:
   - H1: "The crypto-native platform for creators, merchants, and causes"
   - Sub: "Accept crypto payments. Run crowdfunding campaigns. Get paid to your wallet in under a minute — no custody, no chargebacks."
   - Triple CTAs: "Start accepting" / "Launch a campaign" / "See how it works"
2. **Onboarding** — step titles + hints reflect broader product (add "You can also run crowdfunding campaigns")
3. **Dashboard empty states** — 5 surfaces (payment-links, transactions, wallets, customers, invoices) get personality
4. **`/create-pay-link`** dynamic:
   - Link type card selected → H1, live preview title, and CTA all change:
     - `payment` → "Create a payment link" / preview: "Complete your payment" / CTA: "Create link"
     - `donation` → "Start a crowdfunding campaign" / preview: "Support this campaign" / CTA: "Publish campaign"
5. **Checkout** — donor-vs-payer wording:
   - "donor" → "contributor" (crowdfunding)
   - "payer" → "customer" (standard payment)
   - "Complete your donation" → "Complete your contribution"
   - "Donate with crypto" → "Contribute with crypto" (crowdfunding) / "Pay with crypto" (payment link)
   - Reference label: "INVOICE" for payment links, **"REFERENCE"** for contributions
6. **Emails — full audit across all 6 locales** — templates to audit (subject + heading + intro + outro for donation-vs-payment separation):
   - `paymentReminder` — donation contributions shouldn't get "your payment is due" reminders
   - `paymentExpiring` — same
   - `paymentReceived` — donation contribution = "New contribution received" not "Payment received"
   - `refund` — different verbiage for donation refunds
   - `dispute` — same
7. **Error toasts** — replace 30+ generic "Something went wrong" with domain-specific messages
8. **Success confirmations** — checkout-done, link-created, wallet-added, etc. — align tone

### Success criteria
- Zero user-facing string still says "payment link" when the object is actually a crowdfunding campaign.
- 6 locales in sync (translation keys added everywhere; empty locales fall back to EN).
- Grep audit: no "donation" outside crowdfunding contexts (product noun stack: campaign / contribution / contributor / organizer).

---

## Phase 3 — Crowdfunding "GoFundMe-lite" P0 (target: Session 46-48)

**Goal:** Bring crowdfunding to feature parity with the parts of GoFundMe that materially drive contribution volume.

### DB schema additions (new columns on `tbl_payment_link` where `link_type='donation'` + new tables)

| Column / Table | Purpose |
|---|---|
| `donation_story_md TEXT` | Full markdown campaign body |
| `donation_gallery JSONB` | Array of `{url, caption, order}` |
| `donation_ends_at TIMESTAMPTZ` | Optional campaign end date (for countdown) |
| `donation_beneficiary JSONB` | `{name, description}` — beneficiary distinct from organizer |
| `donation_category VARCHAR` | medical/community/creative/emergency/education/other |
| `donation_organizer_thanks TEXT` | Custom thank-you shown post-contribution |
| `tbl_donation_tier` | Milestone reward tiers (id, campaign_link_id, min_amount, title, description, image, order) |
| `tbl_donation_update` | Organizer posts (id, campaign_link_id, title, body_md, image, published_at) |
| `tbl_donation_organizer_reply` | Reply to a specific contribution (contribution_link_id, body_md, replied_at) |
| `tbl_donation_team_member` | Co-organizer invites (campaign_link_id, user_id, role, invited_at, accepted_at) |
| `tbl_donation_wall_entry` (VIEW or query) | Public read-projection of contributions with donor_name/amount/message |

### Features
1. **Rich story editor** — Markdown, image inline uploads, section headings. Reuse existing image upload pipeline. Preview + edit tabs.
2. **Cover + photo gallery** — up to 6 images, drag-to-reorder, captions.
3. **Public donor wall** — infinite-scroll list on campaign page: avatar/initial, "$50 from Sarah — Praying for a full recovery 🙏 — 2h ago". Filter: All / Top / Recent. Organizer reply thread.
4. **Updates feed** — organizer posts updates ("Day 5: We hit $2K! Thank you!"). Emails to all past contributors (opt-out). Shown as feed on campaign page + a "Get updates" subscribe box for non-donors.
5. **Milestone tiers** — organizer defines tiers ("Donate $50 → your name on the wall", "Donate $500 → signed print"). Shown as cards on campaign page. Contribution flow auto-tags the tier.
6. **Team fundraising** — invite co-organizers by email; they can post updates + reply to donors (but not withdraw funds unless promoted). Owner remains sole withdrawal authority.
7. **Beneficiary transparency** — form asks "Are you fundraising for yourself, someone else, or an org?" — shows separate "Organizer" and "Beneficiary" blocks on campaign page.
8. **End date + countdown** — reuses `expires_at` schema; renders "Ends in 12 days" pill.
9. **Category + directory (opt-in)** — organizer picks a category; opt-in checkbox "List my campaign in the public directory". Directory page `/campaigns` shows featured + browse-by-category.
10. **Auto thank-you** — custom message + auto-email sent after each contribution.

### Testing
- Backend: CRUD for each new table + updated donation-parent creation.
- Frontend: campaign page renders rich story, gallery, wall, updates, tiers; edit mode for organizer.

### Success criteria
- Organizer can build a rich campaign page in ≤ 10 minutes without leaving the browser.
- Contributor sees 6+ trust signals on the page before deciding to contribute (photos, story, wall, updates, tiers, org info).
- Public directory `/campaigns` browsable.

---

## Phase 4 — Inline pattern extension (target: Session 48-49)

**Goal:** apply the inline drawer/modal pattern to 5 high-friction merchant flows.

### Deliverables
1. **`Components/UI/Drawer/index.tsx`** — reusable right-side drawer primitive (width 480px desktop / full-screen mobile), focus-trap, ESC close, url-syncable state (`?drawer=create-link`).
2. **Create payment link drawer** — replaces `/create-pay-link` route as primary path (route stays as canonical URL). Dashboard stays visible; new link appears in the table without reload.
3. **Send invoice drawer** — on `/customers/:id`, "Send invoice" opens drawer with amount + description + due date + Send button.
4. **Wallet send drawer** — on `/wallet`, "Send" opens drawer with network + address + amount + confirm.
5. **Inline share sheet** — on campaign page + link detail: opens a drawer with X/WhatsApp/Telegram/Email/Copy/Embed-code (iframe snippet).
6. **Donor wall drawer** — on the campaign management page, "View all contributions" opens a drawer with filters + reply UI.

### Success criteria
- Merchant creates 3+ payment links in a session without ever leaving the dashboard.
- Drawer feels native (240ms slide, backdrop dim, ESC/click-outside close, focus trap).
- Deep-link into a drawer state via `?drawer=…` works (share links).

---

## Phase 5 — Backlog / P1-P2 (target: Session 50+)

Ordered by ROI:

1. **Recurring monthly contributions** on campaigns (P1)
2. **Match campaigns** — "1:1 match up to $500" (P1)
3. **Video embed** in campaign story (P2)
4. **Verification badge** for organizers (P2)
5. **Fraud reporting** — "Report this campaign" (P2)
6. **Anonymous shy mode** — public name, hidden amount (P2)
7. **Landing page A/B copy variants** (P1)
8. **Dashboard analytics** for creators — top contributors, funnel, referral sources (P1)

---

## Cross-cutting concerns

### Feature flags
Each phase ships behind a flag so we can roll back:
- Phase 1 → `NEXT_PUBLIC_CLEAN_CHECKOUT_V2`
- Phase 3 → `NEXT_PUBLIC_CROWDFUNDING_V2` (rich story + wall + updates)
- Phase 4 → `NEXT_PUBLIC_INLINE_DRAWERS`

### Testing gates
- After Phase 1: manual + `deep_testing_backend_v2` for refund_address endpoint.
- After Phase 2: EN-only visual sweep + i18n key coverage grep.
- After Phase 3: `deep_testing_backend_v2` for all new tables/endpoints + own Playwright for campaign creation happy path.
- After Phase 4: manual drawer QA on desktop + mobile 390.

### Data migration
- Phase 1: 1 new column (`refund_address`), backfill NULL.
- Phase 3: 5 new columns on `tbl_payment_link` + 5 new tables. Idempotent migration script `backend/scripts/migrate_crowdfunding_v2.ts`.
- No destructive changes; existing data untouched.

### Rollout order (safest → riskiest)
Phase 1 (checkout redesign, self-contained) → Phase 2 (copy, no logic) → Phase 3 (crowdfunding, DB changes) → Phase 4 (drawers, infra).

---

## Current status

- **Phase 1** — ✅ COMPLETE (Session 44). CleanCheckoutV2 shipped behind `NEXT_PUBLIC_CLEAN_CHECKOUT_V2=true`. Live-tested on `/pay?d=<standard_link>` + `/pay?d=<contribution>` in both desktop (1440) and mobile (390) — all sections render (H1, amount, network/currency selects, QR, warning, address+amount rows, refund toggle+input, timer, footer). See Session 44 note in `/app/test_result.md`.
- **Phase 2** — ✅ COMPLETE (Session 44). Copy sweep across all 6 locales — landing hero repositioned, checkout donor-vs-payer normalised, LivePreview hint updated, noun stack aligned.
- **Phase 3.1** — ✅ COMPLETE (Session 44). GoFundMe-lite P0 features: rich Markdown story (custom XSS-safe renderer), photo gallery, countdown pill, category pill, beneficiary block, organizer thank-you field, refund address endpoint. DB + backend + edit form + public rendering. Live-tested on the $10k "Support Dynopay" campaign.
- **Phase 3.2** — ✅ COMPLETE (Session 44). Crowdfunding tiers + updates feed + expanded donor wall + organizer replies:
  - **DB**: `tbl_donation_tier` + `tbl_donation_update` tables (idempotent migration in `backend/scripts/add_crowdfunding_v2_tables.js`). `organizer_reply` + `organizer_reply_at` columns on `tbl_payment_link` for contribution replies.
  - **Sequelize models**: `donationTierModel.ts` + `donationUpdateModel.ts`.
  - **Backend controller**: `backend/controller/payment/crowdfundingController.ts` — 10 endpoints (create/update/delete/list for tiers + updates; paginated public donor wall with sort=recent|top; organizer reply). Owner-only guarded via `res.locals.user` from `authMiddleware`; wrong-owner returns 403.
  - **Routes**: `paymentRouter.ts` — 10 new routes under `/api/pay/campaign/:refOrId/*` and `/api/pay/{tier,update,contribution}/:id/*`.
  - **`cryptoCheckout.ts` getData**: inlines tiers + updates in the `donation` block so the campaign page renders both without extra fetches.
  - **Public campaign page**: `DonationCampaign.tsx` renders (a) REWARD TIERS cards with gift icon + green amount pill + description, (b) UPDATES feed with post title + relative time + Markdown-rendered body (each update in its own card).
  - **Live-tested end-to-end**: `POST /api/pay/campaign/77/tiers` creates a "Champion" tier ($1,000+) → renders in the UI on refresh. `PATCH /api/pay/tier/1` updates the description → renders in UI. `POST /api/pay/campaign/77/updates` + `DELETE /api/pay/update/:id` work. Wrong-owner test returns 403 "You are not the organizer of this campaign."
  - **Merchant editor UI for tiers/updates**: DEFERRED to Phase 3.3 (currently accessible via API/DB seed).
  - **Email fan-out on notify_contributors=true**: DEFERRED to Phase 3.3 (endpoint accepts the flag but doesn't yet send emails — logs a TODO).
- **Phase 3.3 remaining** — merchant editor UI for tiers/updates, email fan-out for updates, team fundraising (co-organizers), campaign directory `/campaigns`, recurring monthly contributions.
- **Phase 4-5** — spec ready, not started.
