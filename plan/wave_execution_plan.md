# Dashboard redesign — execution plan (post-fork, June 2026)

## STATUS BOARD (updated by the fork agent, June 2026 — user approved "proceed exactly as above")
DONE:  Wave 1 (Command Centre) — testing_agent iteration_178 100%.
DONE:  2a Transactions (top-up API, Needs-action filter, TxRangePresets, TxResolveActions) — smoke-tested only.
DONE:  2b Payouts (GET /api/dashboard/payouts, PayoutAttention/PayoutTiles/WalletsTimeline/RecentForwards) — smoke only.
DONE:  2c-part1 Wallet-security merge — Components/Page/Settings/SecuritySection.tsx wired in
       pages/settings/index.tsx (?section=security); pages/wallet/security.tsx = SSR redirect;
       ProfilePage trimmed; WalletSecurity/index.tsx + DevicesCard.tsx deleted; /wallet "Security" button
       → /settings?section=security. (pages/wallet-security.tsx is the PUBLIC email "revert change" page — keep.)

REMAINING (in order):
[x] 2c-fix  SectionSkeleton → SectionLoading (FE tsc 0).
[x] 2c-wallets  DONE: coinsWithoutWallet() exported (overviewQueries) + `coverage.missing_coins` on GET
      /api/dashboard/payouts (cache v2); Components/Page/Wallet/{CoverageStrip,WalletSecurityStrip,WalletCardMeta}.tsx
      (AddressFormatBadge + LastForwardRow); helpers/addressFormat.ts (refundModalShared re-exports);
      Wallet onAddWallet(crypto?) pre-selects coin; i18n scripts/i18n_wallets_wave2.py. Smoke-screenshot OK.
[x] 2d Receipts & Tax  DONE: NEW GET /api/invoices/period-summary (controller/invoicePeriodSummary.ts; collected=
      GROSS settled, fees=gross−net, tax=buyer tax from paid tbl_product_order, receipts_count; Redis 60s);
      GET /api/invoices now accepts start_date/end_date; Components/Page/Invoices/{invoicePeriods.ts,
      usePeriodSummary.ts,PeriodTotals.tsx,ReceiptsEmptyState.tsx}; pages/invoices.tsx: page-wide period
      (?period=), header tiles + "Export period (CSV)", tax-tab duplicate select/export removed, teaching
      empty state. GOTCHA fixed: open-ended presets must NOT send end_date=now (SWR key churn → infinite
      refetch). i18n scripts/i18n_invoices_wave2.py. Smoke-screenshot OK (thisMonth $2,593.59 / $0 / $89.13).
[x] TEST  Wave 2 regression sweep DONE — testing_agent iteration_181 (100% backend + frontend): Transactions
      presets/filters/deep link, Payouts root/tiles/wallets/recent/range/export, Payout addresses strips,
      /wallet/security → Settings → Security, Receipts & Tax period totals/export. Wave 2 = SHIPPED.
[x] 3a Payment links  DONE: backend services/paymentLinks/linkStats.ts (30d settled count/USD, all-time, last paid →
      `stats` on GET /api/pay/getPaymentLinks); FE Last-30-days column (LinkRowExtras Last30Cell), Expiring-soon
      badge (<48h), inline QR popover + share, status filter "Earning (30d)" / "Expiring soon"; in-page create
      buttons removed (header "+ New" only). i18n scripts/i18n_paylinks_wave3a.py. Smoke OK.
[x] 3b Your page  DONE: NEW GET /api/user/creator/funnel?period=7d|30d|90d (controller/user/creatorFunnel.ts:
      views=Redis daily buckets, checkouts=tips+orders started, paid=completed tips+paid orders, paid_usd);
      Components/Page/Storefront/PageFunnelHeader.tsx (publish-state pill + URL copy/open, live-preview thumb =
      scaled CreatorLivePreview, views→checkouts→paid funnel + 7D/30D/90D, ONE primary "Edit page" → scrolls to
      #creator-edit-panel; unclaimed state → "Claim handle"; tips-off nudge). Old status banner / 3 stat tiles /
      tips CTA removed from PageTab; layout header action removed (was "View my page" → now in the card).
      i18n scripts/i18n_storefront_wave3b.py. Smoke OK (devhub: 7 views → 32 checkouts → 6 paid $50 / 90d).
[x] 3c Customers  DONE: customerDirectoryService adds preferred_asset (most-used coin), last_paid_usd/last_paid_asset;
      FE table columns "Pays with" (CoinChips) + "Last paid" (amount · date), mobile card + CSV export updated.
[x] 3d Refer & earn  DONE: GET /api/referral/list rows flattened (referred_name/email, created_at) + reward_status
      pending|earned|paid with accrued/paid/unpaid USD; FE row shows status chip + reward chip + joined date.
      (No referral rows exist on prod → verified by code + tsc only.)
[x] 3e Settings  DONE: "Language" section (Components/Page/Settings/LanguageSection.tsx, Account group, ?section=
      language) reusing setAppLanguage (saves to account).
[x] 3f Developers  DONE: NEW GET /api/dashboard/developer-health?company_id (controller/developerHealthController.ts:
      24h success rate/failed/avg ms + last failure + configured/paused endpoint; API keys age + rotate_due ≥365d);
      Components/Page/API/DeveloperHealthStrip.tsx (3 tiles: Webhooks w/ "Retry last failure" → resend endpoint,
      API keys w/ rotate reminder, Quick links Docs/Events/API reference) above the tabs on /developer-keys.
[x] 3g Notifications  DONE: type filter chips All/Payments/Security/System/Growth (notificationKind.ts) on top of
      day grouping; dashboard "Needs attention" rows mirrored into the inbox incl. dismissed ones ("Hidden on the
      dashboard" + "Show on dashboard" restore) via useAttentionItems({includeDismissed}) + restore().
      i18n scripts/i18n_wave3_pages.py (3c–3g keys). Smoke OK.
[x] TEST  Wave 3 regression sweep DONE — iteration_181: Payment links stats/QR, Your page funnel header,
      Customers columns, Referrals (no rows on prod), Settings Language, Developer health strip, Notification
      kind filter. Wave 3 = SHIPPED.
NOW:   Wave 3 CODED (3a–3g, smoke-tested). The Wave 2+3 testing_agent sweep is PARKED until the user asks.
       Emails/pages epic (/app/plan/emails_pages_audit_plan.md): Phase 1 audit DONE, Wave 4 emails DONE (iter 179),
       Wave 5 hosted checkout + buyer pages DONE (iter 180: rate-lock tiers, /payment/* states, checkout trust cues,
       receipt contact/refund/print, order contact + receipt link) + global "Wallet → Payout address" rename
       (scripts/i18n/rename_wallet_to_payout_address.py, 6 langs, UI + emails + API copy). Wave 6 creator pages DONE
       (iter 181: supporter wall opt-in + migration 0028, presets $10/$25/$50 default, non-custodial note, shop grid
       rules 4-col/>8 cats/>20 search, phone sticky buy bar). Waves 2–3 regression sweep DONE (iter 181) → SHIPPED.
       Wave 7 (partial, iter 182): /about legitimacy block + /fees worked example DONE; Wave 8 (partial): create-pay-link
       single form DONE; bonus: tip thank-you card (canvas PNG, download/share) DONE. Wave 7 COMPLETE (iter 183: landing
       trust strip + docs phone nav); Wave 8: product editor live preview DONE (iter 183), KYC status timeline pending;
       bonus: monthly tip goal bar (migration 0029). NEXT: KYC status timeline → Part F cross-wave checks (WCAG AA,
       CWV, non-English samples).
       P0 backlog after that: US sales-tax engine, 1099-DA broker determination.

State at fork: Wave 1 (Command Centre) fully coded (backend `GET /api/dashboard/overview`,
zones 1–6 under `Components/Page/Dashboard/v2026/command/*`), smoke-screenshotted, NOT yet
regression-tested and NOT recorded in PRD.md.

## Step 1 — Verify Wave 1 (blocking, do first)
Test: testing_agent (both).
- Backend: `/api/dashboard/overview` for brands 1 (populated), 71 (2 payments), 165/179 (empty)
  across period=today|7d|30d|90d|1y + custom range; shape, currency FX, cache key, 400/401 paths.
- Frontend: RangeBar (pulse chip + range presets + custom), AttentionFeed rows/dismiss, MoneyRow
  3 tiles + links to Transactions/Payouts, TrendCard toggles + CheckoutHealthLine, Recent payments +
  TopSourcesCard, PlanRow collapse; new-merchant state (Getting-started + faded preview) on brand
  165/179; phone 390 layout; dark mode; no console errors; removed banners/quick actions absent.
- Fix every reported issue → re-test → `finish` + PRD.md "Wave 1 SHIPPED" block.

## Step 2 — Wave 2: Money pages (one page per checkpoint, each testable alone)
2a Transactions — default 30-day range, state-machine filters (confirming/paid/underpaid/overpaid/
   expired/refunded), saved "Needs action" filter, rows: expected vs received · network ·
   confirmations · customer; drawer keeps hash/explorer + resolve actions; export unchanged.
   Test: testing_agent frontend (filters, deep links `?status=`, drawer) + backend filter mapping.
2b Payouts — stuck/failed forwards pinned on top w/ retry/contact; per-wallet timeline; monthly
   total by asset; auto-convert status + toggle MOVES here (off the home).
   Test: backend aggregates (curl) + frontend flows.
2c Payout wallets + Wallet-security merge — accepted-coin coverage (missing first), last forward per
   wallet, address sanity, security status strip; `/wallet-security` content folds into Settings →
   Security and Payout wallets links to it (redirect old route).
   Test: testing_agent frontend (step-up gate untouched).
2d Receipts & Tax — period totals in header (collected · tax · fees), one-click export per period,
   collected-tax + nexus panel kept, teaching empty state.
   Test: curl totals vs DB + screenshot.

## Step 3 — Wave 3: Sell / Grow / Settings pages
Payment links → Your page → Customers → Refer & earn → Settings (Plan & fees, Security) →
Developers → Notifications. Same cadence: build one page, test, checkpoint.

## Guardrails
- SAFE MODE on prod DB: read-only; never mutate merchant data. Backend is ts-node → `sudo
  supervisorctl restart backend` after backend edits. New backend files ≤500 lines.
- Cross-cutting rules from plan.md §4: one create control (header "+ New"), one status vocabulary
  (helpers/txStatus.ts), banners retired, default 30-day range, phone layout = same content.
