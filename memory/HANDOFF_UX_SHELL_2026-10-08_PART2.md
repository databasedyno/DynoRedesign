# HANDOFF — UX shell / blueprint, PART 2 (2026-10-08 evening, paused by user to wrap up)

Continues `memory/HANDOFF_UX_SHELL_2026-10-08.md` (read §2 there for the original task list A–D).
Audit + blueprint: `memory/reports/UX_LAYOUT_AUDIT_2026-10-08.md` (§8 blueprint, §9 roadmap + acceptance metrics).

## 0. ⚠️ STATE AT PAUSE — READ FIRST
- **All Part-2 edits are in the WORKING TREE ONLY. The live preview still serves the OLD prod build**
  (`.next-prod`, built at pod setup). Nothing below is visible in the browser until you rebuild + swap:
  ```bash
  cd /app && yarn icons:bundle            # new <Icon name> values (calendar/chevron-down already bundled; safe to re-run)
  NEXT_DIST_DIR=.next-prod-new NODE_OPTIONS=--max-old-space-size=4096 node_modules/.bin/next build > /tmp/fe-build.log 2>&1 &   # ≈2.5 min
  # when /tmp/fe-build.log shows success:
  rm -rf .next-prod-old && mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend
  ```
  (Run the build in the background with nohup/`&` — a foreground build times out the tool at 120 s.)
- ✅ `tsc --noEmit` finished CLEAN (`TSC_EXIT=0`, checked in the next fork). Re-run `node_modules/.bin/tsc --noEmit`
  after any further edits.
- ESLint not run on Part-2 files yet (`mcp_lint_javascript` / `yarn lint` on the touched files).
- **Testing agent NOT run yet** (task D of Part 1 is still open).

## 1. Pod setup done this session (for the record)
- `/app` restored by the platform from branch `Improvement` @ `c9896b4`; then `bash scripts/pod-bootstrap.sh` with the
  vault passphrase (user-provided, see test_credentials.md) → `.env.local` + `backend/.env` restored, SAFE MODE on.
- **Preview host gotcha hit (POD_SETUP.md):** supervisor APP_URL is the UUID host, user-facing host is
  **https://fiat-crypto-vault.preview.emergentagent.com** → re-synced with `--url https://fiat-crypto-vault.preview.emergentagent.com --no-restart`,
  UUID host appended back to `CORS_ALLOWED_ORIGINS`, frontend rebuilt + swapped. Verified: `/health` healthy (db+redis),
  `/auth/login` 200 on the pretty host, CORS `access-control-allow-origin` = pretty host.
- The self-heal `yarn install` pruned stale entries from `yarn.lock` + `backend/yarn.lock` → both RESTORED to HEAD content
  (`git show HEAD:yarn.lock > yarn.lock`) to avoid unrelated churn. Don't commit a pruned lockfile.
- Playwright 1.63 browsers for the audit harness were installed into `/pw-browsers` (`chromium-headless-shell-1243`, `webkit-2359`)
  — they are NOT in git; on a new pod run
  `PLAYWRIGHT_BROWSERS_PATH=/pw-browsers node_modules/.bin/playwright install chromium-headless-shell webkit && PLAYWRIGHT_BROWSERS_PATH=/pw-browsers node_modules/.bin/playwright install-deps webkit chromium`.
- Merchant token `/app/memory/tmp/merchant_token.txt` valid ~27 days (exp checked 2026-10-08).

## 2. Task A — audit re-run 2 (DONE, results in `test_reports/ux_layout_audit_rerun2/`)
Devices: ipad-mini-landscape, ipad-pro11-landscape, desktop-1280, desktop-1440, iphone-se3, pixel-8 (run against the OLD build).
- ✅ iPad landscape (1024/1194) = 88px labelled rail + transaction CARDS. ✅ clippedRight = 0 on every device/page (dev-keys CLIP-R at 1024 gone).
- ✅ Phones: content 84–87 % at first paint; More sheet 0 clipped rows. ✅ KPI money-row carousel already has an edge fade.
- ❌ found → FIXED in working tree (§3): 1280×800 sidebar still hid "Help & Support" (rows were 38px: 26px icon box + 2×6 padding);
  "Transaction ID" header 114/116 at 1280; Payment-links table 1071/974 sideways at 1280; dashboard phone "Recent transactions"
  fiat amount "$167.…" truncated (money!); CompactTitleBar text flush at x=0 on the phone dashboard; receipts phone card invoice
  number truncated; payouts "ERC-20/TRC-20" chips truncated; Growth-tier line truncated; "Custom theme · cover image" truncated;
  create-pay-link Select/Clear-all fixed widths overflow at 360.
- Harness fixed (`scripts/qa/ux_layout_audit.mjs`): a field is measured by its `.MuiInputBase-root` box (no more "input 22px"
  artefacts) and the off-screen skip-to-content link is skipped.

## 3. What was implemented in Part 2 (working tree, UNBUILT, UNTESTED)
### B. Tap targets (desktop ≥ 24, touch ≥ 44)
- NEW `styles/tapTarget.ts` — `tapY(h, padY)` / `tapXY(size, pad, {left,right})`: grows the element's OWN box, cancels with a
  negative margin (layout-neutral), coarse pointer → 44. Used by: InfoHint (all `*-hint` ⓘ), your-page-copy/open, payouts
  settlement link + explorer icons, tx sort headers, sandbox badge/refresh/payment-id button, dev-health reference link,
  copy-referral-code, products-view-orders-link.
- `styles/globals.css`: `[data-touch-44]` / `[data-touch-44="square"]` (min 44 on `(pointer: coarse)`), all single-line
  `.MuiInputBase-root` 44px tall on touch, `[data-tap-inline]` for links in running text (profile-brand-logo-link).
- `data-touch-44` added to: SelectModeButton, FiltersButton, FilterOptionChip, customers segments, paylinks kind toggle,
  wallet reveal/more (square) + last-forward explorer (square), referral copy/share/share-icons, notifications tabs (now
  removed, see C9), currency/expire selector triggers, crypto select/clear/show-all, plan-growth toggle,
  payouts-wallets-toggle-quiet, company-selector trigger, settings rail rows, OverflowTabs items, page-tip "Got it", footer status pill + socials.
- `styles/appTheme.ts`: `MuiButton.sizeSmall { minHeight: 24 }` (base theme lineHeight 1 made small buttons 21–23px).
- RowsPerPageSelector trigger 32px (44 touch) with negative margins; SharedAddressTag = transparent target button around the
  visible pill (pill 20/22px, font 12); dev-health LinkBtn 24/44; try-first-payment-regenerate min 28/44; HomeFooter links
  inline-flex min 24 (44 touch, gap adjusted); products grid/list toggle 46/44 on touch; wallet-security back button min 44.
### C. Blueprint items
- C1 ✅ NEW `hooks/useAutoRowsPerPage.ts` (10 / 15 @≥900 / 25 @≥1080 / 50 @≥1400 tall; explicit choice remembered per list in
  localStorage `dp_rows_per_page:<list>`; `ready` flag) → Transactions, Payment links (both pagers), Receipts (server `limit`,
  SWR waits for `ready`, new RowsPerPageSelector in `invoices-pagination`). Menu = `ROWS_PER_PAGE_OPTIONS` [10,15,25,50].
  PageTip left-aligned to the content column (`&&` margin calc). `contentMaxUltra` 2040 → 1720.
- C2 ✅ NEW `hooks/useElementWidth.ts`; Payment-links table goes **condensed** when its container < 1100px
  (`data-condensed="true"`): Crypto column removed, coins render under the amount (`paylink-coins-inline-<id>`).
- C3 ✅ NEW `Components/Common/FilterSheet.tsx` (`FilterSheet`, `FilterChoiceGroup`, `PhoneFilters`). Phones (<900):
  Customers sort → `customers-filters-btn` / `customers-filter-sheet` / `customers-sort-<v>`; Products status →
  `products-filters-btn` / `products-status-<v>`; Receipts period → `tax-period-trigger` pill → `invoices-period-filter-sheet`
  / `tax-period-<p>` (desktop keeps the Select `tax-period-select`).
- C4 ◐ ERC/TRC chips: network label hidden when the coin name already contains the network (`payouts-wallet-network` only for
  native coins). `payouts-tiles` horizontal carousel NOT yet checked for an edge-fade cue.
- C5 ✅ edge fade exists; Growth-tier summary wraps below `lg` (no money truncation).
- C6 ✅ `EditorSection` summary stacks under the title and wraps on phones.
- C7 ✅ crypto Select-all / Clear-all = flexible full-width pair on phones.
- C8 ✅ verified by rerun2 (no CLIP-R at 1024).
- C9 ✅ desktop settings rail: Developers row removed (Referrals kept; phone index "More" group unchanged);
  "Account details" → **"Brand profile"** (`settingsPage.brandProfile`; NOT "Business profile" — the app's finalized
  terminology is "brand", en copy already says "Brand profile, logo, and details"). Notification prefs have ONE home:
  `NotificationPage initialTab="settings"` (used by Settings → Notifications) renders prefs only, no tabs; `/notifications`
  = inbox + `notifications-settings-link` → `/settings?section=notifications`; `/notifications?tab=settings` redirects there;
  dashboard attention item href updated. Old testids `notifications-inbox-tab` / `notifications-settings-tab` are GONE
  (new: `notifications-inbox-heading`, `notifications-settings-link`).
- C10 ✅ documented in `design_guidelines.json` → `selected_state_system`, `shell_dark_mode`, `touch_and_pointer_targets`
  (dark bottom bar / sheets already use warm-black `DARK.surface`). Dark screenshot on iphone-15-pro NOT yet taken.
- C11 ✅ nav-reveal flags already in localStorage (Part 1). NEW stale-while-revalidate brand list in
  `contexts/CompanyDataContext.tsx` (`dp_brand_list_cache:v1`, scoped to JWT user id, non-empty only, read in a post-mount
  effect to avoid hydration mismatch, passed as SWR `fallbackData`; `clearCachedBrands()` called from `helpers/signOut.ts`).
- Other fixes: sidebar density (≤940 tall rows 34 = padding 4; ≤760 tall rows 32 + tighter section toggles/gaps);
  footer one line on short screens (build id → Status link title); Transactions first column 1.05fr; dashboard Recent
  transactions amount line wraps whole segments (`recent-txn-amount`); CompactTitleBar `phoneGutter` prop (0 on dashboard);
  receipts phone card: number + amount row 1, customer + status row 2 (`invoice-card-number`), less nested padding.

## 4. REMAINING TASKS (in this order)
1. `tsc --noEmit` + ESLint on touched files → fix.
2. **i18n** (6 locales `langs/locales/{en,de,es,fr,nl,pt}/`): add `common.json` keys used with English defaultValues:
   `filters`, `clearFilters`, `filtersDone`, `selectItems`, `selectDone` (top level) and `settingsPage.brandProfile`
   (en "Brand profile", de "Markenprofil", es "Perfil de marca", fr "Profil de la marque", nl "Merkprofiel", pt "Perfil da marca");
   `notifications.json` → `notificationSettingsLink` ("Notification settings"). Use `scripts/qa/add_i18n_keys.py` if it fits.
3. **C12 not started:** More sheet first open 1.2–2 s → `Components/UI/BottomSheet` has `ModalProps={{ keepMounted: false }}`;
   add an opt-in `keepMountedAfterOpen` prop (track `hasOpened` state → keepMounted true after first open) and use it in
   `MobileNavigationBar/MoreSheet.tsx`. Check useBackToClose still works when the drawer stays mounted.
4. **C13 type scale not started:** ≤ 8 font sizes/page, none < 12px. Offenders seen: TransactionsTable header `fontSize 10.5px`
   at md-down, `EYEBROW_SX` 11px, PeriodTotals done, payouts/receipts 11.5px captions, invoices table `isMobile ? 10/11`,
   PaymentLinksTable `11.5px` date caption, sidebar etc. Use `TYPE_SCALE` from `styles/shellTokens.ts`. Measure with the
   harness `fontSizes` / `tinyText` / `smallText`.
5. Rebuild + swap (§0), then **audit re-run 3** on the FULL matrix:
   `OUT=/app/test_reports/ux_layout_audit_rerun3; node scripts/qa/ux_layout_audit.mjs --out=$OUT --devices=desktop-1280,desktop-1440,desktop-1920,desktop-2560,ipad-mini-portrait,ipad-mini-landscape,ipad-pro11-portrait,ipad-pro11-landscape,galaxy-tab-s4,iphone-se3,iphone-15-pro,pixel-8,galaxy-s24 &`
   (≈ 4 min/device; run in background, poll the log) + `--themes=dark --devices=iphone-15-pro` for C10, then
   `python3 scripts/qa/ux_layout_audit_summary.py $OUT`. Check acceptance metrics (audit §9 end): 0 truncated money,
   tap<24 = 0 on desktop, tap<44 = 0 on touch (outside running text), sidebar every row visible at 1280×720/800 & 1440×900
   (look at `desktop-1280/dashboard__fold.jpg`), create-pay-link @ galaxy-s24 no CLIP-R, payouts tiles fade cue (C4).
   Also add a `1280x720` device to the harness DEVICES if you want the strict metric.
6. **Testing agent (frontend only)** — brief from Part 1 §2.D still applies, plus Part-2 testids above (filter sheets for
   customers/products/receipts period, invoices-pagination, paylinks `data-condensed` at 1280, notifications-settings-link +
   `/notifications?tab=settings` redirect, settings rail has NO `settings-rail-developers`, "Brand profile" label,
   rows-per-page auto (25 at 1920×1080) + persistence). LIVE prod DB → mock every non-GET. Fix everything it reports.
7. Update `memory/PRD.md` + `memory/CHANGELOG.md` (not updated this session), then finish.

## 5. Gotchas learned this session
- Platform restore of `/app` can still be running when the agent starts (empty `/app` for ~1 min) — wait/re-check before acting.
- `sx` numeric padding/margin = theme spacing ×8 → always pass px strings in tap helpers.
- MUI emotion cache is `prepend: true` → globals.css wins at equal specificity; attribute rules are doubled for safety.
- Foreground `next build` / any command holding a background child's stdout times out the tool — redirect output + `&`.
