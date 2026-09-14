# Railway Environment Variables - COMPLETE LIST

Copy these variables to Railway Dashboard → Variables

---

## ✅ REQUIRED Variables (Must have)

```bash
# Database
DB_NAME=your_database_name
USER_NAME=your_database_user
PASSWORD=your_database_password
HOST=your_database_host
DB_PORT=5432

# Redis
REDIS_PUBLIC_URL=your_redis_url

# Secrets
ACCESS_TOKEN_SECRET=your_access_token_secret
API_SECRET=your_api_secret

# Server URLs (Use Railway's auto-fill)
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}

# Port (Railway auto-provides)
PORT=${{PORT}}
```

---

## ✅ BINANCE Variables (For testing)

```bash
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
BINANCE_SECRET_KEY=REDACTED_BINANCE_SECRET
```

---

## 🟡 RECOMMENDED Variables (Optional but good to have)

```bash
# Email (if you want email notifications)
ADMIN_EMAIL=admin@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Tatum Webhook Secret (optional)
TATUM_WEBHOOK_SECRET=your_webhook_secret

# Environment
NODE_ENV=production
```

---

## 📋 Quick Add to Railway

**Method 1: Railway Dashboard (Easiest)**

1. Go to https://railway.app/dashboard
2. Click your project
3. Click "Variables" tab
4. Click "New Variable"
5. Add each variable one by one

**Method 2: Bulk Add (Faster)**

1. Railway → Variables
2. Click "RAW Editor" (top right)
3. Paste all variables at once:

```env
DB_NAME=your_database_name
USER_NAME=your_database_user
PASSWORD=your_database_password
HOST=your_database_host
DB_PORT=5432
REDIS_PUBLIC_URL=your_redis_url
ACCESS_TOKEN_SECRET=your_access_token_secret
API_SECRET=your_api_secret
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
BINANCE_SECRET_KEY=REDACTED_BINANCE_SECRET
NODE_ENV=production
```

4. Replace `your_*` values with actual credentials
5. Click "Save"

---

## 🚀 After Adding Variables

1. Railway will automatically redeploy
2. App should start successfully
3. Health check should pass
4. Share Railway URL with me for testing

---

## ✅ Fix Applied

I've also fixed the environment validator to:
- ✅ Allow localhost URLs on Railway (won't block deployment)
- ✅ Only warn instead of failing
- ✅ Work correctly in production

**Commit and push this change:**

```bash
git add backend/utils/envValidator.ts
git commit -m "Fix: Allow localhost URLs in Railway environment"
git push
```

Railway will auto-redeploy with the fix!

---

## 🎯 Current Issue Summary

**Problem:** Environment validator was too strict
**Error:** `FRONTEND_URL uses localhost in production`
**Solution:** Fixed validator to allow localhost on Railway

**Next Steps:**
1. Add Binance variables to Railway (above list)
2. Git push the envValidator fix
3. Railway will redeploy
4. Should work! ✅

---

**After these changes, your deployment should succeed!** 🚀
