# Auth + Onboarding visual overhaul — 2026-09-28 (fork pt11)

USER CHOICES: scope = auth (/auth/login, /auth/register, /reset-password, dialogs) + /get-started wizard; approach = restyle SHARED shells only (auth logic untouched); brand panel = editorial animated "money flows straight to your wallet" scene; verify light + dark.

FILES CHANGED (frontend only, no backend):
- Containers/Login/styled.tsx — AuthPageBackground (ambient gold+aqua radial glow on solid canvas + GRAIN_URL ::before, overflow-x clip), FormPanel/CardWrapper = glass (blur 24, rgba surface, gold top bloom ::before, authRise entrance) + auth-scoped input polish (`& .MuiOutlinedInput-root` radius 12px !important, gold focus ring). Exports AUTH_RISE_KEYFRAMES/authRise. SplitScreenWrapper maxWidth 1180 gap 64; form column 460.
- Components/UI/AuthLayout/AuthBrandPanel.tsx — REWRITTEN: SCENES tip/order/donation cycle 4.2s (keyed slide-in), Dynopay bolt rail with falling coin dots, wallet card with count-up balance (rAF, reduced-motion safe) + "+$X · settled on-chain" chip 1.1s after each scene. testids kept: auth-brand-panel, auth-brand-carousel (data-scene), auth-brand-dot-{0,1,2}; new: auth-brand-scene-<key>, auth-brand-wallet, auth-brand-balance. Only honest stats (9 blockchains · fees from 0.5% · instant settlement). MUI icons only (no iconify runtime fetch).
- Components/UI/AuthLayout/TrustStrip.tsx — glass stat chips (mono values) + coin tray; testids unchanged.
- Components/UI/AuthLayout/PurposePicker.tsx — glass tiles, gradient icon box, hover -2px, staggered authRise; testids unchanged.
- Components/UI/AuthLayout/TitleDescription/index.tsx — title now --font-hero 800 26/23px.
- pages/auth/register.tsx — progress indicator: mono STEP label + gradient segments (register-progress-seg-N data-reached).
- Components/Page/GetStarted/WizardShell.tsx — ambient glow, mono eyebrow "Getting started", hero title, glass rail (numbered 01–05 chips: gold active / aqua→green done), gradient phone stepper w/ gold step pill, glass content card w/ grain. All gs-* testids unchanged. Exports wizardGlass().
- Components/Page/GetStarted/StepChrome.tsx — StepHeader (gold-dot mono eyebrow, hero h2), StepFooter (pill buttons, outlined ghost Back).
- Components/Page/GetStarted/ProgressRing.tsx — gold→aqua gradient stroke (useId gradient id), glow.

OPS: FE = PRODUCTION build. Rebuild: `cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` (~3.5 min, background) then `supervisorctl stop frontend && rm -rf .next-prod && mv .next-prod-new .next-prod && supervisorctl start frontend`.

QUICK AUTHED SCREENSHOT RECIPE: API login (POST /api/user/login → challenge_token → POST /api/user/2fa/validate with `node backend/scripts/print_totp.cjs 1`) → inject localStorage token + sessionStorage mfa_interstitial_seen=1 → /get-started?step=about.

FOLLOW-UP AGREED WITH USER (option a): after this UI work, close SafeDeal admin-alert Caveat 2 — services/safedeal/safedealCheckout.ts:332 and services/safedeal/safedealEscrowLedger.ts:23/29 create customers (createIfMissing:true) WITHOUT onCreate → first-ever SafeDeal customers created via guest checkout / ledger never trigger notifyAdminNewSafeDealUser (controller/safedealController.ts:123). Fix = pass onCreate → admin notify (method "checkout"/"ledger"), restart backend, verify with a throwaway *@example.com customer then delete it.
