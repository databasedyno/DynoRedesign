# Changelog

## 2026-07-11 (session 27d) — Landing refresh (creator vanity mockup) + /pay checkout lime polish

**Landing — surface Creator vanity pages** (`Components/Page/Home/UseCasesBento.tsx`)
- Replaced the old `MockPayLink` ("dynopay.me/ava-designs · one-time payment · $12") with new `MockCreatorPage`: avatar (lime ring, "A") + "Ava Designs" + "3 links · 128 supporters", a `dynopay.com/ava-designs` URL pill (lime handle), and a lime "Support my work →" CTA. Surfaces the new creator feature on the "Digital creators" use-case card.
- Copy updated in all 6 locales (`langs/locales/*/landing.json`): `useCase2Tag` "Wallet stats" → "Creator page"; `useCase2Description` → "Claim your own dynopay.com/handle and get paid with tips, donations and one-tap links."

**Standard /pay checkout — visual + UX polish (matches landing/donation)**
- Rebranded selection + primary CTA accents to brand lime `#CCFF00` (ink `#0A0A0B` text), matching landing & donation. Green (`#10B981/#12B76A`) kept ONLY for payment-detected/confirmed success states.
  - `pages/pay/index.tsx`: step-0 "Pay with Cryptocurrency" CTA → lime.
  - `Components/Page/Pay3Components/cryptoTransfer.tsx`: added ACCENT/ON_ACCENT/ACCENT_SOFT consts; coin tile + USDT/RLUSD network tile selected states → lime.
  - `pages/pay/demo.tsx`: mock step-0 CTA → lime (landing TryItNow embed + standalone consistency). Success/confirm buttons left green.
- Functional UX (additive, no payment/rate/polling logic changed):
  - (a) Low-fee hint under USDT networks: "TRC-20 usually has the lowest network fees." (`data-testid="lowfee-hint"`).
  - (c) Address row is now tap-to-copy (`data-testid="copy-address-row"`, hover lime border) + existing copy buttons kept.
  - (b/d) Trust strip below the QR/address card (`data-testid="checkout-trust-strip"`): "Funds go directly to the merchant · amount locked until the timer ends" (new keys `crypto.lowestFeeHint`, `crypto.trustNote` use defaultValue fallback).

**Verified:** full `next build` (standalone) passes + restarted. testing_agent (frontend, iteration_26.json) = 100%, 0 console errors on landing & /pay/demo. Evidence: creators "Support my work" btn rgb(204,255,0)/text rgb(10,10,10); demo CTA lime "Pay with Cryptocurrency"; real crypto screen (verified via temp `/pay/crypto-preview`, since removed): USDT tile lime border+bg, lowfee-hint renders; donations bar lime; dark-mode landing OK.

**Observation (pre-existing, NOT this task):** `/pay/demo` (and likely the real /pay checkout) page body stays light when the header theme toggle is switched to dark — MUI theme for the pay route may not follow the toggle. Lime CTAs stay legible. Flagged for a future dark-mode-checkout pass if desired.

## 2026-07-11 (session 27c) — Creator vanity pages (dynopay.com/{handle})

**DB (LIVE prod, additive migration — user approved):** `backend/migrations/addCreatorHandle.ts` added `handle` VARCHAR(50), `bio` VARCHAR(500), `creator_page_enabled` BOOLEAN to `tbl_user` + partial unique index `idx_tbl_user_handle_lower` on `LOWER(handle)`. Idempotent (`IF NOT EXISTS`). Model updated (`userModel.ts`). Verified columns exist.

**Backend endpoints:**
- Auth'd: `GET /api/user/creator/check-handle?handle=x` + `PUT /api/user/creator/profile` (userController `checkHandle`/`updateCreatorProfile`). Validation: 3–30 chars `^[a-z0-9][a-z0-9_-]{2,29}$`, lowercase, RESERVED_HANDLES guard (auth/admin/pay/fees/blog/etc.), case-insensitive uniqueness. Clears `profile:{id}` Redis cache on save. Routes in `userRouter.ts`.
- Public: `GET /api/pay/creator/:handle` (paymentLinkController `getCreatorProfile`, mounted on public `paymentRouter`). Returns `{creator:{name,handle,bio,photo}, links:[...]}` — user's donation campaigns (with raised/supporters/progress via `getDonationAggregates`) + reusable `createLink` links, expired filtered out, donations first.
- `getProfile` already returns handle/bio/creator_page_enabled (spreads dataValues).

**Frontend:**
- `pages/[handle].tsx` — root SSR catch-all, `getServerSideProps` fetches `${NEXT_PUBLIC_BASE_URL}/api/pay/creator/{handle}` → notFound on 404. `layout='home'` (public; default layout is auth-gated `client`). Dynamic per-creator OG/Twitter meta (og:type=profile) with `key` dedupe.
- `Components/Page/Creator/CreatorProfile.tsx` — avatar (lime ring), name, @handle (mono), bio, featured donation "Support" card (progress + CTA), link cards grid, empty state, "Powered by Dynopay".
- `Components/Page/Creator/CreatorPageSettings.tsx` — Settings → new "Creator page" section: handle input (dynopay.com/ prefix + debounced availability check + tick/cross), bio, publish toggle, live URL banner (copy + view). Fetches profile via `UserAction(USER_PROFILE_FETCH)` (raw action doesn't trigger saga — saga watches USER_INIT+crudType). Seeds only when `profile.user_id` present (empty `{}` default was seeding blank).
- `_app.tsx` OG/Twitter meta now all have `key`s so per-page (creator/SEO) Head overrides dedupe (fixed duplicate og:title/og:type).

**Verified:** migration + columns; all 3 endpoints via curl (check→claim→public); `/hostbay` SSR 200 + single OG tags + renders (empty-state); unknown handle → 404; existing routes (/fees,/settings) intact; settings section renders + seeds handle "hostbay" (Playwright + minted JWT — prod login is OTP-gated). NOTE: set test user hostbay@moxx.co handle="hostbay", page enabled, on LIVE DB → public at /hostbay.

**Still pending (user order after creator = 1,2,3):** 1) standard /pay checkout polish, 2) landing refresh, 3) dynamic OG for shared pay/donation links. Login-bounce fix still PREVIEW-only (deploy to go live).

## 2026-07-11 (session 27b) — Brand assets, chat chips, donation checkout redesign, copy fixes

**Branding / SEO**
- New favicon: ink `#0A0A0B` rounded square + lime `#CCFF00` wave mark (no more blue). Regenerated favicon.ico (PNG-in-ICO), favicon-16/32, apple-touch (`dynopay-favicon.png` 180), favicon-512. Generator: `/tmp/gen_brand.js` (uses exact mark path from `assets/Icons/Logo.tsx`).
- New rich link-preview card `public/og/dynopay-og.png` (1200×630, real wordmark + "Accept crypto payments in minutes." + coins + dynopay.com). Wired into `_app.tsx` OG + Twitter meta with `key` dedupe + og:image width/height. JSON-LD `logo` now uses square `favicon-512.png`.
- "13 chains" → "15+ chains" (StatWall, ChainsMarquee, HeroSwiss + comment).
- Footer copyright → "© {{year}} Dynotech. All rights reserved" (all 6 locales; dropped "Innovations, LDA").
- Fixed dangling SEO headings: `HomeSectionTitle` only highlights when `title` CONTAINS `highlightText`; SEO pages passed them separately. Fixed `title` to include the highlight in `SEOLandingPage.tsx` ("…to start accepting crypto", "Live in under 10 minutes").

**Support chat**
- Added 4 one-tap quick-reply chips under the greeting (`SupportChatWidget`); `send()` refactored to accept an optional message. Help page "Chat with us" CTA opens the widget (verified panel opens).

**Donation / Crowdfunding checkout redesign** (`Components/Page/Pay3Components/donationCampaign.tsx`)
- Rebuilt to crowdfunding-platform quality per design_agent blueprint (`/app/design_guidelines.json`): hero cover, big mono raised amount, animated lime progress bar, "% funded" lime pill (black text), mono stat row (supporters / funded / to-go), two-column layout (supporters wall left, sticky glass donate form right; column-reverse on mobile so the form is on top).
- Accent hardcoded to brand lime `#CCFF00` (pay theme's `palette.primary` is ink, NOT lime — earlier caused black pill/bar/button). All other colors theme-derived (works light+dark). Logic & all data-testids preserved.
- Added `pages/pay/donation-demo.tsx` (permanent QA preview, matches success-demo pattern; scenarios: crowdfunding/tip-jar/goal-reached).
- Verified: progress bar renders lime at 65% (aria-valuenow=65, bg rgb(204,255,0)); layout + pill correct.

**Answered (no code needed):** Google/GitHub users don't need a password or login OTP; if they want email+password too, Settings → Profile & Security already shows "Set password" (OTP-verified) via `UpdatePassword.tsx` (`has_password` false).

**PENDING (confirmed with user, not yet built):** standard payment checkout polish; creator vanity pages `dynopay.com/{handle}` (needs prod-DB migration — users table already has `username`+`referral_code`, migrations dir exists, no auto-sync on boot); dynamic OG for pay/donation/creator (SSR); landing-page refresh. Login-bounce fix is in PREVIEW only — needs prod deploy.

## 2026-07-11 (session 27) — Login bounce fix, Google popup, Profile/Settings merge, Help refresh

**🔴 P0 — "Login successful but stuck on login page" (iPhone, intermittent) — FIXED**
- Root cause (found via DigitalOcean prod RUN logs for the iPhone attempt): `POST /api/user/login → 200`
  (token issued server-side), the dashboard chunk loaded, then a **full-document** `GET /auth/login`
  (referer /dashboard) fired with **zero** authenticated API calls in between. i.e. `withAuth`
  (wrapping `ClientLayout`) read `localStorage.getItem("token")` as **null** on the freshly-loaded
  dashboard and redirected — an iOS Safari/Chrome localStorage write-visibility race right after the
  client-side SPA navigation.
- Fix: `Components/Page/Common/HOC/withAuth.tsx` — on first mount, retry the token check up to
  8× / 120ms (~960ms grace) and also react to cross-tab `storage` writes before redirecting to
  `/auth/login`. Hardened `pages/auth/login.tsx` post-login nav to only `router.replace("/dashboard")`
  once the token is confirmed in localStorage.
- Verified (Playwright + minted JWT): logged-in `/dashboard` stays put; logged-out `/dashboard`
  still redirects to `/auth/login`.

**Google sign-in stays on the SAME page (no "new page")**
- `pages/auth/login.tsx`: `handleGoogleLogin` now always uses the Google Identity Services popup
  token flow, briefly polling (≤2.5s) for the async GIS script to load, and **removed the
  `signIn("google")` full-page-redirect fallback** (that was the "new page"). Removed now-unused
  `next-auth/react` `signIn` import. Verified: clicking Google keeps URL on `/auth/login` and opens
  a popup.

**🟠 P1 — Profile & Settings consolidated**
- `/profile` now permanently client-redirects to `/settings?section=profile` (`pages/profile.tsx`).
- Removed the redundant "Profile" item from the desktop `UserMenu`; repointed the mobile
  `Header` drawer and legacy `Sidebar` profile links to `/settings?section=profile`.
- Verified: `/profile` → `/settings?section=profile` renders the Profile & Security section.

**Help & Support refresh + Chat CTA**
- `Components/Page/HelpAndSupport/index.tsx`: replaced hardcoded `#4F46E5`/fixed-px widths with
  theme-driven, responsive CSS-grid layout (article cards + search). Added a "Chat with us" primary
  CTA that dispatches `dynopay:open-support-chat` to open the existing AI support widget, alongside
  an "Email us" card. Verified: CTA opens `support-chat-panel`.

**Not a code change**
- GitHub authorize-screen logo is set in the user's GitHub OAuth App settings (they will upload it).
