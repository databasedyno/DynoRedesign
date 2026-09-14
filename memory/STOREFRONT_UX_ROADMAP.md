# Storefront + Crowdfunding UX Roadmap (Session 50, 2026-07-14)

> Companion to `/app/memory/PRODUCT_CATALOG_SPEC.md` and `/app/memory/CREATOR_UX_ROADMAP.md`.
> Owner: Main agent · Status: Phase A in flight · Last updated: 2026-07-14

---

## 1 — Where we stand today (audit)

### 1.1 Backend features — ALL BUILT ✅

Session 44 delivered the full **GoFundMe-lite** feature set. All endpoints are live in production (`https://dynopay.com`) after session-50 env patch.

| Feature | Table / endpoint | Status |
|---|---|---|
| Campaign metadata (goal, deadline, category, cover, gallery) | `tbl_payment_link` (donation type) | ✅ |
| Markdown story | `tbl_payment_link.description_md` | ✅ |
| Photo gallery ≤12 | `tbl_payment_link.gallery` JSONB | ✅ |
| Reward tiers | `tbl_donation_tier` + `/pay/campaign/:id/tiers` CRUD | ✅ |
| Updates feed | `tbl_donation_update` + `/pay/campaign/:id/updates` CRUD | ✅ |
| "Email all contributors" | `notify_contributors=true` → `fanOutUpdateEmail()` | ✅ |
| Donor wall (public + anonymous option) | `/pay/campaign/:id/wall` | ✅ |
| Organizer reply on donations | `organizer_reply` col + `setContributionReply` endpoint | ✅ |
| Feature flag on prod | `NEXT_PUBLIC_CLEAN_CHECKOUT_V2=true` (added session 50) | ✅ |

### 1.2 Frontend surface — functional but visually thin

| Surface | LOC | Assessment |
|---|---|---|
| `pages/[handle]/shop.tsx` | 162 | **basic** — MUI card grid, no hero, no filters, no sort, no ribbons, no social proof, empty state = plain sentence |
| `pages/[handle]/p/[slug].tsx` | ~250 | **basic** — no sticky-buy sidebar, no zoom, no reviews stub, no cross-sell |
| `Components/Page/Pay3Components/donationCampaign.tsx` | 1,036 | **feature-rich but flat** — solid MUI LinearProgress goal bar, vertical tier stack, plain donor list, no share tray, no urgency states |
| `Components/UI/pay-link/CampaignManager.tsx` (organizer) | 653 | **functional** — tabs work but visual density is low |

### 1.3 Gap analysis vs. GoFundMe / Kickstarter / Gumroad

Missing on public campaign page:
- Milestone flags on goal bar (25/50/75/100 %) + floating % pill on fill
- Reward tier "shelf" (horizontal scroll, sticky "Pledge $X" CTA)
- Countdown urgency states (green > 7 d, amber < 3 d, red < 24 h)
- Share tray (X / Threads / WhatsApp / Copy link with dynamic OG image)
- Donor avatars, city/country, top-donors medals, realtime pulse dot
- Author avatar + relative timestamp on updates, reactions
- Confetti on successful donation
- Embed-widget snippet for owner to drop on their own site

Missing on shop:
- Merchant cover / brand banner
- Category + type filters, sort dropdown
- Featured product hero card
- Ribbons ("New", "Trending", "N sold")
- Trust chips (verified, N supporters, country flag)
- Rich empty state (illustration + CTAs)
- Product-list JSON-LD + per-store JSON-LD

Missing on product page:
- Sticky buy-box on desktop
- Image gallery lightbox + zoom
- Reviews stub / "0 reviews · be the first"
- Related products
- FAQ block

---

## 2 — Phased roadmap

### PHASE A — Shop transformation (**in progress — session 50**)

**Goal:** turn `/[handle]/shop` from a bare grid into a merchant-branded storefront that rivals Gumroad + Beacons.

**Deliverables:**
1. **Brand hero** — cover gradient + avatar ring + name/@handle/bio + product-count + total-sold-count + share tray
2. **Toolbar** — product-type chips (All / Digital / Physical / Service) + category chips (dynamic) + sort dropdown (Featured / Best selling / Newest / Price ↑ / Price ↓) + result count
3. **Featured card** — if a product has sold_count >= threshold or is first, render as large 2/3-width card with darker treatment
4. **Card system v2** — ribbon overlay ("🔥 Trending", "N sold"), price prominence, hover zoom + darken, "View" CTA
5. **Empty state** — SVG illustration inline + 3 tile CTAs (Add first product · Launch a campaign · Enable tips)
6. **SEO** — ItemList JSON-LD + Store JSON-LD + og:image fallback chain
7. **A11y** — semantic `<nav>` for filters, aria-labels on ribbons, keyboard-navigable sort

**Files to touch:**
- `pages/[handle]/shop.tsx` — thin SSR wrapper, keep `getServerSideProps`
- `Components/Page/Shop/ShopClient.tsx` — NEW client-side interactive shell
- `Components/Page/Shop/ShopHero.tsx` — NEW brand hero
- `Components/Page/Shop/ShopToolbar.tsx` — NEW filter/sort bar
- `Components/Page/Shop/ProductCard.tsx` — NEW reusable card (variant='regular'|'featured'|'compact')
- `Components/Page/Shop/ShopEmpty.tsx` — NEW empty state
- `Components/Page/Shop/index.ts` — barrel

**No backend changes required for Phase A** — existing `/api/shop/:handle` response already ships all needed fields.

**Testing:**
- Preview URL `/hostbay/shop` (hostbay merchant has 1 live seed product `test-ebook-setup-guide` at $5)
- Verify 200 + no console errors
- Verify filter chips filter grid
- Verify sort dropdown reorders
- Verify empty state renders when merchant has 0 products
- Playwright: capture screenshot mobile 390 + desktop 1440 in both light + dark themes

**Definition of done:**
- Frontend testing agent verifies filter/sort/empty/hero all work + no regressions
- Lighthouse mobile perf ≥ 85 (no heavy client JS)
- Dark mode: no white flashes, all text WCAG-AA

### PHASE B — Crowdfunding polish (**shipped — session 50**)

**Delivered:**
- ✅ Redesigned **goal bar** (`GoalProgressBar.tsx`, 205 LOC): milestone tick marks + labels (0/25/50/75/100), lime→green gradient fill, animated shimmer ribbon on leading edge, floating "N% funded" pill (turns emerald 🏆 pulse when goal reached).
- ✅ **Reward tier shelf** (`RewardTierShelf.tsx`, 289 LOC): horizontal snap-scroll with ← → buttons, "★ Most popular" ribbon on middle tier, sticky "Pledge $X" CTA per card. Clicking a pledge autofills the amount + smooth-scrolls to the donate form.
- ✅ **Countdown urgency** (`CountdownPill.tsx`, 130 LOC): 4 severity states — calm-green >7 d, notice-amber 3-7 d, urgent-orange <3 d, critical-red pulsing <24 h. Re-ticks every 60 s while visible.
- ✅ **Donor wall v2** (`DonorWallV2.tsx`, 218 LOC): deterministic-hue colored avatar circles, 🥇 🥈 🥉 medal ribbons on top-3 donors by amount (with lime-tinted card tint), "just now / 5m ago / 3h ago / 2d ago" relative times, messages rendered in italic quotes.
- ✅ **Share tray** (`CampaignShareTray.tsx`, 175 LOC): X / Threads / WhatsApp / LinkedIn / Copy link with pre-composed message. Renders under progress stats.
- ⏭ Confetti on donation completion — deferred to Phase D (canvas-confetti already in package.json).
- ⏭ Embed widget iframe — deferred (needs a new /embed/campaign/:id route).
- ⏭ "N others viewing" realtime counter — deferred (needs Redis wiring).

**Files added:**  `Components/Page/Pay3Components/campaign/{GoalProgressBar,CountdownPill,RewardTierShelf,DonorWallV2,CampaignShareTray,index}.{tsx,ts}` — total ~1,020 LOC across 6 files.

**Files modified:**  `Components/Page/Pay3Components/donationCampaign.tsx` — 4 surgical `search_replace` edits: imports, ref for scroll-to-donate, `handlePledgeTier` handler, then swapping the inline JSX for the 5 new child components + share tray. Removed the unused `barValue` state and its `useEffect` (now owned by GoalProgressBar).

**Verified:**  `/pay/donation-demo` renders all new components on light + dark, no hydration mismatch, no console errors. Screenshots: `/tmp/campaign_v2_top.png`, `/tmp/campaign_v2_middle.png`, `/tmp/campaign_dark_goalreached.png` (celebration state with emerald bar + 🏆 pulse pill).

### PHASE C — Product detail glow-up (queued)

1. Sticky buy-box on desktop right rail
2. Gallery with keyboard-nav lightbox (`react-image-lightbox` or lighter custom)
3. Reviews stub — "0 reviews · Be the first" with future extension seam
4. "You may also like" — 3 more products from same merchant
5. Trust bar — "N supporters · Instant delivery · Money-back if delivery fails"
6. FAQ block (product FAQ = new `tbl_product_faq` or JSONB col — deferred until requested)

### PHASE D — Motion + polish (queued)

1. Framer-motion enter-in for hero + card grid (stagger 40 ms)
2. Skeleton loaders on shop grid + campaign page (avoid CLS)
3. Confetti on donation completion (see B7)
4. Smooth theme transitions (no flash)

---

## 3 — Non-goals (out of scope for this roadmap)

- New product types (physical/service delivery flow — already scoped in `PRODUCT_CATALOG_SPEC.md`)
- Multi-merchant marketplace / cross-store browsing
- Multi-currency price display (single currency = merchant's chosen one)
- Native mobile app / PWA install prompts (later once web polish is done)

---

## 4 — Success metrics

Per phase, we'll measure:

| Phase | Metric | Baseline (est.) | Target |
|---|---|---|---|
| A | `/{handle}/shop` bounce rate | ~75 % | < 55 % |
| A | Add-to-cart CTR from grid | ~4 % | > 10 % |
| B | Donation completion rate (form open → paid) | ~12 % | > 20 % |
| B | Repeat donor rate (donate 2× within 30 d) | ~6 % | > 12 % |
| C | Product page → checkout CTR | ~6 % | > 15 % |

Metrics tracking is not yet wired — will add server-side event logs to `tbl_analytics_event` in Phase D as part of the polish work.

---

## 5 — Design references (aesthetic direction)

Awaiting user input on the exact references. Working baseline until otherwise directed:
- Shop: **Gumroad** creator page + **Beacons.ai** feel
- Campaign: **GoFundMe** goal bar + **Kickstarter** reward shelf
- Product detail: **Substack** simplicity + **Gumroad** buy-box

Once user confirms references, the aesthetic tokens will be locked into `/app/styles/homeTheme.ts` as a shared `storefrontTheme` export.
