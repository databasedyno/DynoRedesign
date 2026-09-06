# Onboarding investigation — 2026-09-06

Sources: DigitalOcean App Platform runtime logs (app `dynopay`, component `dynoredesign`, AMS) and
**read-only** SQL against the production Postgres (via `backend/scripts/ro_query.js`). No data was modified.

## 0. What the DigitalOcean logs can (and cannot) tell us
- App Platform keeps runtime logs **only for the active deployment**; every redeploy wipes the previous pod's
  logs (`historic_urls` empty for all 13 superseded deployments). This app is redeployed roughly **hourly**, so
  DO logs cover ~35 minutes at any time. Historical onboarding questions must be answered from the DB.
- What the live log (14:23–14:29Z) did show:
  1. **Merchant webhook failing with HTTP 308** — company 139 "Donut Loot" (legacy-API integrator, signed up
     Sep 5). Their webhook URL `https://donutloot.xyz/…` redirects to `https://www.donutloot.xyz/…`; our sender
     deliberately uses `maxRedirects: 0` (SSRF guard) → **158 failed deliveries**, every payment.created event.
     This is the ONE real developer integration in the cohort and they never receive a webhook.
  2. A logged-out merchant (company 125) browsing `/for/*` marketing pages produces a 401 loop on
     `/api/wallet/getWallet` (stale token in localStorage). Cosmetic, but noisy.
  3. `last_login_ip` stores the raw `X-Forwarded-For` chain ("client, cloudflare, 100.127.x.x") instead of the
     client hop → geo/analytics on that column is broken unless you split on the first comma.

## 1. Who signed up, and where they came from
Totals: 125 users · 99 companies · 66 with a wallet · 42 with a payment link · **only 1 company (the owner's own
account) has ever completed a transaction; the last completed payment in the whole DB is 2026-07-10.**

| cohort | users | notes |
|---|---|---|
| Apr–Jul ("previous onboardings") | 13 | owner account (user 1: 724 tx rows incl. the 3 completed), 10 QA/test accounts (`@dynopaytest.com`, `@dynopay-test.com`, `@dyno.pt`), 1 real user (Jul 6, 0 logins). **Effectively zero external users before August.** |
| August | 71 | no attribution rows (attribution table only exists since Sep 1). Geo via login IP (first XFF hop): US 8, DE 6, IR 4, DZ 3, PK 3, TR 2, IN 2, PS 4, KH 2, SO 2, PL 2, ET 2 … 12 on hosting/VPN IPs (US/DE largely VPN exits). 19 never logged in. |
| September (1–6) | 41 | 39 attribution rows. **Source: ChatGPT 19 (49%), Google 8, direct 5, other 6, Bing 1.** Landing: `/for/fundraisers` 15, `/` 10. Country: Iran 8, then Somalia, Ethiopia, Suriname, Pakistan, Lebanon, Azerbaijan, Uzbekistan, Mozambique, Bangladesh, Tanzania, Palestine, India… |

**Who they are:** individuals, not businesses. Company names are personal names; 68 of 95 links are
`donation`/`contribution` ("Help Me Get Back on My Feet", "A Home for My Mother", "Help Me Rebuild My Life After
COVID", "Help My Baby Boy…", "Buy me a coffee", "Send a tip"). Wallets: USDT-TRC20 31, BTC 28, ETH 10 — the
remittance/sanctioned-region stack. ChatGPT is recommending DynoPay to people in countries where GoFundMe /
PayPal / Stripe don't operate, who are looking for a way to *receive* donations.

## 2. Funnel (Aug + Sep = 112 users)
```
signup 112 → company 92 (82%) → wallet 61 (54%) → payment link 39 (35%) → checkout opened 15 (13%) → PAID 0
```
Onboarding checklist telemetry agrees: `checklist_shown` 68 users → `step_clicked company` 21 → `wallet` 13 →
`link` 6; `dismissed wallet` 6.
Engagement: Aug 19 never logged in, 40 only on signup day, 12 came back (2 ≥3×). Sep 8 never, 31 signup-day
only, 2 came back. **~70% touch the product exactly once.**

## 3. Why zero transactions — evidence, not guesswork
1. **Nobody has ever sent funds to a recent merchant.** 155 checkout attempts across 15 companies, all
   `pending`; 0 Tatum inbound events, 0 payment-journal rows, 0 addresses with a txid, 0 partial payments,
   `times_used` = 0 on every link. This is **not a detection/settlement bug** — there was nothing to detect.
2. **The 155 attempts are the merchants themselves exploring**, not customers: anonymous payer on every one,
   bursts within minutes of signup (company 39: 9 attempts across 4 coins in 4 min; company 36: 9 in 90 min on
   signup day), test-looking amounts (10,500 USDT ×12; $1; 0.0004 ETH), one Iran-based user with 47 attempts
   across 11 links over 8 days, and "Donut Loot" firing the legacy API every few seconds.
3. **They have no donors.** A fundraiser link only converts if the organiser brings an audience; these are
   hardship fundraisers from ChatGPT with no social reach yet, and the product gives them nothing to drive traffic
   with (no share kit, no campaign page SEO, no reminders to the organiser to share).
4. **Setup friction compounds it.** 46% drop between company and wallet (adding an external wallet address is
   the scariest step for a first-timer; 6 users explicitly dismissed the wallet step), then 36% between wallet
   and first link.
5. **Regional/compliance reality.** Iran, Somalia, Lebanon, Palestine, Syria-adjacent traffic + VPN exits: even
   motivated organisers may be unable to attract donors who can pay in crypto, and some may hit KYC/sanctions
   walls later. (No KYC rows exist for any recent user — KYC only triggers at $10k, so it is NOT the blocker today.)
6. **The one real merchant is broken by a redirect.** Donut Loot's webhook 308 → every event fails silently on
   their side (we log it; they see nothing).

## 4. Recommended actions (ranked by expected impact)
1. Fix webhook-redirect handling: validate the URL on save (probe once, warn "your URL redirects to www.… — use
   the final URL"), surface delivery failures in the dashboard, and optionally follow ONE https→https redirect
   after re-running the SSRF check. Then email Donut Loot.
2. Turn `/for/fundraisers` traffic into launched campaigns: post-link "Share kit" (WhatsApp/Telegram/X copy,
   QR poster), organiser nudge emails at day 1/3/7 ("your page has 0 visits — here's how to share it"), public
   campaign pages with OG previews (already exist) + sitemap.
3. De-risk the wallet step: explain "this is where donations land, you control it", accept a first link BEFORE a
   wallet (hold-until-wallet) or offer a guided "create a wallet" path; 6 users dismissed exactly this step.
4. Decide the ICP explicitly: the growth is organic-AI-driven individuals in hard-to-serve regions. Either lean
   in (donation-first onboarding, Farsi/Arabic/Somali UI, TRC-20 first) or qualify at signup (business vs
   personal) and route personal fundraisers to a lighter flow.
5. Data hygiene so the next investigation is trivial: store first-hop IP + country at signup, keep attribution
   for every user, and ship logs off DigitalOcean (Logtail/Papertrail/OpenSearch) — App Platform loses them on
   every redeploy.
