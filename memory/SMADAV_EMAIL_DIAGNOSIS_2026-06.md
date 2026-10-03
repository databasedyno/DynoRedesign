# SMADAV "payment emails not arriving" — DIAGNOSED (2026-06 fork)

## User report
Payment emails arrive for **The Dev Store** but not **SMADAV**, while admin fee/payment
notifications work for both. User explicitly corrected an earlier wrong assumption:
**the owner address onarrival21@gmail.com was NOT bouncing.**

## Method (real test send, no global outbound flip)
mailTransporter has an `EMAIL_TEST_ALLOWLIST` bypass, but `sendViaBrevo()` can be called
directly (pure Brevo API call) — used by `backend/scripts/smadav_email_test.ts`.
Also queried Brevo event log: `GET /v3/smtp/statistics/events?email=<addr>`.

## FACTS (Brevo event log + live DNS, 2026-10-03)
1. **onarrival21@gmail.com** (Dev Store owner, user_id 1): test → `delivered` + `opened`.
   NEVER bounced. (User's correction confirmed — owner address is healthy.)
2. **smadav@dyno.pt** (SMADAV company_id 71 `email`): test → `delivered`. Valid mailbox.
   BUT the two real SMADAV emails on 2026-10-02 ("Payment settled · 29.97 USD · SMADAV",
   "…confirming") → **softBounces**, reason:
   `550 5.7.2 77.32.148.26: Sender IP rejected: spam rate exceeded`.
3. ROOT CAUSE = **Brevo shared sending IP (77.32.148.26) reputation / rate throttling** at
   the recipient server. smadav@dyno.pt is a **Titan/Hostinger** mailbox (strict spam-rate
   limits on shared IPs); Gmail (Dev Store owner) tolerates the same IP → Dev Store always
   lands, SMADAV intermittently rejected. Admin emails go to a different inbox → unaffected.
   NOT a bad address, NOT the owner address, NOT a domain-auth problem.

## dynopay.com email authentication — ALREADY HEALTHY (nothing to fix)
Brevo `GET /v3/senders/domains/dynopay.com` → `authenticated=true, verified=true`, all
records `status:true`:
- SPF  `@`  = `v=spf1 include:spf.brevo.com ~all`
- brevo-code `@` = `brevo-code:4831905d430c357fb51d82f6ddb0d1d3`
- DKIM1 CNAME `brevo1._domainkey` → `b1.dynopay-com.dkim.brevo.com`
- DKIM2 CNAME `brevo2._domainkey` → `b2.dynopay-com.dkim.brevo.com`
- DMARC `_dmarc` = `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- (legacy `mail._domainkey` 1024-bit TXT still present — harmless, unused selector)
⇒ The user's chosen fix "verify/align SPF/DKIM/DMARC" turned out to be a NO-OP: already done.

## Durable fix options (domain auth can't fix a shared-IP rate rejection)
- **Brevo DEDICATED IP** (paid add-on) = strongest fix; removes shared-IP reputation dependency. ← the real lever
- Tighten DMARC `p=none` → `p=quarantine` over time (reputation; Gmail/Yahoo bulk-sender ask). Not the cause.
- Brevo auto-retries soft bounces; our worker also retries ~7× over ~45 min.
- The bounce-aware fallback code (kept, see below) copies the OWNER (onarrival21@gmail.com,
  Gmail, never throttled) when the company address is flagged unreachable — practical safety
  net for exactly this SMADAV/Titan throttle window. NOT yet deployed to prod.

## Live-data action taken (user-authorized this fork)
- SMADAV company_id 71 `notification_email` was (in a PRIOR fork, on a wrong premise) set to
  onarrival21@gmail.com. **Reverted to NULL** this fork → SMADAV mail routes to smadav@dyno.pt
  (company.email) again, the merchant's intended setup. company.email unchanged.

## Decisions (user, this fork)
1. SMADAV address → revert to blank (DONE).
2. Deliverability fix → "verify SPF/DKIM/DMARC" → investigated: already healthy. Re-surfaced
   dedicated-IP as the actual lever (awaiting user).
3. Bounce-aware fallback code + Brevo webhook + dashboard/notification warnings → KEEP (undeployed).

## Handy
- Test send: `cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/smadav_email_test.ts [addr...]`
  (sends REAL mail via Brevo to the given addresses — defaults to the two above).
- Brevo events: `curl -sG https://api.brevo.com/v3/smtp/statistics/events --data-urlencode email=<addr> -H "api-key:$BREVO_API_KEY"`
