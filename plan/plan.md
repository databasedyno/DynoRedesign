# Theme Memory — one remembered light/dark choice, verified end to end

A visitor's light/dark choice is remembered once and honoured everywhere on the site — marketing pages, checkout, sign-in and the merchant dashboard — with no surprise flips between pages. A full regression run proves it, and anything found broken is fixed in the same pass.

## Who it's for
- Buyers landing on a checkout or storefront who should not be blinded by a theme flip mid-payment.
- Merchants who move between the marketing site, sign-in and the dashboard many times a day and expect one consistent look.
- The team, who needs a written, repeatable pass/fail record of theme behaviour across every surface.

## Core features and experience
- **First visit follows the device.** With nothing remembered yet, every page (marketing, checkout, sign-in, dashboard) starts in the mode the visitor's device is set to. If the device switches (e.g. dark at sunset) before any manual toggle, the site follows.
- **One choice, remembered everywhere.** The first manual toggle — wherever it happens — becomes the single remembered choice for that browser. Marketing, checkout, auth and dashboard all read and update the same choice. The old separate "dashboard theme" and "public theme" are folded into one.
- **No flash.** The correct mode is applied before the first paint on every load, including hard reloads and new tabs.
- **Stable across navigation.** Client-side navigation, back/forward, reload, new tab, sign-in and sign-out never change the mode on their own.
- **SafeDeal stays SafeDeal.** SafeDeal pages keep their fixed yellow-and-black look regardless of the remembered Dynopay choice, and visiting them never alters that choice.
- **Documented boundaries.** `dynopay.com`, `checkout.dynopay.com` and `safedeal.sh` are separate origins, so each remembers independently. This is recorded in the report as expected behaviour, not a defect.
- **Regression report.** A pass/fail matrix over surfaces × scenarios × desktop/mobile, with failures fixed and re-run until green.

### Regression matrix (what gets exercised)
Surfaces
- Marketing: home, /fees, /for/* verticals, /products, /blog, /about, legal pages.
- Checkout: hosted payment link (/pay), demo checkout, storefront checkout, order/receipt page.
- Auth: sign-in, sign-up, password reset.
- Dashboard (signed in): overview, transactions, settings, notifications, Help & Support.
- SafeDeal: landing, sign-in, deals list, new deal, deal page, wallet, help/legal.

Scenarios (each on desktop and mobile widths)
1. Fresh visitor, device set to dark → every surface starts dark.
2. Fresh visitor, device set to light → every surface starts light.
3. Device preference changes with nothing remembered → site follows live.
4. Toggle on a marketing page → checkout, sign-in and (after login) dashboard all show the new mode.
5. Toggle on checkout → marketing and sign-in follow.
6. Toggle inside the dashboard → sign-out, marketing and checkout follow; toggling back inside the dashboard is respected everywhere.
7. Reload, open in new tab, back/forward → mode unchanged, no flash of the wrong theme on first paint.
8. Returning merchant who previously had a dashboard choice → that choice is honoured everywhere on first load after the change.
9. SafeDeal pages look identical whether the remembered Dynopay choice is light or dark; visiting them leaves the choice untouched.
10. Toggling never triggers unrelated effects (no confetti, no brand switch, no data reload loops).

## User flow
1. A new visitor opens any Dynopay page → it appears in their device's mode.
2. They tap the sun/moon toggle in the header (or the dashboard's toggle) → the page switches instantly and the choice is saved.
3. They continue to checkout, sign in, land in the dashboard → same mode throughout, no flicker.
4. They close the browser and return days later → same mode.
5. They switch again from anywhere → the new choice applies everywhere on the next page they open.

## UI/UX feel
- Toggle placement and iconography stay as they are today; nothing new to learn.
- Mode changes are immediate on the current page and silent elsewhere — no toasts, no banners.
- First paint is already in the right mode; there is no light-then-dark blink.

## Implementation phases

### Phase 1 — now (MVP)
- Single remembered choice per browser shared by marketing, checkout, auth and dashboard; existing dashboard choice migrated and honoured.
- Device preference as the starting mode when nothing is remembered, followed live until the first manual toggle.
- Full regression run over the matrix above; every failure fixed and re-verified; written pass/fail report including the cross-origin note.

### Phase 2 — later
- Explicit three-way control (Auto / Light / Dark) in the dashboard settings and marketing footer, so a user can return to "follow my device" after having toggled.

### Phase 3 — later
- Carry the current mode across origins: checkout links and SafeDeal hand-offs opened from a Dynopay page start in the sender's mode; signed-in merchants get their choice synced across devices.

## Assumptions
- The remembered choice is per browser (this browser, this origin), not tied to the merchant account; account-level sync is Phase 3.
- The current route-based starting modes (marketing dark, checkout/auth/dashboard light) are replaced by the device preference for first-time visitors. A visitor whose device is set to light will see the marketing site in light until they toggle.
- Until a manual toggle happens the site follows device changes live; after the first toggle the manual choice wins permanently (Phase 2 adds a way back to "Auto").
- Where a browser already holds both an old dashboard choice and an old public choice, the dashboard choice wins, because dashboard toggles were always deliberate.
- Help & Support follows the same single choice like every other page.
- SafeDeal has no light/dark toggle and keeps its fixed brand look; it is covered only for "unaffected and non-interfering".
- `checkout.dynopay.com`, `dynopay.com` and `safedeal.sh` each remember independently; recorded as expected, not fixed.
- Any defect found during the run is fixed in the same pass and the affected scenarios re-run until they pass.
