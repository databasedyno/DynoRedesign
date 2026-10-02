# Dynopay In-App Redesign — The Operations Console

A system-wide visual redesign of the signed-in Dynopay app into a calm, premium financial-operations console inspired by Mercury, tuned for reading dense data without fatigue.
It replaces today's flat, utilitarian in-app styling with one disciplined design language applied across every page, rolled out starting with the most-used screens.

## Who it's for
People who log into Dynopay every day to run money: merchants and their team members monitoring payments, reconciling settlements, managing payment links and customers, and running payouts — plus internal admins. These are operators scanning financial data quickly, not first-time visitors, so legibility, consistency and speed matter more than marketing flourish.

## The problem being solved
The public-facing pages (creator profile, shop, checkout) already have a lush, premium editorial design. The signed-in app does not: it uses a flat, hairline-card, spreadsheet-like style that gets noisy when populated with real data — walls of monospace figures, low-contrast secondary text, many competing chips/badges, thin visual hierarchy, and little depth or rhythm. Each page was also styled somewhat independently, so the app lacks a single coherent voice. The result reads as "rough when there's data."

## Core features and experience
One design language, applied everywhere, expressed through a small set of shared building blocks so every page looks and behaves like part of the same product:

- **A single design system** — one set of color, type, spacing, elevation, radius and motion rules. Every screen inherits it, so pages stop drifting apart.
- **Redesigned app chrome** — a quieter, more confident left navigation, a cleaner top bar, a refined brand/company switcher, and one consistent page-header pattern (title, short context line, primary action) used on every page.
- **"Financial-statement" data tables** — the core of the app. Airy rows with comfortable height, numbers treated as first-class UI (tabular, right-aligned, balances styled distinctly from amounts), transactions grouped by date (Today / Yesterday / This week), a pinned header, calm hover, and quiet handling of empty cells. Clicking a row opens a right-side slide-over detail panel instead of a dense modal, so you keep your place in the list.
- **Summary strips** — each data page opens with a small band of key figures (e.g. volume, net, pending) presented as large, confident numbers, so the headline is readable at a glance before the table.
- **Restrained status system** — a low-chroma dot-plus-label style for payment/payout states, replacing the current mix of loud chips, so status is scannable without shouting.
- **Consistent supporting pieces** — one filter/toolbar pattern, graceful empty states, and skeleton loaders while data arrives, so the "with data", "no data" and "loading" states all feel intentional.
- **Dark-first, with a polished light mode** — a deep, warm near-black canvas as the hero, and a refined warm-neutral light theme, both carried by the same tokens.

MVP surfaces (redesigned first, in Phase 1): **Dashboard, Transactions, Payment links, Customers** — the screens operators live in — plus the shared foundation and chrome that every later page reuses.

## User flow
1. A merchant signs in and lands on the **Dashboard**: a calm pulse line, a summary strip of key figures, a "needs attention" area, a trend chart, and a recent-payments list — all in the new voice.
2. They open **Transactions**: a statement-style table grouped by date, with a consistent filter bar; they scan amounts and statuses, then click a row to open a **slide-over detail panel** with the full timeline and actions.
3. They move to **Payment links** and **Customers**: the same header, filter bar, table and detail-panel patterns, so there is nothing new to learn — only the data differs.
4. They switch brand/theme/density from the same chrome everywhere; the whole app responds consistently.

## UI/UX feel
Calm, cinematic, data-first — closer to a financial operations console than a typical dashboard. A deep near-black canvas (not pure black) with off-white ink in dark mode; a warm cream/off-white surface with deep graphite text in light mode. A single reserved accent (Dynopay gold) used sparingly for primary actions and active states; a graphite neutral scale as the backbone; a small semantic palette (green/amber/red/blue) only for meaning like status. A clean grotesk at intermediate weights with generous line-height; figures in tabular numerals so columns align; a mono reserved strictly for IDs, hashes and wallet addresses. Generous whitespace and clear hierarchy. Depth is subtle — hairline separators, soft shadows, 12–16px radii; glass/blur is reserved for overlays and sticky bars, not sprayed across cards. Motion is fast and functional (≈150–200ms): slide-over panels, gentle hovers, skeletons — nothing bouncy. One consistent icon set replaces today's mix of custom SVGs and framework icons.

## Implementation phases

**Phase 1 — MVP (built now): foundation + the most-used pages**
- The shared design system (tokens, type, color, elevation, spacing, motion) and the reusable building blocks (page header, summary tile, data table, status, detail slide-over, filter bar, empty state, skeletons).
- The redesigned app chrome (navigation, top bar, brand/company switcher, page-header pattern).
- Four surfaces fully redesigned on the new system: **Dashboard, Transactions, Payment links, Customers** — in both dark and light themes, desktop and mobile.

**Phase 2 — roll the system across the rest of the merchant app**
- Wallet / Payout addresses, Payouts, Invoices & Tax, Developer keys, Notifications, Referrals, and Settings/Profile — re-skinned onto the Phase-1 system and components.

**Phase 3 — admin suite + advanced console affordances + cohesion polish**
- The admin console pages (Overview, Merchants, Transactions, Escrow, Fee reconciliation, Chain readiness, Platform settings, Support).
- Power-user features that suit a console: a command palette, saved filters/views, bulk row actions, and richer data-visualisation.
- Final polish so the signed-in app and the public pages feel like one family.

## Assumptions
- **Scope answer "g" is read as:** redesign the whole app, but build only the most-used pages now — Dashboard, Transactions, Payment links, Customers — as the MVP, with the shared foundation they all reuse. The rest follow in Phases 2–3.
- **Direction is Mercury-style "data console" (answer b):** restrained, airy, legible; not the public pages' expressive editorial-glass look. The public pages are left unchanged.
- **Accent handling ("best option"):** the app chrome stays neutrally Dynopay-branded with a single reserved accent (gold) for primary actions and active states; a merchant's custom accent colour appears only on the brand/identity element (switcher/avatar), **not** across tables, charts or statuses — so dense data reads consistently regardless of brand. (This differs from the public pages, which are fully merchant-themed.)
- **Typography:** a clean grotesk at intermediate weights across the app (keeping the existing body typeface, used more deliberately), with tabular numerals for all figures and a mono reserved for IDs/hashes/addresses. The expressive display face used on public pages is intentionally kept **out** of the in-app chrome.
- **Theme:** dark-first is the hero; a refined light mode ships alongside it. The existing theme toggle and density preference are preserved.
- **Behaviour is preserved:** this is a presentation-layer redesign. Page logic, data, routes, permissions and existing automation hooks are kept as-is; detail views keep their current actions (re-housed into slide-over panels where that improves scanning). No changes to backends or data.
- **Detail pattern:** list rows open a right-side slide-over panel rather than a centered modal, except where a modal is clearly better (e.g. confirmations).
- **Known data-heavy niceties included in the MVP tables:** date grouping, a summary strip, quiet empty/loading states, and the restrained status style. Command palette, saved views and bulk actions are deferred to Phase 3.
- **No new third-party integrations** are required for the redesign.
