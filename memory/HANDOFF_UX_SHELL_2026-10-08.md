# HANDOFF — Responsive shell / UX-audit blueprint implementation (2026-10-08, paused by user)

**Read first:** `memory/reports/UX_LAYOUT_AUDIT_2026-10-08.md` (the audit + blueprint §8, roadmap §9, acceptance metrics §9 end).
**User decisions (verbatim intent):**
- Implement EVERYTHING in the blueprint (P0 + P1 + P2): shared screen-size rules, labelled side menu for touch tablets, large-screen layout, one filter style, phone Settings list, type scale.
- Phone nav: keep the bottom bar, rebuild "More" as a slide-up list, REMOVE the hamburger. (done)
- Phone Settings = iOS-style grouped index list → tap opens the section full-screen with a back arrow. (done)
- Small visual issues found outside the rework: fix them too.
- Verification order: re-run the audit on affected devices → then the FRONTEND testing agent → fix everything it reports.

**State at pause:** all code compiles (`tsc --noEmit` clean), prod build passed and is LIVE on the preview
(`.next-prod`, swapped 2026-10-08 ~18:50). Frontend = PRODUCTION build, no hot reload: after FE edits run
`cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` (≈2.5 min, background) then
`rm -rf .next-prod-old && mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend`.
Nothing committed by hand (platform auto-commits). **The testing agent has NOT been run on this work yet.**

---------------------------------------------------------------------------------------------------
## 1. What is DONE (in the working tree + live build)

Foundations
- `styles/shellTokens.ts` (SHELL_BP / SHELL_Q / SHELL_MQ / SHELL_SIZE / TYPE_SCALE) + `hooks/useShellMode.ts` (phone <600, tablet 600–1023 **and touch ≤1279**, desktop; `labelledRail = tablet && coarse`).
  - `SHELL_Q.cardList` = `(max-width:1023.95px), (max-width:1279.95px) and (pointer: coarse)` → `hooks/useTableCardView.ts` (Transactions / Invoices / Customers card lists).
  - NOTE: the "touch ≤1279 = tablet" + cardList change was made AFTER the audit re-run → re-verify iPad landscape (1024 / 1194).
- `hooks/useBackToClose.ts` (history entry per overlay; back/swipe closes it; `ClientLayout` `router.beforePopState(() => !hasOpenOverlay())`).
- `Components/UI/BottomSheet` (SwipeableDrawer bottom, handle, 44px close, safe-area, back-to-close).
- `styles/globals.css`: iOS no-zoom 16px inputs now `(max-width:768px), (pointer: coarse)`; opt-in `[data-hit-area]` invisible hit area (24 / 44 px).

Shell
- `Containers/Client/index.tsx`: one frame per shell mode; sidebar width 240 / 72 rail / 88 labelled rail / 0 phone; content max 1440 → 1720 (≥2000) → 2040 (≥2400); top bar aligned with content (`NewHeader/styled.tsx MainContainer` padding mirrors the column); phone large-title header (description behind ⓘ `PageInfoButton`), `CompactTitleBar` slides in when the title scrolls away; focus mode (no tab bar) on `/create-pay-link`, product new/edit.
- `NewSidebar/*`: real `<Link>` rows (`MenuLink`), `LabelledRail.tsx` (icon + caption groups, fly-out), `SidebarFooter.tsx` (Status · Docs · Terms · Privacy · v·build + collapse), `NavIcon.tsx` (one icon renderer, fixed box so labels align), height-aware density `@media (max-height:940px)` (rows 34px).
- `MobileNavigationBar/*`: solid 56px tab bar Home · Sell · (+) · Money · More; hides on scroll-down / input focus / focus routes; `MoreSheet.tsx` = grouped vertical list (account row, alerts, all IA groups, Notifications+badge, Language, Chat with support → `dynopay:open-support-chat`, Appearance (`ThemePreferenceControl`), Sign out (`helpers/signOut.ts`), utility footer). Hamburger drawer REMOVED from the app shell.
- `NewHeader`: brand cell width = effective sidebar (fixes "Dy" clip), Help & chat icon in the top bar (≥600), `CreateHub` = bottom sheet on phones / dialog elsewhere (+ back-to-close), contrast fixes. Bell + avatar triggers are 44×44 on phones.
- `UserMenu`: rebuilt — header (name/email/brand), left-aligned 44px rows, anchored Popover below the trigger (desktop) / BottomSheet (phone), theme control lives here.
- `SupportChatWidget`: floating button no longer covers row actions (opened from top bar / More).

Pages / components
- Money never truncated: `Components/Page/Transactions/AmountText.tsx` (number + unit as two nowrap spans, unit wraps; `align="start"` used in phone cards — fixes "USDT-⏎ERC20").
- Transactions + Payment links phone cards: whole card opens detail; selection via **Select** toolbar button or long-press (`Components/Common/SelectMode.tsx`); one inline primary action (Copy link) + ⋯.
- One filter style: `Components/Common/FilterControls.tsx` (`FiltersButton`, `FilterOptionChip`, `FilterGroupLabel`). Transactions toolbar uses it; **Payment links on phones/tablets (<900) = [search] [Filters]** → bottom sheet `paylinks-filter-sheet` (Show Links/Orders, Status chips, Period picker, Clear / Done).
- `Components/UI/OverflowTabs`: on touch / <1024 every tab stays on ONE swipeable strip (no "N more tabs…"); desktop keeps the collapse pill. Affects Receipts, Developers, Storefront, admin pages.
- Settings: phone (<900) iOS index list `Components/Page/Settings/SettingsPhoneIndex.tsx` (Account / Business / Payments / More→Developers, Referrals); section view = back button (`settings-back-btn`) + h1 section title; push/back history works (browser back returns to the index); deep links `?section=` land on the section.
- Security: sessions capped to 5 + "View all N devices" paged dialog (`sessions-view-all`, `sessions-all-dialog`, `sessions-load-more`); 2FA buttons 36px.
- Back gesture now also closes: Transaction detail, Payment-link detail, Transactions filter sheet.
- Misc: `InfoHint` invisible hit area; page tips auto-expand only on the first 2 visits then retire behind the ⓘ (`Components/UX/PageTip`); /get-started redirect when complete; chart first-label clip; type-scale cleanup (no <12px in touched files).

Audit re-run (before the last batch of fixes): `test_reports/ux_layout_audit_rerun/<device>/` (+ `results*.json`).
Harness updated for the new shell (`scripts/qa/ux_layout_audit.mjs`: phone overlays <600, More-sheet measure, 1.8s overlay wait).
Interaction probe: `node scripts/qa/shell_probe.mjs [--device=pixel-8]` (More open/back, settings index push/back, pay-links filter sheet, create sheet, user menu) — all PASSED on iPhone 15 Pro (WebKit).

Re-run headline vs 2026-10-08 baseline
| Metric | Before | After |
|---|---|---|
| Phone content % at first paint | 64–72 % | 83–87 % |
| More sheet clipped items (320–440) | many | 0 |
| Settings → Security height | 23,730 px (280 sessions) | 5 sessions + dialog |
| Galaxy Tab S4 (712) | phone shell | 88px labelled rail |
| Money clipping 1024–1280 | yes | none observed (amount wraps unit) |

---------------------------------------------------------------------------------------------------
## 2. REMAINING TASKS (do in this order, end-to-end)

### A. Re-verify the last batch (built + live, NOT re-audited)
Changes made after the audit run: touch ≤1279 → labelled rail + card lists; sidebar density at ≤940px tall + one-line footer;
NavIcon fixed box; settings phone padding (px 0) + index overflow fix (rows were clipped on the right); AmountText in phone cards;
bell/avatar 44px.
Run: `OUT=/app/test_reports/ux_layout_audit_rerun2; node scripts/qa/ux_layout_audit.mjs --out=$OUT --devices=ipad-mini-landscape,ipad-pro11-landscape,desktop-1280,desktop-1440,iphone-se3,pixel-8`
then `python3 scripts/qa/ux_layout_audit_summary.py $OUT`. Check: iPad landscape now 88 rail + cards, no truncated tx headers,
dev-keys CLIP-R gone at 1024; 1280×800 / 1440×900 sidebar shows every row incl. Help & Support without scrolling; settings index rows not clipped.

### B. Tap targets (acceptance: desktop 0 < 24px; touch 0 < 44px outside running text)
Desktop < 24 offenders still present (from rerun `results.json` → `small24`):
- `rows-per-page-trigger` 40×18 (Components/UI/RowsPerPageSelector) → min-height 32.
- create-pay-link: `product-quick-sell-open` "Pick product" 21px.
- products: `products-view-orders-link` 21px.
- storefront: `your-page-copy` 22×22, `your-page-open` 22×22, `your-page-funnel-checkouts-hint` 12×12.
- payouts: `payouts-autoconvert-settings-link` 15px, `payouts-manage-wallets` 22, `payouts-export-csv-btn` 22, `payouts-recent-explorer` 14×14 (×N), `payouts-digest-preview-btn` 21.
- transactions: sort headers `tx-sort-amount|usdValue|dateTime` 18px tall.
- `wallet-total-hint`, `invoices-tile-collected-hint`, `customers-stat-revenue-hint` 12×12 (InfoHint — ::after hit area exists but the element itself is 12px; make the button 24×24 with negative margin so layout is unchanged).
- wallet: `wallet-shared-tag-*` "Used on N networks" 18px.
- referrals: `copy-referral-code-btn` 22×22.
- settings/profile: `profile-brand-logo-link` 15px.
- developer-keys: `dev-health-retry|open-webhooks|open-keys|open-docs|open-reference` 20px, `sandbox-badge` 19, `try-first-payment-regenerate` 23, `sandbox-recent-refresh` 23×23, hash copy button 19.
Touch < 44 (phones/tablets): OverflowTabs pills 36, customers segments 36, `paylinks-select-mode`/`tx-select-mode` 36, Filters 40, wallet row actions 40 + explorer 28, referral share icons 34, storefront tabs 36, notifications tabs 36, product grid/list toggles 32×30, create-pay-link `currency-selector-trigger`/`crypto-*`/`expire-selector-trigger` 32.
Suggested approach: a `@media (pointer: coarse)` min-height 44 on those controls (or a `data-touch-44` attribute rule in globals.css).
Known MEASUREMENT ARTIFACTS (not real defects): inner `<input>` of 40px fields reported as 22px; off-screen `skip-to-content` link.

### C. Blueprint items not yet done / not verified
1. Large screens (S13): auto rows-per-page from viewport height (≈25 at ≥1080px tall) for Transactions / Payment links / Receipts; consider `contentMaxUltra` 1720 (tables still stretch to 2040 at 2560). PageTip card is centred while the page is left-aligned at ≥1280 → left-align it.
2. Payment links desktop 1280: table still scrolls sideways (1071/974) — condense columns or switch to cards < 1300 on fine pointer.
3. Toolbars: Receipts (`invoices`), Customers, Products still use their own select styles on phones (Period select, Sort select, Status select) → move into a `FiltersButton` + BottomSheet like Payment links.
4. Payouts phone/tablet: `payouts-tiles` horizontal scroller (intentional carousel? verify) and truncated "ERC-20/TRC-20" chips at 360px.
5. Dashboard phone: `money-row` KPI carousel scrolls sideways (intentional) — verify it has an edge-fade cue; "Growth tier …" chip truncates.
6. Storefront: preview-host URL truncated in two places (fine) but `Custom theme · cover image` truncates at 360–393.
7. create-pay-link @ Galaxy S24 (360): `crypto-clear-all` / "Select All Clear All" row clipped on the right (CLIP-R 2).
8. Developer keys @ 1024: key table "CREATED" column clipped (should be fixed by A; verify).
9. Settings IA (§8.9 desktop): remove Developers from the settings sub-nav (it's in the sidebar), rename "Account details" → "Business profile", one home for notification prefs (Notifications page → link to Settings → Notifications).
10. Selected-state system (S22) + dark-mode bottom-bar palette (S23): document in `design_guidelines.json`; check `iphone-15-pro --themes=dark`.
11. Cold start (S5): skeleton shell + cached brand list / nav-reveal flags (check `hooks/useNavReveal.ts` diff — partially done).
12. More sheet first open is ~1.2–2 s in emulated WebKit (content mounts on open) — consider `keepMounted` after first open or lighter first render.
13. Type scale: ≤ 8 font sizes per page, none < 12px (rerun shows fs avg 9–11; Dashboard/Storefront up to 13–15).

### D. Testing (MANDATORY before reporting done)
Call the **frontend testing agent** (frontend only) with: login via token injection (`localStorage.token` = `/app/memory/tmp/merchant_token.txt`, `last_company_id=1`, `sessionStorage.mfa_interstitial_seen=1`) or UI login per `memory/test_credentials.md` (owner onarrival21@gmail.com, TOTP `node /app/backend/scripts/print_totp.cjs 1`). LIVE prod DB → mock every non-GET.
Flows + testids:
- Phone (390–440): tab bar `mobile-navigation-bar`, `mobile-nav-home|sell|money|more`, `mobile-nav-create`; More sheet `mobile-more-sheet` (rows `mobile-nav-<icon>`, `mobile-nav-notifications`, `mobile-nav-language`, `mobile-nav-support-chat`, `mobile-more-theme`, `mobile-more-signout`, `mobile-more-footer`); browser back closes it and stays on the page; no hamburger anywhere.
- Create hub sheet (phone) / dialog (desktop `header-create-new`); back closes it.
- User menu `user-menu-trigger` → `user-menu-sheet` (phone) / popover (desktop) anchored below the trigger.
- Settings phone: `settings-phone-index`, `settings-index-row-<key>`, `settings-back-btn`, `settings-section-title`; deep link `/settings?section=security`; browser back from a section returns to the index; desktop rail `settings-rail-<key>` unchanged.
- Security: `sessions-view-all` → `sessions-all-dialog` → `sessions-load-more` / `sessions-all-close`.
- Payment links phone: `paylinks-search`, `paylinks-filters-btn` (+ `-count`), `paylinks-filter-sheet`, `paylinks-kind-links|orders`, `paylinks-status-<v>`, `paylinks-date-trigger`, `paylinks-filter-clear`, `paylinks-filter-done`; cards: tap opens detail, `paylinks-select-mode` → checkboxes `paylink-select-<id>`; `paylink-copy-mobile-<id>`.
- Transactions phone: `transactions-filters-btn` → `tx-filter-sheet`; `tx-select-mode`; amounts never cut (`tx-amount`), unit wraps whole.
- Tablet 768/834 touch: 88px labelled rail (`data-shell-mode="tablet"` on the nav); Galaxy Tab 712 gets the rail, not the phone bar.
- Desktop 1280/1440/1920/2560: sidebar real links (`MenuLink`), utility footer `sidebar-utility-footer`, top bar aligned with content, Help & chat `header-help-chat`.
- OverflowTabs on phones: `/invoices`, `/developer-keys` tabs on one swipeable strip (`[data-mode="scroll"]`), no `overflow-tabs-more`.
Then fix every reported issue, rebuild, and update PRD.md / CHANGELOG.md.

---------------------------------------------------------------------------------------------------
## 3. Files touched this effort (git status; uncommitted at pause)
Modified: Components/Common/SupportChatWidget/index.tsx · Components/Layout/MobileNavigationBar/{index,styled}.tsx ·
Components/Layout/NewHeader/{CreateHub,CreateNewButton,index,styled,NotificationsBell}.tsx · Components/Layout/NewSidebar/{index,navSections,styled}.tsx ·
Components/Page/Dashboard/v2026/command/TrendCard.tsx · Components/Page/GetStarted/index.tsx · Components/Page/Payment-link/{PaymentLinksTable,PaymentLinksTopBar,PaymentLinkDetailPanel}.tsx ·
Components/Page/Payouts/{PayoutTiles,WalletsTimeline}.tsx · Components/Page/Profile/{AccountSetting,ActiveSessions,TwoFactorAuth}.tsx · Components/Page/Referrals/ReferralLinkHero.tsx ·
Components/Page/Storefront/PageFunnelHeader.tsx · Components/Page/Transactions/{TransactionsTable,TransactionsTopBar,TransactionsFilterSheet,TransactionDetailsModal}.tsx ·
Components/Page/Wallet/{WalletCardMeta,WalletList}.tsx · Components/UI/{CompanySelector/*,InfoHint,RowsPerPageSelector/index,UserMenu/index,UserMenu/styled,OverflowTabs/index}.tsx ·
Components/UX/PageTip/index.tsx · Containers/Client/{index,styled}.tsx · contexts/ThemeContext.tsx · hooks/{useNavReveal,useTableCardView}.ts · styles/globals.css · pages/settings/index.tsx · scripts/qa/ux_layout_audit.mjs
New: Components/Common/{SelectMode,FilterControls}.tsx · Components/Layout/MobileNavigationBar/MoreSheet.tsx · Components/Layout/NewSidebar/{LabelledRail,NavIcon,SidebarFooter}.tsx ·
Components/Page/Settings/SettingsPhoneIndex.tsx · Components/Page/Transactions/AmountText.tsx · Components/UI/BottomSheet/index.tsx · Components/UI/ThemePreferenceControl/index.tsx ·
Containers/Client/CompactTitleBar.tsx · helpers/signOut.ts · hooks/{useBackToClose,useShellMode}.ts · styles/shellTokens.ts · scripts/qa/shell_probe.mjs
