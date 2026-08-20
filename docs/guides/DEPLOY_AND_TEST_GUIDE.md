# Deploy to Railway & Test Binance Integration
**Simple 3-Step Process: Deploy → Test → Done**

---

## 🎯 How This Works

**The Simple Solution:**
1. You deploy your app to Railway in **Europe or Asia region**
2. Railway gives you a URL: `https://your-app.up.railway.app`
3. I (running in Emergent pod) test Binance integration via your Railway URL
4. Since Railway is in non-US, Binance API works! ✅

**Why This Works:**
- Railway servers in Europe/Asia are NOT blocked by Binance
- Your app connects directly to Binance (no proxy/relay needed)
- Clean, simple architecture
- Same hosting cost as current setup

---

## 📋 Step 1: Deploy to Railway (10 minutes)

### Option A: Deploy via Railway Dashboard (Easiest)

**1. Go to Railway Dashboard**
```
https://railway.app/
```

**2. Create New Project**
- Click "New Project"
- Select "Deploy from GitHub repo"
- OR "Empty Project" → Connect GitHub later

**3. IMPORTANT: Set Region**
```
Settings → Region → Select:
  ✅ Europe (eu-west-1) - RECOMMENDED
  ✅ Asia Pacific (ap-southeast-1)
  ❌ US East (us-east-1) - DON'T USE
```

**4. Configure Environment Variables**

In Railway Dashboard → Variables, add:

```bash
# Database (keep your current values)
DB_NAME=your_db_name
USER_NAME=your_username
PASSWORD=your_password
HOST=your_host
DB_PORT=5432

# Redis (keep your current value)
REDIS_PUBLIC_URL=your_redis_url

# Binance API (already configured)
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET

# Other required vars
ACCESS_TOKEN_SECRET=your_secret
API_SECRET=your_api_secret
SERVER_URL=https://your-app.up.railway.app
FRONTEND_URL=https://your-app.up.railway.app
```

**5. Deploy**
- Railway will auto-deploy from your repo
- Wait ~5 minutes for build + deployment
- You'll get URL: `https://your-app.up.railway.app`

---

### Option B: Deploy via Railway CLI (Faster for devs)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project (in your /app directory)
cd /app
railway init

# 4. Link to project (if already exists)
railway link

# 5. Set region to Europe or Asia
# (Do this in Railway dashboard: Settings → Region)

# 6. Deploy
railway up

# 7. Get your URL
railway domain
```

---

## 📋 Step 2: Share Your Railway URL With Me

Once deployed, share your Railway URL:

**Example:**
```
https://dynopay-production.up.railway.app
```

**Or if you have custom domain:**
```
https://api.dynopay.com
```

I'll need this URL to test from the Emergent pod.

---

## 📋 Step 3: I Test Binance Integration

Once you share the URL, I'll run tests from here (Emergent pod):

### Test 1: Health Check
```bash
curl https://your-app.up.railway.app/health
```

Expected:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "tatum_api": { "operational": true }
}
```

### Test 2: Binance Server Time (Public endpoint)
```bash
curl -X POST https://your-app.up.railway.app/diagnostics/test-binance
```

Expected:
```json
{
  "success": true,
  "test": "server_time",
  "serverTime": 1707739200000,
  "message": "Binance API accessible"
}
```

### Test 3: Binance Account Info (Authenticated)
```bash
curl https://your-app.up.railway.app/diagnostics/binance-account \
  -H "Authorization: Bearer ADMIN_JWT"
```

Expected:
```json
{
  "success": true,
  "accountType": "SPOT",
  "balances": 15,
  "binanceConnected": true
}
```

### Test 4: Conversion Quote
```bash
curl -X POST https://your-app.up.railway.app/diagnostics/binance-quote \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAsset": "BTC",
    "toAsset": "USDT",
    "fromAmount": 0.001
  }'
```

Expected:
```json
{
  "success": true,
  "quoteId": "abc123xyz",
  "fromAmount": "0.001",
  "toAmount": "42.35",
  "ratio": "42350.00"
}
```

### Test 5: Full Conversion Flow

I'll test the complete auto-stablecoin conversion:
1. Create payment
2. Simulate crypto deposit
3. Trigger conversion
4. Verify conversion completes

---

## 🔍 What I'll Check

**From Emergent Pod, I'll verify:**

✅ Railway deployment is in non-US region  
✅ Binance API connectivity works  
✅ Account info retrieval works  
✅ Convert quote API works  
✅ Auto-stablecoin conversion flow works  
✅ Cron jobs trigger correctly  
✅ Email notifications send  
✅ Webhook deliveries work  

---

## 🚀 After Successful Tests

Once tests pass, you'll have:
- ✅ Working Binance integration
- ✅ Auto-stablecoin conversion functional
- ✅ Deployed in non-US region (compliant)
- ✅ No proxy/relay overhead
- ✅ Production-ready setup

---

## 📊 Deployment Checklist

**Before Deploying:**
- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Region set to Europe or Asia (NOT US)
- [ ] Environment variables configured
- [ ] Database/Redis accessible from Railway

**After Deploying:**
- [ ] Railway URL obtained
- [ ] Health check passes
- [ ] Railway URL shared with me (for testing)
- [ ] I run Binance tests from Emergent pod
- [ ] Tests pass ✅
- [ ] Production ready! 🎉

---

## 🛠️ Troubleshooting

### Issue: Railway region shows "US"
**Fix:** Settings → Region → Change to Europe/Asia → Redeploy

### Issue: Environment variables missing
**Fix:** Railway Dashboard → Variables → Add all required vars

### Issue: Database connection fails
**Fix:** Whitelist Railway's IP in your database firewall

### Issue: Build fails
**Fix:** Check Railway logs → Fix errors → Commit → Auto-redeploy

---

## 💰 Cost

**Railway Pricing:**
- Hobby Plan: $5/month (includes $5 credit)
- Pro Plan: $20/month (pay for usage)
- Same cost whether deployed in US or Europe

**No extra cost for non-US deployment!**

---

## 🌍 Recommended Regions

**Best for Binance:**
1. **Europe West (Ireland)** - Fastest to Europe
2. **Asia Pacific (Singapore)** - Fastest to Asia
3. **Asia Pacific (Tokyo)** - Also works well

**Avoid:**
- ❌ US East
- ❌ US West

---

## 📞 Ready to Deploy?

**Quick Checklist:**
1. Push code to GitHub ✅ (already done)
2. Create Railway project
3. Set region to Europe/Asia
4. Configure environment variables
5. Deploy
6. Share Railway URL with me
7. I test Binance integration from Emergent pod
8. Done! 🚀

---

## 🎯 Why This Is Better Than Proxy

| Aspect | Railway Non-US | Paid Proxy |
|--------|----------------|------------|
| **Cost** | $5-20/month | $28-500/month |
| **Reliability** | 99.9% | Variable |
| **Speed** | Fast | Slower (extra hop) |
| **Security** | Direct connection | Keys through proxy |
| **Maintenance** | None | Monitor proxy uptime |
| **Complexity** | Simple | More moving parts |

---

## 📧 What I Need From You

**To test Binance integration, send me:**

1. **Railway URL**
   ```
   https://your-app.up.railway.app
   ```

2. **Test Account Credentials** (optional, for full flow test)
   - JWT token OR
   - API key
   - Just for testing, can be revoked after

3. **What to test** (optional)
   - Just connectivity? ✅
   - Full conversion flow? ✅
   - Specific features?

---

## ✅ Simple Summary

**What you do:**
- Deploy to Railway in Europe/Asia region
- Share the Railway URL with me

**What I do:**
- Test Binance API from Emergent pod via your Railway URL
- Verify conversion flow works
- Confirm everything is operational

**Result:**
- Working Binance integration ✅
- No paid proxy needed ✅
- Production-ready deployment ✅

---

**Ready when you are! Just deploy and share the Railway URL.** 🚀

---

*Guide created: 2026-02-12*  
*Deployment time: ~10 minutes*  
*Testing time: ~15 minutes*  
*Total: ~25 minutes to working Binance integration*
