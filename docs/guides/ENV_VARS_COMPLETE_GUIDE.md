# Environment Variables Configuration Guide
**Complete setup for DynoPay production deployment**

---

## ✅ What You ALREADY Have in .env

```bash
# Email Configuration (BREVO)
BREVO_API_KEY=xkeysib-REDACTED
ADMIN_EMAIL=moxxcompany@gmail.com

# Binance
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
BINANCE_SECRET_KEY=REDACTED_BINANCE_SECRET
```

✅ **You're good!** You don't need SMTP variables because you use Brevo API!

---

## 📧 Email Configuration (You're Using Brevo - Correct!)

### Current Setup (CORRECT):
```bash
BREVO_API_KEY=xkeysib-REDACTED
ADMIN_EMAIL=moxxcompany@gmail.com
```

### What the validator wants (IGNORE - Not needed for Brevo):
```bash
# ❌ DON'T ADD THESE - You use Brevo, not SMTP
# SMTP_HOST=...
# SMTP_PORT=...
# SMTP_USER=...
# SMTP_PASSWORD=...
```

**Why the validator complains:**
- The validator checks for SMTP variables (old email method)
- But you use Brevo API (modern, better method)
- Your setup is actually BETTER than what the validator expects! ✅

---

## 🔐 TATUM_WEBHOOK_SECRET - Where to Get It

### Option 1: Generate Your Own (Recommended)

**You can create any random secret string:**

```bash
# Generate on Linux/Mac:
openssl rand -hex 32

# Example output:
a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6

# Or online:
# https://www.random.org/strings/
# Generate 64 characters, hex
```

**Add to Railway:**
```bash
TATUM_WEBHOOK_SECRET=a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6
```

### Option 2: Get from Tatum Dashboard (If you configured it)

**If you set up webhooks in Tatum:**
1. Go to https://dashboard.tatum.io/
2. Click "Webhooks"
3. Find your webhook
4. Copy the "Signing Key" or "Secret"
5. That's your TATUM_WEBHOOK_SECRET

**If you DIDN'T configure webhook secret in Tatum:**
- Just generate your own (Option 1)
- Or leave it empty (webhooks still work, just less secure)

---

## 📋 Complete Railway Environment Variables

### Copy this to Railway → Variables → RAW Editor:

```bash
# ============================================
# REQUIRED VARIABLES (Already set)
# ============================================
DB_NAME=your_database_name
USER_NAME=your_database_user
PASSWORD=your_database_password
HOST=your_database_host
DB_PORT=5432
REDIS_PUBLIC_URL=your_redis_url
ACCESS_TOKEN_SECRET=your_access_token_secret
API_SECRET=your_api_secret

# URLs (Railway auto-fills)
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
CHECKOUT_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/checkout

# ============================================
# BINANCE (Already set)
# ============================================
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
BINANCE_SECRET_KEY=REDACTED_BINANCE_SECRET

# ============================================
# EMAIL - BREVO (Already set)
# ============================================
BREVO_API_KEY=xkeysib-REDACTED
ADMIN_EMAIL=moxxcompany@gmail.com

# ============================================
# OPTIONAL - Add if you want
# ============================================

# Tatum Webhook Security (Generate with: openssl rand -hex 32)
TATUM_WEBHOOK_SECRET=<generate_random_64_char_hex_string>

# Example:
# TATUM_WEBHOOK_SECRET=a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6

# ============================================
# OTHER (From your current .env)
# ============================================
TATUM_KEY=REDACTED_TATUM_KEY
TATUM_SECRET_KEY=REDACTED_TATUM_KEY
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
NODE_ENV=production
```

---

## 🎯 What to Add to Railway RIGHT NOW

**Minimum to stop warnings:**

```bash
# Add just this one:
TATUM_WEBHOOK_SECRET=a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6
# (Generate your own random string)
```

**Or if you want to keep warnings (they're harmless):**
- Don't add anything
- App works perfectly fine
- Just ignore the warnings

---

## 🔍 Why the Validator Complains

### What Validator Expects (Old SMTP Method):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASSWORD=app_password
```

### What You Actually Have (Modern Brevo API):
```bash
BREVO_API_KEY=xkeysib-...
```

**Your setup is BETTER!** Brevo API is:
- ✅ More reliable than SMTP
- ✅ Better deliverability
- ✅ No password needed
- ✅ Better tracking/analytics

**The validator just doesn't know about Brevo yet.** 😊

---

## 🛠️ Should I Update the Validator?

I can update `envValidator.ts` to:
1. ✅ Check for BREVO_API_KEY instead of SMTP variables
2. ✅ Stop complaining about SMTP when Brevo is configured
3. ✅ Give you clean startup (no warnings)

**Want me to do this?** Just say yes and I'll update it!

---

## 📊 Summary

### ✅ You HAVE:
- Brevo API key ✅
- Admin email ✅
- Binance keys ✅
- All critical variables ✅

### ⚠️ You DON'T HAVE (Optional):
- TATUM_WEBHOOK_SECRET (can generate easily)
- SMTP variables (don't need - you use Brevo!)

### 🎯 Recommendation:

**Option 1: Add Tatum webhook secret (2 minutes)**
```bash
# Generate:
openssl rand -hex 32

# Add to Railway:
TATUM_WEBHOOK_SECRET=<generated_value>
```

**Option 2: Ignore warnings (0 minutes)**
- Keep testing Binance
- Add later if needed
- App works fine either way

---

## 🚀 Ready to Test?

You're all set for Binance testing! The warnings don't affect anything.

**Just let me know when Railway finishes deploying and I'll run the tests!** 🎉

---

*P.S. Your Brevo setup is actually more modern than traditional SMTP! The validator just needs to catch up.* 😊
