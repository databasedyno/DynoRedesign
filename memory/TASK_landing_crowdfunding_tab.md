# TASK (next agent): Add Donations/Crowdfunding to the landing + unify the naming painpoint

Requested by the user (2026-06-12). User confirmed the landing page "wrongly omitted things related to
donation and crowdfunding that should be there." They then asked that **the landing label + CTA be
CONSISTENT with the in-app donation/crowdfunding creation flow**, that it **stand out**, and that this
request be **documented for the next agent to analyze the painpoint** (then the session was ended — NOT
yet implemented).

## The omission (confirmed)
The LIVE landing is v5 (`Components/Page/Home/index.tsx` → renders `v5/*`). The product showcase
`Components/Page/Home/v5/ProductsV5.tsx` has exactly 6 tabs and NO donations/crowdfunding:
`TABS = links · checkout · storefront · invoices · embeds · api` (ProductsV5.tsx:19-26).
Donations/crowdfunding only survive in the OLD, UNUSED v3 copy (`landing.json` `v3.ways.donations`,
`v3.audience.fundraisers`) which is not rendered anywhere on the live landing. The hero one-liner also omits
it (`landing.json` `v5.hero.body` = "Payment links, hosted checkout, storefront and API…").
Yet the feature is fully built: `/pay/donation-demo` (goal bar + reward tiers + donor wall; 3 scenarios:
Crowdfunding / Tip jar / Goal reached), `crowdfundingController`, `CampaignManager`, `DonationSettingsSection`.

## THE PAINPOINT TO ANALYZE — inconsistent naming across surfaces
The same feature is called different things in different places. The next agent should analyze and UNIFY:
- Create-pay-link link-type card (`Components/UI/pay-link/LinkTypeSelector.tsx:42`):
  label `linkTypeDonation` = **"Crowdfunding"**, hint "Collect contributions toward a goal — donors choose
  the amount.", icon `mdi:hand-heart-outline`, accent = green. (Card pair is commented "Payment Link" vs
  "Donation / Crowdfunding".)
- Create CTA button (`Components/UI/pay-link/ActionButtons.tsx:26`): `createDonation` =
  **"Create crowdfunding"** (title `createDonationTitle` = "Create Crowdfunding"). — `createPaymentLinkScreen.json:165-166`
- Pay-links list badge (`paymentLinks.json:40`): `donationBadge` = **"Crowdfunding"**.
- Detail panel eyebrow (`PaymentLinkDetailPanel.tsx:147`): `detail.eyebrowCampaign` = **"Donation campaign"**.
- Auth hint (`auth.json:209`): "Crowdfunding & donation pages".
- Internal enum: `LinkKind = "standard" | "donation"`, DB `link_type='donation'`.
- Old landing v3 copy: `v3.ways.donations` title "Donations", `v3.audience.fundraisers` "Fundraisers".
→ Decision needed from user/owner: one canonical public name. In-app leans **"Crowdfunding"** (the link-type
  label + create CTA), so the landing should most likely use **"Crowdfunding"** as the tab label and a CTA
  that mirrors the in-app verb, e.g. **"Create crowdfunding"** / **"Start crowdfunding"** — NOT a new coined
  term like "Donations & crowdfunding" unless the owner also renames the in-app surfaces to match.

## Implementation plan (once naming is confirmed)
1. Add a 7th tab to `ProductsV5.tsx` `TABS` (id e.g. `donations`): icon = a hand-heart (MUI
   `VolunteerActivismRounded` or lucide `heart-handshake`) to echo `mdi:hand-heart-outline`; `href` →
   `/pay/donation-demo` (demo) and/or sign-up. Add matching entry to `SHOT_URL`. Headline changes from
   "Six ways to get paid. One account." → "Seven ways…" (`landing.json` `v5.products.headline`).
2. i18n: add `v5.products.donations.{tab,title,desc,note,cta}` to ALL 6 locales
   (`langs/locales/{en,de,es,fr,pt,nl}/landing.json`). Use the CONFIRMED canonical label + CTA verbatim.
   Also update the hero one-liner `v5.hero.body` in all 6 locales to include fundraising/crowdfunding.
3. Product screenshots `public/landing/products/donations-{light,dark}.webp` at **1280×800** (match the other
   shots). Capture from `/pay/donation-demo` (scenario `campaign` = Crowdfunding goal). Hide the demo chrome
   during capture: `[data-testid="donation-demo-toggle"]` and the "Donation checkout — preview" eyebrow.
   Pattern to copy: `scripts/landing/capture_phone_shots.mjs` (playwright headless_shell + sharp→webp,
   colorScheme light/dark, cookie `theme-mode-public`/`theme-mode-pay`). Browser shots are 1280×800,
   deviceScaleFactor 1, `fullPage:false`.
4. "Make it stand out": consider giving the new tab a distinct accent (the in-app card uses green) or ordering
   it earlier in the tab list — get the owner's preference.
5. Verify with `testing_agent` (frontend): new tab renders, image loads light+dark, CTA + label match the
   in-app wording, no raw i18n keys in any of the 6 languages, no layout overflow at 1920/390.

## Assets / helpers ready
- Demo page: `/pay/donation-demo` (public). Preview URL in `/app/memory/test_credentials.md`.
- Existing product shots: `public/landing/products/{links,checkout,storefront,invoices,embeds,api}-{light,dark}.webp` (1280×800).
