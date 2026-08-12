# DynoPay — Next Steps & Potential Improvements

_Last updated: 2026-08-11 (fork). Context: completed the lime→indigo/semantic color rollout across in-app pages, storefront, checkout, emails, and the creator page. A $10 test link (Invoice INV-2026-172) was created and verified (testing iteration_37, 100% pass)._

---

## Next Action Items (prioritized)

### 1. Multi-Coin Proof  _(P1 — verification)_
Enable ETH / USDT-TRC20 / LTC on a test payment link so the coin picker can be exercised end-to-end — confirm each coin's brand color (BTC orange, USDT teal-green, LTC blue, ETH slate) and the indigo selection/hover highlight. (Current live link only had BTC enabled, so multi-coin switching was never exercised.)

### 2. Paid-State Demo  _(P1 — verification)_
Stage a "settled"/paid preview of the checkout so the **green success screen + confetti** can be seen without sending real crypto (the live DB only shows the WAITING state until a real payment lands).

### 3. Payout & Digest Emails  _(P1 — consistency)_
Refresh the remaining transactional email types onto the new indigo/green base:
- Payout confirmations
- Weekly / monthly digests
- Refund notifications
_(The shared base template `backend/utils/emailTemplate.ts` is already migrated; verify each individual email body/service that composes its own inline styles.)_

### 4. Storefront Preview  _(P2 — verification)_
Publish a demo product on a throwaway handle so the public **Shop / storefront** indigo/green look (ShopToolbar chips, ProductCard badges, "sold" green chip, trending amber ribbon) can be verified end-to-end. (hostbay's shop is currently unpublished → shows the branded "Page Unavailable" screen, so storefront colors are code-correct but not live-verified.)

### 5. Dev Vertical Polish  _(P2 — optional)_
Decide whether the developer/API pages should drop their remaining volt-lime button-text (`useVerticalAccent` `developers.onColor = VOLT`, `PurposePicker` developers contrast) and join the unified indigo look. Left as-is this session (creators was unified to indigo; developers intentionally untouched).

---

## Potential Improvements

### A. Central "Brand Tokens" file  _(recommended)_
Add a single source-of-truth module for the palette so every future checkout, email, and page stays on-palette automatically:
- Brand: indigo `#4F46E5` (light) / `#818CF8` (dark), deep `#4338CA`
- Semantic: green `#3FD98A` / `#05936A` / `#12B76A` (paid/success), red `#FF6B6B`/`#B91C1C` (failed), amber `#FBBF24`/`#B45309` (pending/warning)
- Coin brand: BTC `#F7931A`, USDT `#26A17B`, LTC `#345D9D`, ETH `#627EEA` (see `helpers/assetColor.ts`)
This kills the recurring "one page still on the old accent" problem at the root.

### B. Intentional leftovers (NOT bugs — document so they aren't "re-fixed")
- **Landing/marketing** (`Components/Page/Home/v3/*`, `swiss.ts`, `homeTheme.ts`) keep cyber-lime as a deliberate marketing aesthetic.
- **Creator theme picker "Lime" swatch** (`constants/creatorTheme.ts`) is a user-selectable page color — kept on purpose.
- **`developers` vertical** volt-lime accents (`useVerticalAccent`) — out of scope this session.
- **Auth surfaces** (`auth/register` confetti, `ForgotPasswordDialog`) — own design system.

---

## Reference
- Test login: `hostbay@moxx.co` / `Katiekendra123@`
- $10 test link (BTC, Invoice INV-2026-172):
  - Preview: `https://payment-hub-test-2.preview.emergentagent.com/pay?d=dd7cf1523088ee313c0e57118e11661ebf3436469930dbab`
  - Production: `https://checkout.dynopay.com/pay?d=dd7cf1523088ee313c0e57118e11661ebf3436469930dbab`
- ⚠️ This pod is on the merchant's **LIVE** DB/Redis. `WORKER_ROLE=secondary` must stay to keep cron/sweepers off.
