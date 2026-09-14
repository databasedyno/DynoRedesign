# DynoPay Incident Response Playbook

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0 - Critical** | Service completely down | < 15 min | Server crash, DB down, payment processing halted |
| **P1 - High** | Major feature degraded | < 30 min | Webhook failures, Binance API down, high error rate |
| **P2 - Medium** | Minor feature broken | < 2 hours | Email delivery issues, slow responses, single user issues |
| **P3 - Low** | Cosmetic/non-urgent | < 24 hours | Logging issues, documentation, minor UI bugs |

---

## Runbook: Server Down (P0)

### Symptoms
- Health endpoint (`/health`) returns non-200
- Supervisor shows backend STOPPED
- Users report 503 errors

### Steps
1. **Check supervisor status**: `sudo supervisorctl status`
2. **Check logs**: `tail -100 /var/log/supervisor/backend.err.log`
3. **Restart service**: `sudo supervisorctl restart backend`
4. **Verify health**: `curl http://localhost:8001/health`
5. **If still down**: Check Node.js process: `ps aux | grep node`
6. **Check memory**: `free -m` — OOM killer may have stopped process
7. **Check disk**: `df -h` — logs may have filled disk
8. **Escalate**: If repeated crashes, check for infinite loops or memory leaks in recent changes

---

## Runbook: Database Connection Failure (P0)

### Symptoms
- Health returns `"database": "disconnected"`
- Errors: "Connection terminated unexpectedly", "ECONNREFUSED"

### Steps
1. **Test connection**: Use DB_URL from .env to connect via `psql`
2. **Check pool stats**: Look for "pool" in backend logs
3. **Verify Railway/host**: Check if remote DB host is reachable: `pg_isready -h <host> -p <port>`
4. **Restart backend**: Forces new connection pool creation
5. **Check SSL**: Ensure `ssl: true` in dbInstance.ts for remote DBs
6. **Check keepAlive**: Verify `keepAlive: true` in pool config
7. **If persistent**: May need SSH tunnel for Railway: `scripts/ssh-tunnel-keepalive.sh`

---

## Runbook: Redis Down (P0)

### Symptoms
- Rate limiting fails, sessions don't work
- Error logs: "Redis connection lost"

### Steps
1. **Check Redis**: `redis-cli ping` — should return PONG
2. **Check memory**: `redis-cli info memory`
3. **Restart Redis**: `sudo supervisorctl restart redis` or `systemctl restart redis`
4. **Check config**: Verify REDIS_URL in .env
5. **Flush if corrupted**: `redis-cli FLUSHDB` (CAUTION: clears all cached data)

---

## Runbook: High Error Rate (P1)

### Symptoms
- Error digest emails > 25 errors in 15 minutes
- Slack/Discord critical alerts

### Steps
1. **Check error digest**: `GET /diagnostics/error-stats` (admin auth)
2. **Identify pattern**: Group errors by component and message
3. **Check recent deploys**: Any code changes in last 24h?
4. **Check external services**: Tatum API, Binance, Brevo — all up?
5. **Check rate limits**: Are we hitting third-party API limits?
6. **Mitigate**: If specific endpoint, temporarily add stricter rate limit

---

## Runbook: Payment Processing Failure (P0)

### Symptoms
- Payments stuck in "pending" or "processing"
- Webhook queue backing up

### Steps
1. **Check webhook queue**: `GET /diagnostics/webhook-queue-health`
2. **Check DLQ**: `GET /diagnostics/dlq-items` — are webhooks failing?
3. **Check Tatum API**: `GET /diagnostics/tatum-health`
4. **Run reconciliation**: `POST /diagnostics/trigger-sweep`
5. **Check Redis keys**: Look for stuck `payment:*` keys
6. **Manual retry**: `POST /diagnostics/retry-dlq-item` for specific items

---

## Runbook: Binance API Unreachable (P1)

### Symptoms
- Health shows `binance_websocket.geo_blocked: true`
- Auto-conversion failing

### Steps
1. **Check proxy**: `GET /diagnostics/binance-proxy`
2. **Test connectivity**: `GET /diagnostics/binance-ping`
3. **Force proxy**: `POST /diagnostics/binance-proxy` with `{"force": "proxy"}`
4. **If geo-blocked**: Deploy to non-US region, or ensure SOCKS proxy is configured
5. **Check SSH tunnel**: `GET /diagnostics/tunnel-status`

---

## Runbook: Email Delivery Failure (P2)

### Symptoms
- Users not receiving emails
- Error logs show Brevo API errors

### Steps
1. **Check Brevo key**: Verify BREVO_API_KEY in .env
2. **Test email**: `GET /diagnostics/email-preview` — renders without sending
3. **Check quota**: Login to Brevo dashboard, check daily sending limit
4. **Check bounce list**: High bounce rate may have blocked sending
5. **Verify sender**: Ensure FROM_EMAIL is verified in Brevo

---

## Runbook: Security Breach (P0)

### Symptoms
- Unusual login patterns, multiple failed attempts
- Unauthorized data access

### Steps
1. **IMMEDIATE**: Revoke all active sessions: Update tbl_user_session set is_active=false
2. **IMMEDIATE**: Rotate all API keys (ACCESS_TOKEN_SECRET, TATUM keys, Binance keys)
3. **Investigate**: Check `/var/log/supervisor/backend.out.log` for suspicious requests
4. **Check security logs**: `cat /app/backend/logs/security.log | grep suspicious`
5. **Check login history**: Query tbl_login_history for anomalies
6. **Notify users**: Send security alert emails if data was compromised
7. **Post-mortem**: Document timeline, root cause, and remediation

---

## Monitoring Checklist (Daily)

- [ ] Health endpoint returning 200
- [ ] Error digest email count < 10 in last 24h
- [ ] Webhook queue DLQ is empty
- [ ] Database connection pool healthy (no pool exhaustion)
- [ ] Redis memory usage < 80%
- [ ] Disk usage < 85%
- [ ] No stuck payments older than 1 hour

---

## Contact Escalation

| Role | Contact | When |
|------|---------|------|
| On-call Engineer | Slack #dynopay-alerts | All P0/P1 |
| Admin | moxxcompany@gmail.com | P0 if unresolved > 30min |
| Tatum Support | Tatum dashboard | API outages |
| Railway Support | Railway dashboard | Infrastructure issues |
