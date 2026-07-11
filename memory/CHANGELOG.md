# Changelog

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
