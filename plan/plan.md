# Dynopay Onboarding Reset — Standard Sign-up & Login

Replace the custom multi-branch sign-up (purpose picker → email → name-on-code-screen → confetti → vertical wizard) with the three-screen pattern every major exchange and payments platform uses: Email → 6-digit code → set password & name → in. Login becomes the visual and behavioural sibling of sign-up, and the landing hero hands visitors straight to the code screen.

## Who it's for

- New merchants, creators and fundraisers arriving from the landing page, SEO pages or a referral link who expect sign-up to work the way Binance, Bybit, Coinbase or Stripe do.
- Returning users who want a familiar email + password login (with the existing "email me a code instead" fallback and 2FA).
- Existing passwordless accounts, which must keep working unchanged.

## Core features and experience

**Sign-up (3 numbered screens, one shell, one progress indicator)**
1. **Create account** — email (phone available via a small "Use mobile number instead" link), optional collapsible referral code, Google / GitHub buttons, a one-line Terms & Privacy notice, single primary button "Create account".
2. **Verify** — "Enter the 6-digit code sent to j***@example.com", auto-submits on the 6th digit, 60-second resend, "Change email" link. Nothing else on this screen.
3. **Set up your account** — first name, last name, password (8+ characters, at least one letter and one number, show/hide toggle, live strength bar). Button "Finish" → brand splash → straight into the app's Get-started checklist. No confetti, no interstitial success page.

**Landing hero → code screen directly**
- Submitting a valid email in the hero sends the code immediately and opens sign-up on screen 2 (Verify) with that email shown and a "Change email" link. Zero redundant clicks.
- If the code cannot be sent (e.g. rate limit), sign-up opens on screen 1 with the email prefilled and the reason shown.

**Email already registered**
- The verify step tells the visitor "This email already has an account" and offers "Log in instead", which opens login with the email prefilled on the password step. Sign-up never silently logs an existing user in.

**Login (sibling of sign-up)**
1. **Welcome back** — email (or phone), Google / GitHub, "Continue".
2. **Enter your password** — password field (default), "Forgot password?", "Email me a code instead" link that swaps the field for the inline 6-digit code block (no pop-up dialogs anywhere).
3. **Two-factor code** — only when the account has 2FA on; same code block as sign-up.
- Same shell, same typography, same progress indicator, same button styles and same brand splash on success as sign-up.

**Purpose question moved in-app**
- The "Why are you here?" pills are removed from sign-up and appear once as a dismissible card at the top of the dashboard on the first visit. Picking a pill tailors the Get-started checklist and the accent, exactly as the old step did; dismissing it keeps the default checklist.

**Existing passwordless accounts**
- Nothing breaks: they still log in with "Email me a code instead". A gentle in-app "Set a password" nudge comes in Phase 2.

## User flow

**From the landing hero:** type email → hero sends code → Verify screen (Step 2 of 3) → enter code → Set up your account (Step 3 of 3) → Finish → splash → Get-started checklist with the purpose card on top.

**Direct visit to sign-up:** Create account (Step 1 of 3) → Verify → Set up your account → Finish → splash → Get-started checklist.

**Google / GitHub sign-up:** button → provider → straight into the app (name comes from the provider, no password needed).

**Returning user:** Welcome back → password (or code) → 2FA if enabled → splash → dashboard (or the deep-link they came for).

**Existing email typed into sign-up:** Verify screen shows "already has an account → Log in instead" → login opens on the password step with the email filled.

## UI/UX feel

- Calm, Coinbase-clean: one question per screen, one primary pill button, generous spacing, short titles ("Create account", "Check your email", "Set up your account", "Welcome back").
- Progress is always visible and honest: "Step 2 of 3" with three segments; hero arrivals start on segment 2.
- Code entry auto-advances and auto-submits; errors appear inline under the field, never as modals.
- Password field gets a live three-level strength bar and plain-English rules under it; no password-rule walls of text.
- Login and sign-up share the same split layout (form left, brand panel right), header controls, logo, fonts, button radii, and the same pulsing-logo splash on success.
- Everything renders in all six site languages from day one (en, de, es, fr, nl, pt).

## Implementation phases

**Phase 1 — MVP (build now)**
- New 3-screen sign-up; purpose picker, confetti and the separate success screen removed.
- Hero email submission sends the code and opens on the Verify screen; failure falls back to screen 1 with the reason.
- "Set up your account" screen creates the password (bcrypt-hashed, policy enforced on both sides) and name; sign-up can only be completed with both.
- Already-registered emails are routed to login instead of being logged in via sign-up.
- Login re-laid onto the identical shell and step pattern; inline code block replaces the pop-up code dialogs; password remains the default, code and 2FA preserved.
- Dismissible purpose card on the dashboard first visit, wired to the same tailoring the old step did.
- All new copy added to all six locales.

**Phase 2**
- In-app "Set a password" nudge for legacy passwordless accounts (banner + settings entry).
- Accounts that abandon at screen 3 are caught by the existing in-app name gate, extended to also ask for the password.
- Breached-password check (k-anonymity lookup) on the password screen.
- Trusted-device "skip 2FA on this browser" surfaced as a checkbox on the 2FA screen (backend already supports it).

**Phase 3**
- Passkey (biometric) login as an alternative to password.
- Phone-first sign-up parity (SMS code → password) with the same three screens.
- Account-recovery centre (change email, recovery codes) in settings.

## Assumptions

- Accounts are created the moment the 6-digit code is verified (as today); the name and password are set on the next screen using that fresh session. A visitor who closes the tab on screen 3 gets an account with a verified email only and is asked to finish inside the app (Phase 2 extends the existing name gate to cover the password).
- Password policy: minimum 8 characters, at least one letter and one number, may not equal the email; if the existing reset-password rule is stricter, the stricter one is used so both paths match.
- Sessions stay persistent for 30 days as they are today; no "remember me" checkbox is added.
- Social sign-ups (Google/GitHub) never see the password screen; they can add a password later via Phase 2.
- Phone sign-up stays available but secondary (text link under the email field), identical to today's behaviour; the SMS path lands on the same Verify and Set-up screens.
- Referral codes stay optional and collapsed behind "Have a referral code?"; attribution tags on links continue to be ignored as referral codes.
- Hero arrivals skip the purpose question entirely; they see the dashboard purpose card instead, like everyone else.
- The progress indicator counts three sign-up steps and three login steps; the 2FA step is only counted when the account has 2FA enabled.
- Removing the purpose step means every new account starts on the default Get-started checklist until the user answers the dashboard card.
- Existing login behaviour for admins, 2FA, forgot-password and the deep-link "next" redirect is kept exactly as is; only layout and the dialogs-to-inline change.
- Rate limiting on sending codes stays as the backend enforces today; the hero shows the backend's message if a send is refused.
- The previously agreed work (DigitalOcean cost report → Chainalysis screening → /about & public-pages pass → translations) resumes after this onboarding reset ships.
