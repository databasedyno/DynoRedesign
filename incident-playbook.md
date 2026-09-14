# DynoPay Incident Playbook

Operational runbook for handling production incidents. All team members with on-call responsibility should be familiar with this document.

---

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **SEV-1** | Complete service outage, all payments failing | < 15 min | Database down, server crash, DNS failure |
| **SEV-2** | Partial outage, some payments failing | < 30 min | Blockchain node unresponsive, webhook delivery failing, high error rate |
| **SEV-3** | Degraded performance, no payment loss | < 2 hours | Slow API responses, stale exchange rates, monitoring gaps |
| **SEV-4** | Minor issue, no user impact | Next business day | Log noise, non-critical cron failure, cosmetic bugs |

---

## Incident Response Steps

### 1. Detect
- **Automated**: Slack/Discord alerts from `slackAlertService` (payment failures, high error rates, service down)
- **Monitoring**: Check `/api/status` for service health and `/diagnostics/error-monitor` for error trends
- **Manual**: User reports, support tickets

### 2. Triage
1. Check **service health**: `GET /api/status` and `GET /health`
2. Check **error monitor**: `GET /diagnostics/error-monitor` for recent error patterns
3. Check **logs**: `tail -f /var/log/supervisor/backend.err.log`
4. Assign severity level (see table above)
5. Notify team in Slack/Discord channel

### 3. Mitigate
Apply the appropriate runbook below based on the failure type.

### 4. Resolve & Post-Mortem
- Document root cause
- Deploy fix
- Write post-mortem (template below)

---

## Runbooks

### A. Database (PostgreSQL) Down

**Symptoms**: 500 errors on all endpoints, `GET /api/status` returns database unhealthy

**Steps**:
1. Verify DB connectivity:
   ```bash
   psql -h $HOST -p $DB_PORT -U $USER_NAME -d $DB_NAME -c "SELECT 1;"
   ```
2. Check Railway dashboard for DB instance status
3. Check connection pool exhaustion in logs (`pool` errors)
4. If pool exhaustion: restart backend service (`sudo supervisorctl restart backend`)
5. If DB host unreachable: check Railway status page, contact Railway support
6. Verify recovery: `curl /api/status` → `database: "connected"`

**Escalation**: If not resolved in 15 min, contact Railway support + notify all stakeholders

---

### B. Redis Down / Unavailable

**Symptoms**: Rate limiting disabled, account lockout not working, exchange rate cache stale

**Steps**:
1. Check Redis connectivity in status: `GET /api/status` → look at `redis` field
2. Verify Redis is running: check Railway dashboard / hosting provider
3. Application falls back gracefully (rate limiting skips, lockout skips) — no hard outage
4. Restart backend if Redis reconnection stalls: `sudo supervisorctl restart backend`

**Impact**: Degraded (SEV-3) — rate limiting and caching disabled but payments still work

---

### C. Payment Processing Failures

**Symptoms**: Slack alert "Payment Failure", transactions stuck in `pending`

**Steps**:
1. Check which blockchain is affected:
   ```
   GET /diagnostics/fee-optimization → check per-network status
   ```
2. Check Tatum API status: https://status.tatum.io
3. Check if webhook delivery is backed up:
   ```
   GET /diagnostics/webhook-queue
   ```
4. For stuck transactions, check the payment state machine:
   - Verify the transaction in admin panel
   - Check if blockchain confirmation was received
5. If Tatum API is down: payments will queue — they auto-retry when service recovers
6. If webhook delivery is backed up: check DLQ (`/diagnostics/webhook-queue` → dlq count)

**Escalation**: If Tatum API down > 1 hour, enable maintenance mode and notify merchants

---

### D. High Error Rate

**Symptoms**: Slack alert "High Error Rate", error monitor showing spike

**Steps**:
1. Check error digest:
   ```
   GET /diagnostics/error-monitor
   ```
2. Identify the most common error type and affected endpoint
3. Check if a recent deployment caused it (review git log)
4. Common causes:
   - **Rate limit errors (429)**: Check if a single IP is hammering — could be abuse
   - **Auth errors (401)**: Check if JWT secret was rotated without restart
   - **Validation errors (400)**: Check if API consumers changed request format
   - **Server errors (500)**: Check stack traces in error monitor

---

### E. Webhook Delivery Failing

**Symptoms**: Merchants not receiving payment notifications, webhook queue growing

**Steps**:
1. Check webhook queue status:
   ```
   GET /diagnostics/webhook-queue
   ```
2. Check DLQ (Dead Letter Queue) for permanently failed webhooks
3. Verify merchant webhook URLs are reachable:
   ```bash
   curl -X POST <merchant_webhook_url> -d '{"test":true}'
   ```
4. If specific merchant's URL is down: notify merchant, webhooks will retry automatically
5. If all webhooks failing: check outbound network connectivity from the server
6. Replay failed webhooks from DLQ after fixing the root cause

---

### F. Exchange Rate / Volatility Issues

**Symptoms**: Stale prices, volatility alerts, payment amounts incorrect

**Steps**:
1. Check rate freshness:
   ```
   GET /diagnostics/fee-optimization → check rate timestamps
   ```
2. Check volatility status:
   ```
   GET /diagnostics/volatility
   ```
3. If rates are stale: check Tatum API connectivity (rate source)
4. If high volatility detected: system automatically applies wider spreads — verify this is working
5. Manual rate refresh: restart the backend cron service (`sudo supervisorctl restart backend`)

---

### G. Account Lockout Issues (Users Locked Out)

**Symptoms**: Users reporting "account locked" errors, unable to log in

**Steps**:
1. Verify the user is actually locked (not banned/suspended):
   - Lockout: temporary, Redis-based, auto-expires after 30 min
   - Banned: permanent, admin action
2. Admin can unlock via API:
   ```bash
   curl -X POST /api/admin/users/unlock \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com"}'
   ```
3. If mass lockouts occurring: possible brute-force attack — check rate limiter logs

---

### H. 2FA Issues

**Symptoms**: Users unable to complete 2FA, TOTP codes rejected

**Steps**:
1. Verify server time is accurate (TOTP is time-sensitive, allows 1 window tolerance)
2. Check if the user's 2FA record exists:
   ```
   GET /api/user/2fa/status (with user's token)
   ```
3. If user lost authenticator app: they can use backup codes
4. If user lost backup codes: admin must disable 2FA for the user in the database
5. Time sync issues: TOTP allows ±30 second tolerance — if beyond that, check NTP

---

## Alert Configuration

The alerting service (`services/slackAlertService.ts`) sends alerts to Slack and Discord.

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | No (alerts skip if not set) |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | No (alerts skip if not set) |
| `ALERT_CHANNEL` | Slack channel override | No (defaults to `#dynopay-alerts`) |

### Verify Alert Configuration
```
GET /api/admin/alerts/health
→ { configured: { slack: true, discord: false }, ... }
```

### Test Alerts
```
POST /api/admin/alerts/test
→ Sends a test alert to all configured channels
```

### Alert Types
| Alert | Trigger | Severity |
|-------|---------|----------|
| Payment Failure | Any payment processing error | Critical |
| Service Down | Backend service unresponsive | Critical |
| High Error Rate | Error threshold exceeded | Warning |
| Security Event | Suspicious activity detected | Critical |
| Volatility Alert | Crypto price swing > threshold | Warning |

---

## Useful Diagnostic Endpoints

All require admin authentication unless noted.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Basic health check (public) |
| `GET /api/status` | Service health dashboard (public) |
| `GET /diagnostics/error-monitor` | Error trends and recent errors |
| `GET /diagnostics/webhook-queue` | Webhook delivery queue status |
| `GET /diagnostics/fee-optimization` | Fee and rate status per network |
| `GET /diagnostics/volatility` | Crypto volatility monitoring |
| `GET /api/events/stats` | SSE connection stats |
| `GET /api/admin/alerts/health` | Alert service configuration status |

---

## Post-Mortem Template

```markdown
## Incident Post-Mortem: [Title]

**Date**: YYYY-MM-DD
**Duration**: X hours Y minutes
**Severity**: SEV-X
**Author**: [Name]

### Summary
[1-2 sentence summary of what happened]

### Timeline (UTC)
- HH:MM — [Event/action]
- HH:MM — [Event/action]

### Root Cause
[What caused the incident]

### Impact
- Users affected: X
- Payments affected: X
- Revenue impact: $X

### Resolution
[How was it fixed]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]

### Lessons Learned
- [What we learned]
```
