# Railway Deployment Troubleshooting Guide
**Fixing "Service Unavailable" Health Check Failures**

---

## 🔍 Problem: Health Check Failing

**Symptom:**
```
Attempt #1 failed with service unavailable. Continuing to retry...
```

**Root Causes (in order of likelihood):**
1. Backend taking too long to initialize (database/Redis connections)
2. Missing environment variables
3. Port configuration mismatch
4. Database connection timeout
5. Build/start command issues

---

## ✅ Solution: Quick Fixes

### Fix 1: Increase Health Check Timeout (RECOMMENDED)

Railway's default health check is too aggressive for DynoPay's startup time (needs ~30-60 seconds).

**Railway Dashboard → Settings → Healthcheck:**

```yaml
# Change from:
Path: /health
Timeout: 5 minutes

# To:
Path: /health
Timeout: 10 minutes
Initial Delay: 60 seconds  # Give app time to start
Interval: 30 seconds        # Check less frequently
```

**Or disable health check temporarily:**
```yaml
# Railway Dashboard → Settings → Healthcheck
# Toggle OFF to skip health checks during initial deployment
```

---

### Fix 2: Check Environment Variables

**Required Variables (Railway Dashboard → Variables):**

```bash
# CRITICAL - App won't start without these:
DB_NAME=your_database_name
USER_NAME=your_database_user
PASSWORD=your_database_password
HOST=your_database_host
DB_PORT=5432

# Redis
REDIS_PUBLIC_URL=redis://...

# Secrets
ACCESS_TOKEN_SECRET=your_secret_here
API_SECRET=your_api_secret

# URLs (Railway will auto-fill these)
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# Port (Railway auto-provides)
PORT=${{PORT}}

# Binance
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
```

---

### Fix 3: Check Build/Start Commands

**Railway Dashboard → Settings → Build:**

```bash
# Build Command (should be):
yarn install && cd backend && yarn install && cd .. && cd frontend && yarn install

# Start Command (should be):
cd backend && python3 server.py

# Or if using Node directly:
cd backend && node dist/server.js
```

---

### Fix 4: Railway Logs Analysis

**Check logs to see actual error:**

**Railway Dashboard → Deployments → Click failed deployment → Logs**

Look for these common errors:

#### Error Pattern 1: Database Connection
```
Error: connect ETIMEDOUT
Error: Connection refused
```
**Fix:** Whitelist Railway IP in database firewall, or use Railway's internal database

#### Error Pattern 2: Missing Env Vars
```
Error: Missing required environment variable: DB_NAME
```
**Fix:** Add missing variables in Railway dashboard

#### Error Pattern 3: Port Binding
```
Error: listen EADDRINUSE: address already in use
```
**Fix:** Remove hardcoded ports, use `process.env.PORT`

#### Error Pattern 4: Build Failure
```
npm ERR! missing script: build
```
**Fix:** Add build scripts to package.json

---

## 🚀 Recommended Railway Configuration

### Step-by-Step Setup:

**1. Database Setup (If Using Railway PostgreSQL)**

```bash
# In Railway Dashboard:
1. Click "New" → "Database" → "PostgreSQL"
2. Railway auto-creates database
3. Use these variables in your app:
   - PGHOST → DB_HOST
   - PGPORT → DB_PORT
   - PGUSER → USER_NAME
   - PGPASSWORD → PASSWORD
   - PGDATABASE → DB_NAME
```

**2. Redis Setup (If Using Railway Redis)**

```bash
# In Railway Dashboard:
1. Click "New" → "Database" → "Redis"
2. Railway auto-creates Redis
3. Use REDIS_URL → REDIS_PUBLIC_URL
```

**3. Environment Variables Template**

Copy this to Railway Variables:

```bash
# Database (from Railway PostgreSQL)
DB_NAME=${{PGDATABASE}}
USER_NAME=${{PGUSER}}
PASSWORD=${{PGPASSWORD}}
HOST=${{PGHOST}}
DB_PORT=${{PGPORT}}

# Redis (from Railway Redis)
REDIS_PUBLIC_URL=${{REDIS_URL}}

# App URLs (Railway auto-fills)
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
CHECKOUT_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/checkout

# Secrets (generate strong values)
ACCESS_TOKEN_SECRET=<generate-64-char-random-string>
API_SECRET=<generate-64-char-random-string>

# Binance
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET

# Optional
NODE_ENV=production
DEBUG_MODE=false
```

---

## 🔧 Advanced Fixes

### Fix 5: Custom Health Check Endpoint

If `/health` is slow, create a faster endpoint:

**Add to `/app/backend/server.ts`:**

```typescript
// Quick health check (no DB queries)
app.get("/ping", (_req: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});
```

**Railway Settings → Healthcheck:**
```yaml
Path: /ping  # Instead of /health
```

---

### Fix 6: Optimize Startup Time

**Problem:** DynoPay initializes ~20 database tables + Redis + migrations on startup

**Solutions:**

**A. Disable non-critical startup tasks:**

```typescript
// In server.ts, comment out during initial deployment:
// await migrateWebhookUrls();  // Skip on first deploy
// setupWeeklySummaryCron();     // Skip on first deploy
```

**B. Move migrations to separate process:**

```bash
# Run migrations before starting server
railway run npm run migrate
railway up
```

---

### Fix 7: Railway Region Check

**Verify you're in non-US region:**

```bash
Railway Dashboard → Settings → Region

Should show:
✅ Europe West (eu-west-1)
✅ Asia Pacific (ap-southeast-1)

NOT:
❌ US East (us-east-1)
```

---

## 📊 Deployment Checklist

**Before Deploying:**
- [ ] Region set to Europe/Asia
- [ ] All environment variables added
- [ ] Database accessible from Railway
- [ ] Redis accessible from Railway
- [ ] Health check timeout increased to 10 min
- [ ] Build/start commands correct

**After First Deploy Fails:**
- [ ] Check Railway logs for actual error
- [ ] Fix missing env vars
- [ ] Whitelist Railway IP in database
- [ ] Increase health check timeout
- [ ] Redeploy

**Testing Deployment:**
- [ ] Railway URL accessible: `https://your-app.up.railway.app`
- [ ] Health endpoint responds: `curl https://your-app.up.railway.app/health`
- [ ] API responds: `curl https://your-app.up.railway.app/api`

---

## 🆘 Common Error Solutions

### Error: "Backend starting, please retry"

**Cause:** Backend still initializing  
**Fix:** Wait 30-60 seconds, health check will pass

### Error: "connect ETIMEDOUT"

**Cause:** Database unreachable  
**Fix:** 
1. Check DB_HOST is correct
2. Whitelist Railway IP in database firewall
3. Use Railway's internal database

### Error: "Missing required environment variable"

**Cause:** Env var not set  
**Fix:** Add to Railway Variables, redeploy

### Error: "Port already in use"

**Cause:** Hardcoded port in code  
**Fix:** Use `process.env.PORT` everywhere

### Error: "Cannot find module"

**Cause:** Dependencies not installed  
**Fix:** Check build command includes `yarn install`

---

## 🎯 Quick Fix: Skip Health Check

**If you need to deploy NOW and debug later:**

```bash
Railway Dashboard → Settings → Healthcheck
Toggle: OFF

# Deploy will succeed even if /health fails
# You can debug once deployed
```

**Then access directly:**
```bash
curl https://your-app.up.railway.app/health
# See actual error message
```

---

## 💡 Best Practice Deployment

**Recommended approach:**

```bash
# Step 1: Deploy with health check OFF
Railway Dashboard → Healthcheck → OFF
Deploy

# Step 2: Check logs once deployed
Railway → Logs → See actual startup time

# Step 3: Enable health check with proper timeout
Healthcheck → ON
Path: /health
Initial Delay: 90 seconds  # Based on logs
Timeout: 10 minutes

# Step 4: Redeploy
```

---

## 📞 Share Logs With Me

**To help debug, share:**

1. **Railway Deployment Logs:**
   - Railway → Deployments → Failed deployment → Logs
   - Copy last 100 lines

2. **Railway Variables:**
   - List of variables set (don't share actual values)
   - Just names: DB_NAME, PASSWORD, etc.

3. **Railway Settings:**
   - Region: ?
   - Build command: ?
   - Start command: ?
   - Health check path: ?

**I can diagnose the exact issue with these details!**

---

## ✅ Success Indicators

**Deployment successful when:**

```bash
# 1. Railway shows "Active"
Railway Dashboard → Deployment Status: Active ✅

# 2. Health check passes
curl https://your-app.up.railway.app/health
# Returns: {"status":"healthy",...}

# 3. API responds
curl https://your-app.up.railway.app/
# Returns: {"message":"Dynopay Backend API",...}

# 4. Binance test works
curl https://your-app.up.railway.app/diagnostics/test-binance
# Returns: {"success":true,...}
```

---

## 🚀 Next Steps

1. **Increase health check timeout to 10 minutes**
2. **Check Railway logs for actual error**
3. **Share logs with me if stuck**
4. **Once deployed, I'll test Binance integration**

---

**Most likely fix: Just increase health check timeout to 10 min and add initial delay of 60s!**

---

*Troubleshooting guide created: 2026-02-12*  
*Most common issue: Health check timeout too short*  
*Quick fix: Increase timeout or disable temporarily*
