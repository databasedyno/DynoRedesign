# Create Flows Redesign — Execution Tracker (autonomous A→D)

User approved: (1a) fully autonomous, build Waves A→D back-to-back, report at end.
(2a) usage-based ordering stays CLIENT-SIDE (localStorage dyno.createUsage.v1), just refined.

Brand: dark-first, left-aligned, hairline. NO new capabilities — discoverability/clarity/consistency/copy/i18n only.
Frontend currently DEV mode (hot reload) for iteration → REBUILD .next-prod at the very end.
SAFE MODE: read-only prod DB. Backend = ts-node → restart backend after backend edits.
Supported locales: en, es, fr, de, pt, nl (verify). i18n propagation script pattern: scripts/copy/propagate_create_flow_i18n.py.

## Shared "flow" visual language (target for all 4 flows)
- Two-column on desktop: left = sectioned form, right = sticky LIVE PREVIEW of what payer/visitor sees.
- Each section: small eyebrow/title + one-line plain-language "what this is for" helper.
- Consistent section order + vocabulary. Mobile = same content stacked, preview collapsible.
- Honest settlement copy where money is mentioned.

## WAVE A — Phase 1 close-out (verify + polish)
- [ ] Verify Create hub (all 4, usage order, settlement note) — CreateHub.tsx (DONE in code)
- [ ] Verify empty-state → hub via OPEN_CREATE_HUB_EVENT wiring (dashboard + pay-links)
- [ ] Verify fundraiser flow + live preview + donor wall + suggested amounts
- [ ] Confirm settlement/auto-convert copy app-wide + landing hero/FAQ

## WAVE B — Phase 2 Product flow  (Components/Page/ProductEditor/index.tsx 1552 lines; page pages/pay-links/products/new.tsx)
- [ ] Restructure editor into labelled sections w/ plain-language intros: Basics → Media → Price & delivery → Tax
- [ ] Add ProductLivePreview (right column, sticky) — buyer product card from live state
- [ ] Post-creation clarity: where it lives + edit/share/track
- [ ] i18n keys (productEditor.* + section copy)

## WAVE C — Phase 2 Creator page  (Storefront/PageTab.tsx, Creator/CreatorPageSettings.tsx)
- [ ] Rework setup/edit for clarity + section intros + live preview
- [ ] Claimable/discoverable for every merchant (verify claim handle path)
- [ ] Post-creation clarity

## WAVE D — Phase 3
- [ ] Cross-flow consistency (shared primitives: FlowShell, SectionIntro, PreviewPanel wrapper)
- [ ] In-context tips/education
- [ ] Refined client-side usage ordering + recommendations in hub
- [ ] Mobile/responsive pass
- [ ] Full i18n propagation of ALL new copy to en/es/fr/de/pt/nl

## GATES each wave: tsc --noEmit=0, eslint changed files=0, strip_unused_imports --check pass.
## FINAL: rebuild .next-prod, set FRONTEND_MODE back? (leave dev; deploy uses Dockerfile) — then testing agent.

## STATUS LOG
- (start) CI fix done: removed unused useCallback import in CreateNewButton.tsx (needs Save to GitHub).
- WAVE A: Phase 1 verified in code (hub/fundraiser/empty-state/settlement all present). Nothing to rebuild.
- WAVE B (Product): DONE — split catch-all card into Product basics / Images / Price & stock; added plain-language subTitles to Delivery/Tax/Variants; added post-creation "Your product is live" panel (See all / Share & QR / Track sales → real routes). Icons IosShareRounded+InsightsRounded imported.
- WAVE C (Creator page): already complete in code (HandleClaimNudge=claimable, PageFunnelHeader=post-creation clarity, sticky live preview, plain-language card). No change needed.
- WAVE D (Phase 3): hub "Most used" badge on top-used type (CreateHub.tsx); i18n propagated all new keys to en/es/fr/de/pt/nl via scripts/copy/propagate_phase23_i18n.py (90 writes, valid).
- NEXT: tsc gate -> rebuild .next-prod -> screenshots desktop+mobile -> frontend testing agent.

## FINAL STATUS (all done)
- tsc --noEmit = 0 errors (twice). eslint changed files clean (only pre-existing warnings).
- Product flow verified via screenshots: sections "Product basics / Images / Price & stock / Digital delivery / Tax & VAT" with plain-language helper text + sticky live buyer preview (desktop) + collapsible "Preview" (mobile). No horizontal overflow at 1920 or 390.
- BUG FIX (Brand details Save greyed) VERIFIED by testing_agent 5/5 desktop+mobile, 0 console errors.
- Frontend left in DEV mode (hot reload) for this pod; deploy uses Dockerfile (prod) independently. .env.local is gitignored so FRONTEND_MODE change won't be committed.
- CI/build fix (unused useCallback import) pending user "Save to GitHub" to push.
