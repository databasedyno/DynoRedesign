# DynoPay UI/UX Redesign Blueprint — "Quiet Money"
**Status: BUILD IN PROGRESS — Phase P1 (Foundation) SHIPPED 2026-08-21.**
Companion machine-readable tokens: `/app/design_guidelines.json` (written by the design expert this session).

> ### Build progress
> - **P1 — Foundation ✅ SHIPPED (2026-08-21)** — light+dark color tokens (single indigo accent
>   #4338CA light / #6366F1 dark, slate/zinc surfaces + 1px hairlines) in `styles/appTheme.ts`;
>   typography consolidated to Manrope (headings via `--font-hero`) + IBM Plex Sans (body, `--font-sans`)
>   + IBM Plex Mono (money, `--font-tech`/`MONO`) in `pages/_app.tsx`+`styles/uiKit.tsx` (Geist/Unbounded/
>   Inter/Roboto-Mono wiring dropped); buttons/inputs/cards restyled (8px radius, no rest shadow, indigo
>   focus) via app-theme component overrides; NEW `Components/UI/StatusDot.tsx` primitive + shared
>   `StatusPill` converted to dot+text. Default theme mode intentionally NOT flipped (user choice).
>   Per-table status→StatusDot rollout deferred to P3 (Tables). `BRAND_ACCENT` deepened to #4338CA.
> - **P2 — Chrome ✅ SHIPPED (2026-08-21)** — header slimmed 7→4 (logo · company switcher · +New ·
>   bell · avatar); theme toggle, language switcher and the profile-completeness prompt moved INTO the
>   avatar menu (`Components/UI/UserMenu`, `Components/Layout/NewHeader`). Quiet sidebar: active row is now
>   a 3px indigo left-bar + faint tint + indigo text/icon (no filled glow) via `NewSidebar/styled.tsx`+
>   `index.tsx`; referral card + social-share icons removed from the nav and NEW pills dropped (rule 5),
>   Help & Support kept (`ReferralAndKnowledge` slimmed). **Deferred → P2b:** tablet icon-rail auto-trigger
>   at 1024 + mobile bottom-tab threshold (1024→640) — the responsive breakpoint rework (riskiest; wants a
>   dedicated testing pass).
> - **P2b — Responsive claim ✅ SHIPPED (2026-08-21)** — breakpoint scheme reworked in
>   `Containers/Client/index.tsx` + `NewSidebar/index.tsx` + `NewHeader/index.tsx`:
>   **<768** = mobile bottom-bar + top-left hamburger drawer · **768–1024** = auto 72px icon rail
>   (`isTabletRail` media query forces collapse regardless of the user's manual pref) · **≥1024** = full
>   sidebar. NewSidebar now takes `forceCollapsed` + `inDrawer` props so "compact" rendering is driven by
>   the drawer (not raw viewport) and the rail renders correctly across the whole tablet band. Simplified
>   the blueprint's 640/768 pair to a single 768 cutoff (skipped the 640–768 transitional nuance).
>   NOTE: ≥1024 full-sidebar state verified in-preview; the 768–1024 rail + <768 bottom-bar states are
>   code-verified only (the screenshot tool is locked to a 1920 viewport) — pending a real viewport test.
> - **P3 — Tables ✅ SHIPPED (2026-08-22)** — "chip forest" killed. `StatusDot` (dot+text) now renders
>   status across Transactions (`TransactionsTable.tsx`: settled→emerald, confirmed→indigo, pending/
>   processing→amber, failed→rose, unpaid→hollow slate) and Pay-links (`PaymentLinksTable.tsx`:
>   completed/paid→emerald, active→indigo, expired→neutral, pending→amber) — mobile card + desktop table.
>   Invoices already used the shared `StatusPill` (converted to dot+text in P2). Coin chips quieted in
>   `Transactions/styled.tsx` (`CryptoIconChip`: transparent bg + hairline 8px, no coin-tint/halo/logo-ring
>   — the coin ICON carries the only colour). Removed dead status-icon imports. Also right-aligned the
>   mono money columns (Transactions Amount + USD Value via grid-cell `justify-content:flex-end`;
>   Pay-links USD Value via `Header align="right"` + cell `textAlign:right`) and quieted the transaction
>   source/method badge (`SourceBadge` → low-emphasis grey text + muted icon, no per-type coloured pill).
> - **P4 — Dashboard ✅ SHIPPED (2026-08-22)** — the flagship re-layout. New `BalanceStrip`
>   (eyebrow greeting + range segmented control + settings menu + big mono volume/delta + metric
>   dropdown; the page-header keeps the single "+ Payment link" CTA so there is exactly one primary),
>   `ActionsRow` (the 2×2 drag-dock → 4 quiet ghost-button shortcuts, honouring saved pins),
>   `VolumeChart` (the area chart on its own card), quieted `FeeTierCard` (hairline single-indigo bar,
>   the filled green tier pill → a plain inline "Current tier · Growth · 1%" line), quieted `KpiStrip`
>   (tiny-caps labels, coloured icons removed; payments spark kept), and `EmptyHero` (preserves the
>   "make first sale" nudge). `v2026/index.tsx` recomposed to the P4 grid: balance strip → actions →
>   chart(8)+rail(4: fee-tier + grow) → 3 KPIs → recent activity → assets. CommandBar/VolumeHero/
>   QuickActionsDock retired from the composition (files kept). tsc 0-err, ESLint clean, verified
>   in-preview (dark, 1920) via full 2-step login. **Deferred:** avatar-menu "Personalize" for action
>   customization; ≤640 KPI horizontal snap-scroll; light-mode + <1200 breakpoint visual pass.
> - **P5 — Public creator page ✅ SHIPPED (2026-08-22, §5.13 part)** — quieted the SupportWidget
>   "Support me" card (indigo-tinted fill + accent border → surface bg + hairline border, so no page
>   fill competes with the cover) and the CreatorProfile featured-campaign box; added a luminance
>   contrast-guard (`readableOn`) so on-accent CTA text stays legible (fixed dark-ink-on-deep-indigo
>   → white). CreatorShopSection was already on-spec (hairline cards, mono price, ghost "Buy →").
>   tsc 0-err, ESLint clean (pre-existing `LinkCard` nested-component warning left untouched).
>   Verified on /hostbay. **§5.12 hosted checkout /pay (CleanCheckoutV2) ✅ SHIPPED (2026-08-22)** —
>   the flow was already ~9.1/10 (single centered card, mono `$`/coin/address amounts, big QR,
>   address+amount one-tap copy, plain-language states, rate-freshness dot). Restyle (no payment/poll
>   logic touched): quieted the filled indigo status pill → dot + text + hairline; added a **thin
>   countdown progress bar** (new `totalSeconds` denominator; indigo, amber under 20%) so the timer
>   reads at a glance instead of mm:ss text only. Verified against a throwaway $1 hostbay link
>   (created + deleted via API). tsc 0-err. **P5 COMPLETE.**
> - **P6 — Marketing ✅ SHIPPED (2026-08-22, reskin+lime part)** — retired the last brand lime
>   (`VOLT #CCFF00`) across the landing: `theme.v3.ts` + `swiss.ts` VOLT → indigo-300 (#818CF8 on
>   dark), swiss `accentText` light olive #5A6B00 → deep indigo #4338CA, `accentSoft` lime→indigo,
>   `SwissSectionHead` invert accent, `TryItNowV3` terminal glow/border/curl highlight, and the dead
>   `swiss-pulse` keyframe in globals.css. Landing/fees/about now render one indigo accent, no lime.
>   Verified on / (feature cards, eyebrows, FAQ, terminal all indigo). Out-of-scope lime left as-is:
>   auth/app modals, confetti bursts, and the creator-selectable "Lime" palette option. **Deferred
>   (optional):** swapping the polished coded hero mock for a real light-dashboard screenshot — the
>   current HeroPlayground is already an on-brand, higher-fidelity animated product mock, so a static
>   swap is a judgement call left to the owner rather than a regression risk.
>
> - **P7 — Remaining surfaces ✅ SHIPPED (2026-08-22, long-tail per-page pass)** — brought the
>   pages that had only inherited the P1 token swap up to the Quiet Money bar (killed filled
>   colored chips/pills → StatusDot dot+text; no logic/data changes, safe vs LIVE prod DB):
>   • **Developers §5.10** — `API/styled.tsx` `Tags` filled-green pill → calm icon+emerald-text badge
>     (no fill/border/pill); sandbox badge override → transparent indigo text; `WebhookConsoleSection`
>     delivery-status filled Chip → `StatusDot` (settled/failed/pending) with HTTP code. Code islands
>     already dark. Count/metadata chips left as-is (Rule 2 allows chips for counts).
>   • **Customers §5.8** — `Customers/index.tsx` API-source Chip → quiet icon+text label; detail-dialog
>     txn type + status filled chips → `StatusDot`.
>   • **Notifications §5.11** — unread filled-row background → **3px indigo left bar** (no filled rows);
>     category Chip → `StatusDot` (semantic tone from type); push Active/Blocked chips → StatusDot.
>   • **Storefront/Products §5.9** — `ProductsTab` status Chip → `StatusDot` (live=settled/draft=pending/
>     else neutral); removed dead `statusChipColors` helper. (Two-pane live preview already existed.)
>   • **Invoices §5.7** — `InvoicePreviewDrawer` backdrop → darker slate (rgba(2,6,23,.72)/rgba(15,23,42,.62))
>     so the white PDF paper pops. StatusPill already dot+text from P2.
>   • **Marketing §5.1** — `system-status` overall banner: filled pill → hairline + green **dot** + tinted
>     text (rounded-full→8px, legacy `OutfitSemiBold`→var(--font-sans)); incident badge → dot+text;
>     removed dead getOverallChipBg + unused successIcon/SuccessChip imports. about/blog/help/legal/for
>     verified already clean (no leftover lime `#CCFF00`, no loud chips — inherit P1/P6 tokens).
>   All edited files eslint-clean; all 6 routes compile 200; /system-status visually verified (public).
>   Authed pages (developer-keys/customers/notifications/storefront/invoices) pending owner or
>   frontend-testing-agent visual QA. **P7 COMPLETE.**
>
> - **P8 — Onboarding flow ✅ SHIPPED (2026-08-23b)** — the one surface P1–P7 never scoped
>   (it only inherited the P1 token swap). Brought all 5 onboarding components to the Quiet Money
>   bar (frontend-only, no logic/data changes): `OnboardingChecklist` card 16→12px radius, rest
>   `boxShadow` removed, `background.paper`/theme-border tokens; the COMPLETED step no longer uses a
>   filled green card+border → now the same neutral surface + hairline as every row, marked by an
>   emerald check (#047857 light / #34D399 dark) + strikethrough; step icons lost their filled tinted
>   squares (transparent, indigo icon; the "next" step keeps a 1px indigo border as the single accent);
>   hover fill → neutral `action.hover`; dark-mode AA fix (dropped the stacked 0.6/0.7 row opacity that
>   pushed locked/completed text below 4.5:1, lock icon → text.secondary). `StepIndicator` +
>   `CreateCompanyModal` (18→12px, inputs 10→8px) + `CelebrationOverlay` (20→16px, retired the lime
>   #CCFF00 confetti → indigo/emerald/gold) + `OnboardingBanner` (16→12px) all repointed off hardcoded
>   greys/greens to theme tokens (fixes broken dark-mode borders). Modals kept as modals (drawer
>   conversion deferred — shared components, higher risk). VERIFIED by the frontend testing agent
>   (iteration_55, 6/6 PASS, real computed styles in light+dark, /dashboard regression clean, 0 console
>   errors). NOT visually verified (unreachable without completing onboarding on the LIVE DB, code-review
>   only): CelebrationOverlay, CreateCompanyModal, OnboardingBanner.
>
> **Redesign status: P1–P8 shipped + §7 responsive sweep RUN (2026-08-23e).** The 1920→390 ×
> light/dark acceptance sweep was executed (testing agent iteration_56 found the issues,
> iteration_57 verified the fixes 5/5 PASS with real-viewport geometry + computed styles).
> FIXED: (1) 1024 off-by-one breakpoint `isTabletRail` 1023.95→1024px (restored the icon rail at
> 1024 + fixed the dashboard right-column clip — reclaims 952px content); (2) 390 in-app header
> avatar clip (CompanySelector wrapper → flex:'1 1 auto', minWidth:0, overflow:hidden so it
> shrinks/ellipsis instead of pushing the avatar off); (3) landing 1280 CTA clip (HomeHeader
> LeftGroup gap 72→36px + StatusPillWrap hidden below 1360px); (4) payment/failed 390 buttons now
> stacked full-width + minHeight 44; (5) sidebar section-label dark contrast text.disabled→
> text.secondary (3.67:1 → 6.91:1, WCAG AA). Regression clean: nav pattern 6/6 breakpoints, no
> horizontal overflow 10/10 page×viewport, 0 console errors.
>
> **§7 DEFERRED BACKLOG (not blockers; documented for a focused follow-up):**
> - **§4.2 responsive-table primitive** (biggest item): /transactions + /pay-links show CARDS at
>   768 (spec wants tables ≥768); /invoices + /customers show scrollable TABLES at 390 (spec wants
>   card lists ≤640); /transactions ID column not sticky. Risky cross-cutting refactor on live
>   payment tables — do as its own pass with a shared primitive.
> - **≥44px touch targets at ≤1024**: header controls (create/bell) are constrained by the 40px
>   mobile header height — needs a header-height decision, not a spot bump.
> - Scroll-affordance (edge fade) on the /settings rail + /transactions source-chip row (both are
>   scrollable, just no visual hint). Landing hero image right-edge bleed. Bottom-tab tab set.
> - Nice-to-have: centralise the 768/1024 rail band + the 1360 landing breakpoint into shared
>   tokens (avoids the off-by-one returning); add data-testid to dashboard quick-action buttons.
>
> **P8b — Auth + payment-result sweep ✅ (2026-08-23c):** audit found the last un-migrated remnants
> (typography was already 100% tokenized app-wide; all remaining hardcoded greys are legit
> `dark ? rgba : "#E9ECF2"` dual-mode pairs or `theme.border ?? fallback`). Fixed: `pages/auth/register.tsx`
> account-creation confetti lime `#CCFF00`/`#B4E600` → indigo/emerald/amber `["#4338CA","#818CF8","#10B981","#F59E0B"]`,
> OTP badge 16→12px + replaced ✉️ emoji with MUI MailOutline/SmartphoneOutlined (method-aware);
> `Components/UI/AuthLayout/PurposePicker.tsx` "developers" persona light-mode contrast `#CCFF00` → `#FFFFFF`;
> `pages/payment/success.tsx` + `pages/payment/failed.tsx` card 18→12px; `pages/auth/secure-account.tsx` card 16→12px.
> Verified: no residual lime/emoji, all routes 200, 0 compile errors. NOT screenshot-verified (pod's
> lightweight screenshot tool can't render client-hydrated in-app content; confetti/OTP/success steps are
> gated behind a real OTP so not automatable). Cosmetic-only — no auth logic touched.


Grounding: live screenshots of the current landing / dashboard / transactions (2026-08-21), the 27-surface
audit (`memory/UIUX_AUDIT_2026-06.md`, scored 8.4/10), and a Coinbase/BitPay/Stripe-class benchmark brief.

---

## 0. Diagnosis — why DynoPay feels "busy / not clean" next to Coinbase & BitPay

The current UI is *good* (audit 8.4/10) but it is **loud**. Coinbase and BitPay feel calm because they
follow four disciplines DynoPay currently breaks:

| Discipline | Coinbase / BitPay | DynoPay today |
|---|---|---|
| **One accent per view** | A single brand blue; everything else is neutral | Indigo accent + green fee-tier panel + lime/creator swatches + colored coin chips + colored source chips + colored status pills, all on one screen |
| **Data is the only hero** | White/near-white chrome, big numbers, thin 1px rules | Dark-first chrome with glowing sidebar states, gradient charts, referral card with 3 social icons *inside the nav* |
| **Type does the hierarchy** | 2 typefaces, heavy use of size/weight | 5+ families in play (Geist chrome, Inter content, Roboto Mono figures, IBM Plex Mono "tech", Unbounded display) |
| **Chrome earns its place** | Header = logo, search, avatar | Header = company switcher + "+New" + bell + theme + language + "Finish your business profile" pill + avatar (7 items) |

**Concrete evidence from today's screenshots**
- *Transactions row anatomy*: 2 source chips + colored coin chip + mono amount + mono USD + VAT column +
  date + colored status pill = **7 competing visual objects per row**. Coinbase renders the same
  information as: icon · name · right-aligned amount · dot+word status = 4 quiet objects.
- *Dashboard above the fold*: greeting, date, 5 range toggles, 3 hero tabs, giant mono number, delta chip,
  gradient chart, quick-actions grid with badges + a spotlight tooltip, fee-tier panel with 3 typographic
  styles, referral card. That's **6 modules shouting simultaneously**.
- *Landing hero*: ultra-black display type + mock tip-card with 8 chips + live badge + toast — charismatic,
  but the marketing and the product look like **two different companies** (lime/Unbounded vs indigo/mono).

**The verdict from the design expert**: keep the excellent bones (nav IA, mobile bottom-tabs, checkout flow,
mono figures) and perform a **paradigm shift in restraint** — light-first, 3 typefaces, dot-status, 1px borders,
whitespace as the primary grouping tool.

---

## 1. The new identity — "High-Trust Finance"

### 1.1 Theme strategy: **light-first** (dark retained as preference)
Coinbase, BitPay, Stripe all lead light because stark white + precise type projects institutional
authority; dark UIs read "trading terminal", light UIs read "bank". Decision by the design expert:
- **Default = light** for the merchant app AND marketing. First-run lands on light.
- Dark mode stays fully supported (the existing `theme-mode-inapp` toggle moves into the avatar menu).
- The hosted checkout follows the **buyer's** system preference (money-anxiety moment → familiarity wins).

### 1.2 Color tokens

| Token | Light | Dark |
|---|---|---|
| background | `#FFFFFF` | `#09090B` (zinc-950) |
| surface (cards) | `#FAFAFC` | `#18181B` (zinc-900) |
| surface hover | `#F1F5F9` | `#27272A` |
| border (the workhorse) | `#E2E8F0` (slate-200) | `#27272A` |
| text primary | `#0F172A` (slate-900) | `#FAFAFA` |
| text secondary | `#64748B` → prefer `#475569` on white | `#A1A1AA` |
| **brand accent** | `#4338CA` (indigo-700, deepened from today's #4F46E5 for trust on white) | `#6366F1` (indigo-500) |
| settled / success | emerald-700 text + emerald-500 dot | emerald-400 text |
| pending | amber-700 text + amber-500 dot | amber-400 text |
| failed / risk | rose-700 text + rose-500 dot | rose-400 text |

Rules:
- **Semantic colors appear ONLY as 6px dots + tinted text.** Never as filled pills, never as card
  backgrounds. (Kills the "chip forest".)
- Coin brand colors (BTC orange, ETH blue…) shrink to the **16px coin icon only** — the surrounding chip
  background is removed everywhere.
- The lime `#CCFF00` era is fully retired from marketing (it already left the app).

### 1.3 Typography — 5+ families → 3

| Role | Family | Notes |
|---|---|---|
| Headings H1–H4, hero numbers' labels | **Manrope** (700/800, tracking-tight) | Already preloaded in `_document` — zero new font cost. Replaces Unbounded + Geist for headings. |
| Body, tables, forms, nav | **IBM Plex Sans** (400/500) | Already loaded via next/font. Replaces Inter as content font. |
| **All money, crypto amounts, addresses, IDs** | **IBM Plex Mono** (400/500, tabular) | Replaces Roboto Mono AND Geist Mono AND "tech" IBM Plex usage — one mono, everywhere. |

Hierarchy (Tailwind-equivalent sizes, mapped to MUI variants at implementation):
- H1 hero: `text-4xl sm:text-5xl lg:text-6xl tracking-tighter`
- H2 section: `text-2xl sm:text-3xl lg:text-4xl`
- H3 card/widget title: `text-lg sm:text-xl` semi-bold
- Body: `text-sm` in tables, `text-base` in marketing
- Overlines/eyebrows: `text-xs uppercase tracking-widest` secondary color
- **Big money numbers**: IBM Plex Mono 500, sizes clamp `2.25rem → 3.5rem`; never gradient-clipped.

### 1.4 Space, radius, elevation
- Radius: **8px cards / 6px inner elements**. Pills (`rounded-full`) reserved for avatars + primary CTAs only.
- Card recipe: flat solid surface + **1px border**, **no drop shadow at rest**; `shadow-sm` on hover only.
- Padding: `24–32px` inside cards; table cells `12px × 16px`.
- Section rhythm on marketing: `py-24/py-32` — double today's spacing.
- Depth = layering + 1px rules, **not** shadows. Glassmorphism (`backdrop-blur 12–24px`, `bg-white/70`)
  allowed ONLY on the sticky app header and mobile sticky bars.

### 1.5 Motion
- Feedback-only micro-interactions: button press `scale .98 / 100ms`; row hover = background tint transition.
- Page enter: 4px fade-up, 200ms. No decorative delays, no confetti outside the two "money moments"
  (first payment celebration + checkout settled), which stay.
- Transition specific properties only (opacity/transform/background-color) — never `transition: all`.

---

## 2. The Calm Rules (the restraint system — the core of the redesign)

These 8 rules ARE the Coinbase-class feel. Every page directive in §4 derives from them.

1. **One accent per view.** The brand indigo appears on exactly one primary action per screen. Everything
   else is neutral (borders/text) or semantic dots.
2. **Chips must die where text works.** A chip is allowed only when it's *interactive* (filter) or a
   *count*. Source ("API", "Payment link"), coin names, statuses → plain text + small icon/dot.
3. **Max 3 modules above the fold** in the app (e.g. Dashboard: number+chart, KPIs, one action rail).
   Everything else scrolls.
4. **Numbers right-align, in mono, always** — crypto amount as small secondary line under the fiat value,
   not as a separate loud column.
5. **The nav sells nothing.** Referral card, social icons, badges and "NEW" pills leave the sidebar.
   Referrals live on their page + one dismissible banner max.
6. **One promotion surface per page, dismissible.** ("Finish your business profile", fee-free banner,
   claim-handle banner never stack.)
7. **Empty states teach, never decorate.** Icon + one sentence + one primary CTA. No illustrations of desks.
8. **Marketing and app share one wardrobe.** Same 3 typefaces, same indigo, same border discipline —
   the landing page must look like the dashboard's public face.

---

## 3. Component language

| Component | Redesign spec |
|---|---|
| **Tables** | Header row: overline-style tiny caps, no filled header background. Rows: 1px hairline separators, hover tint, `py-3`. Numeric columns right-aligned mono. Status = dot+word. Row click opens detail; kebab menu on hover for actions (fixes clipped Actions column). Sticky first column on horizontal scroll. |
| **Status** | `● Settled` `● Pending` `● Failed` `○ Unpaid` — 6px dot + word, tinted text. One component app-wide (`<StatusDot/>`). |
| **Buttons** | Primary: solid indigo, 8px radius, medium weight. Secondary: 1px slate border, transparent. Ghost: text-only. Destructive: rose text → solid rose only in confirm dialogs. |
| **Inputs** | 1px border, 8px radius, indigo focus ring (2px), label above (no floating labels), helper/error text below in 13px. |
| **Cards / KPIs** | White (or zinc-900) + 1px border. KPI = tiny caps label, big mono number, small ▲/▼ delta in semantic tint. No icon backgrounds, no colored fills. |
| **Header (app)** | Glass: `backdrop-blur-xl bg-white/70 border-b`. Contents: company switcher (compact), global search (⌘K), "+ New", bell, avatar. Theme, language, profile-completeness move INSIDE the avatar menu. 7 items → 5. |
| **Sidebar** | 240px, white surface, 1px right border. Active item = indigo text + 2px left indigo bar + faint tint — **no glowing filled block**. Groups keep tiny-caps labels. Referral card removed (rule 5). Collapse control stays. |
| **Modals vs Drawers** | Creation/editing flows → right-side drawer (Sheet), 480–560px, keeps list context. Modals only for confirm/destructive. |
| **Toasts** | One system (sonner-style), top-right desktop / above-tab-bar mobile, neutral surface + semantic dot. |
| **Charts** | Single indigo line + 8%-opacity gradient fill, hairline grid, mono axis labels, no dots at rest. |
| **Empty states** | 40px icon in a bordered circle, H3 + one line + primary CTA. Shared component. |
| **Code blocks (Developers)** | Always-dark syntax blocks even in light mode (the one sanctioned dark island). |

---

## 4. Responsive strategy — the "all screen sizes" claim

### 4.1 Navigation per breakpoint

| Breakpoint | Nav pattern | Notes |
|---|---|---|
| ≥1440 (desktop) | Full sidebar 240px + glass header | Content `max-w-7xl` centered in remaining space — no infinite stretching at 1920+ |
| 1280 (laptop) | Full sidebar | 3-col grids intact |
| **1024 (tablet-L)** | **Icon rail 64px** (icons + tooltips, expandable on tap) | *Fixes the historic weakest breakpoint*: no phone bottom-bar on a 1024 canvas, ~180px reclaimed for tables |
| 768 (tablet-P) | Icon rail 64px | Tables stay tables with horizontal scroll + sticky first column + edge fade |
| ≤640 / 390 (mobile) | Bottom tab bar (Dashboard, Payments, Wallet, More) + glass top bar | Grids → 1 col; tables → card lists |

### 4.2 Table → card transformation rules
- **≥768px: keep the table.** Overflow = horizontal scroll with sticky ID column + visible scrollbar +
  right-edge fade affordance (never silently hide columns — the old 1024 bug).
- **<768px: card list.** Card = line 1: counterparty/source + status dot right; line 2: fiat mono left,
  crypto sub-amount right; line 3: relative date. Tap → detail sheet.
- Column priority when space shrinks (drop right-to-left): VAT → crypto sub-amount → source → date-time
  (becomes relative "2h ago").

### 4.3 Density & touch
- Touch targets ≥44px on ≤1024 even inside table rows (whole row is the target).
- Range toggles (7D/30D/90D/1Y) become a single select on ≤640.
- Sticky mobile CTAs keep the safe-area inset (checkout already does this well — keep).

---

## 5. Per-page directives

Format: **Today → Redesign**, then breakpoint notes where non-obvious.

### 5.1 Marketing

**Landing `/`**
- Today: ultra-black Unbounded hero, busy tip-card mock, lime accents, chip-heavy playground.
- Redesign: Manrope hero (`Get paid in crypto. Every way you sell.` stays — it's excellent copy) in
  slate-900 with a *single* indigo highlight word. Handle-claim playground becomes a flat 1px-border card
  with the live availability check as its one interactive jewel. Product mock replaced by a **real
  screenshot of the redesigned light dashboard** in a browser frame (Stripe pattern — sells the actual UI).
  Trust strip: grayscale chain logos + one line `$42M+ settled · 15+ chains · 0.5% floor`. Bento features
  grid (asymmetric, MODE A), `py-32` rhythm. Sticky promo bar / exit-intent modal frequency-capped.
- Breakpoints: hero playground stacks under H1 at ≤768; bento becomes 1-col at ≤640.

**Fees `/fees`** — already the best page (9.3). Keep the "One number to remember" narrative, restyle to the
new tokens, make the volume→fee slider the hero. **About / Blog / Help / Legal / `/for/[vertical]`** —
token reskin, one shared prose template (max-w-prose, Manrope headings), grayscale imagery. **System
status** — restyle to dot-status list on white; it's a trust page, it must look like the app.

### 5.2 Auth
- Today: solid, but visually detached from the new direction.
- Redesign: split screen. Left 480px: white form, 2-step email→password kept, one indigo button, subtle
  step indicator. Right: quiet brand panel (abstract geometric asset or live trust metrics), hidden ≤1024.
  Persona picker on register: 1px-border radio cards, indigo border on select — no filled backgrounds, no
  confetti until *after* account creation (single burst, then never again).

### 5.3 Dashboard (the flagship — biggest change)
- Today: 6 competing modules (greeting, toggles, hero tabs, quick actions + spotlight, fee tier, grow slot).
- Redesign (12-col grid):
  1. **Row 1 — Balance strip** (col-span-12): "Total volume" mono number + inline delta + period select
     (one control — the 5 toggles and 3 hero tabs collapse into a single segmented control + a "metric"
     dropdown). Right side: the page's ONE primary button `+ Payment link`.
  2. **Row 2 — Chart** (col-span-8) + **right rail** (col-span-4): fee-tier progress as a *single quiet
     line* ("$27,008 / $100,000 · Growth → Scale at 0.7%") with hairline progress bar; below it the grow
     slot (ONE card max, dismissible).
  3. **Row 3 — KPIs** (3 × col-span-4): Payments today / Active wallets / Tax collected as bordered white
     cards, mono numbers, no icons-in-colored-squares.
  4. **Row 4 — Recent activity** (col-span-12): 5-row mini-table in the new quiet style, "View all →".
- Quick-action tiles (2×2 grid + customize + spotlight + reorder hints) → a compact **"Actions" row of
  4 ghost buttons** under the header, customization kept but moved into the avatar-menu "Personalize".
  The two one-time tooltips (spotlight + reorder hint) are removed — a calm UI needs no tour.
- Greeting ("Good evening, hostbay") shrinks to the page eyebrow; the date line is dropped.
- Breakpoints: 1024 → chart col-span-12, rail under it 2-up; ≤640 → everything 1-col, KPI strip becomes a
  horizontal snap-scroll of 3 cards.

### 5.4 Transactions
- Today: 7 visual objects/row (chips everywhere), filter chips row + search + date + wallet + export row.
- Redesign row anatomy: `16px coin icon · Counterparty/Source (plain text, "API · #646" as secondary line)
  · right-aligned $73.97 (mono) with 0.031117 ETH as 12px secondary underneath · relative date · ● Settled`.
  VAT column hidden by default (column-picker to re-enable). Copy-TxID icon on row hover.
- Filter bar: one row — search grows, then `Source ▾ Status ▾ Date ▾ Wallet ▾` selects (chips only while a
  filter is *active*, removable). Export = secondary button far right.
- Detail: row click → right drawer (not modal) with the full journal timeline (feeds the future
  "Settlement Timeline" backlog item).
- Breakpoints: per §4.2; at 1024 all columns visible thanks to rail nav + dropped VAT.

### 5.5 Payment Links
- Today: table clipping risk, create flow is a separate page + success modal.
- Redesign: quiet table (name, URL short + copy, amount mono, uses, created, ● status, hover-kebab). **Create
  flow → right drawer** with live link preview at top; success state inside the drawer (copy + QR + share),
  no navigate-away modal. Products sub-pages inherit the same table/drawer language.

### 5.6 Wallet / Payouts
- Redesign: hero "Total processed" in mono (already close), then **uniform 3-col grid of minimal coin
  cards**: 16px icon + coin name + address short + copy + ● active. Add-wallet stays a drawer with the
  reuse-selector. Kill any gradient card variants.

### 5.7 Invoices / Receipts & Tax
- Keep the PDF preview drawer; backdrop becomes slate-800 so the white PDF "paper" pops. Month group
  headers become tiny-caps + hairline. Tax report gets a one-line explainer.

### 5.8 Customers
- Quiet table + the existing "API customer (restored)" naming. Empty state per rule 7. Wallet
  credit/debit actions → drawer.

### 5.9 Storefront hub & Creator editor
- Two-pane editor: left = form controls, right = **sticky live preview in a device frame** (scaled).
  Theme picker constrained: merchant accents allowed, but preview enforces AA contrast (auto-adjust text
  color). "NEW" badge removed from nav after first visit.

### 5.10 Developers
- Standard light dashboard chrome; **code blocks always dark** (sanctioned island). Keys table: mono key
  previews, reveal-on-click, ● live/test. Webhooks: event checkboxes become a bordered checklist with
  per-event doc links; signing-secret row with masked preview kept.

### 5.11 Settings / Notifications / Referrals / Fees(plan)
- Settings: keep the rail (already good), restyle rows to 1px-border list items; each section max-w-2xl.
- Notifications: single-column inbox, unread = 2px indigo left bar (no filled rows), dot-status categories.
- Referrals: becomes the ONLY referral surface (sidebar card removed): hero code + copy, stats row in
  mono, share buttons as secondary buttons.
- Fees/plan: reuse the marketing fee slider in-app, tier table with hairlines.

### 5.12 Hosted checkout `/pay` (buyer-facing — highest stakes)
- Today: already best-in-class (9.1); redesign = focus, not features.
- Redesign: pale-grey page (`slate-50`), ONE white card `max-w-md` centered. Order: merchant name + amount
  (mono, large) → coin/network selector (flat list, 16px icons, no chip backgrounds) → **QR ≥200px** →
  `SEND EXACTLY 0.031117 ETH` in large mono with one-tap copy → address short+copy → **countdown as a
  thin progress bar** under the card header (not just text). States (waiting/confirming/settled/expired/
  underpaid) keep the plain-language microcopy; settled keeps the single confetti burst + receipt button.
- Mobile: sticky bottom bar `Open in wallet app · SEND EXACTLY …` kept exactly as-is (it's excellent).
- Theme: follows buyer's system preference; both modes specified.

### 5.13 Public creator page `/@handle` & Shop
- Enforce `max-w-2xl` column. Merchant accent drives ONLY: tip buttons, links, progress — never page
  backgrounds beyond the cover. Contrast-guard on accent (compute readable text color). Shop cards: 1px
  border, image, name, mono price, ghost "Add" — Trending/type badges become subtle text labels.
- Cart/checkout inherits §5.12 card language inline.

### 5.14 Admin pages
- Out of scope for the brand push; they inherit the token swap automatically via the shared theme. No
  bespoke work this round.

---

## 6. Implementation map (for the build rounds — after your review)

The app is Next.js + MUI + styled-components (NOT Tailwind), so tokens land in the MUI themes:

| Blueprint piece | Lands in |
|---|---|
| Color tokens light/dark | `styles/theme.ts` (in-app), `styles/authTheme.ts`, `styles/homeTheme.ts`/`homeBento.ts` (marketing), `constants/theme.ts` (`BRAND_ACCENT` → #4338CA light / #6366F1 dark) |
| Typography consolidation | `pages/_app.tsx` next/font setup (Manrope + IBM Plex Sans + IBM Plex Mono already loaded → drop Inter/Roboto Mono/Unbounded wiring), `styles/uiKit.tsx` (`MONO` constant repoint) |
| StatusDot component | new `Components/UI/StatusDot` replacing StatusPill/status chips app-wide |
| Header slimming | `Components/Layout/NewHeader` + `UserMenu` (theme/language/profile-pill move into avatar menu) |
| Sidebar quieting + tablet rail | `Components/Layout/NewSidebar` (+ breakpoint logic), `MobileNavigationBar` threshold 1024→640 |
| Tables | `Components/Page/Transactions/*`, `Payment-link/*`, `Customers/*` shared quiet-table styles |
| Checkout | `Components/UI/CleanCheckoutV2` / `CheckoutShell` |
| Landing | `Components/Page/Home/v3/*` |

**Proposed build phases** (each independently testable, frontend-only, safe against the live DB):
1. **P1 — Foundation** (tokens, typography, light-first default, StatusDot, buttons/inputs/cards): the
   whole app instantly calms down. *~1 session, testing agent full regression.*
2. **P2 — Chrome** (header slim-down, sidebar quiet + tablet rail, mobile threshold): the responsive claim.
3. **P3 — Tables** (Transactions, Pay-links, Customers, Invoices + drawer pattern).
4. **P4 — Dashboard** re-layout.
5. **P5 — Checkout + public pages** (buyer surfaces — most careful testing).
6. **P6 — Marketing** (landing/fees/about reskin + real-product hero shot).

Risks to accept up front: light-first flips the default for existing users (their saved dark preference is
honored); screenshots in docs/marketing will need refreshing after P6; 6 locales mean copy changes stay
minimal (this is a visual redesign, not a copy rewrite).

---

## 7. Acceptance criteria — how we "claim best usability on all screen sizes"

Measured per page at 1920 / 1440 / 1280 / 1024 / 768 / 390, light + dark:
- [ ] ≤1 brand-accent element per view; zero filled status pills; zero source/coin chip backgrounds.
- [ ] Exactly 3 typefaces served; all money values IBM Plex Mono tabular, right-aligned in tables.
- [ ] No table ever silently hides a column: scroll affordance or documented column-drop order.
- [ ] Tablet 1024 shows the icon rail (no phone bottom bar) and full-width tables.
- [ ] All touch targets ≥44px at ≤1024; mobile sticky bars respect safe-area.
- [ ] Header ≤5 items; sidebar contains navigation only.
- [ ] Text contrast ≥ WCAG AA everywhere incl. merchant-picked accents (auto-guard).
- [ ] Page-enter motion ≤200ms, feedback-only; zero `transition: all`.
- [ ] Marketing hero shows the real product UI; trust stats consistent everywhere ($42M+ / 15+ chains).
- [ ] Lighthouse a11y ≥95 on landing, dashboard, checkout.

---

*Prepared 2026-08 · design system by the design expert (see `/app/design_guidelines.json`) · per-page
directives grounded in the live product. Next step: your review → pick a starting phase (recommended P1).*
