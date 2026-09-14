# DynoPay Environment Variables Guide

## Security Best Practices ✅

All API credentials and secrets are stored in `.env` file, NOT hardcoded in the codebase. This ensures:
- Easy credential rotation
- Secure deployment (credentials not in version control)
- Environment-specific configurations (dev/staging/production)

---

## Required Environment Variables

### 📧 Email Service (Brevo)
**Service**: Email notifications and OTP delivery
```env
BREVO_API_KEY=your_brevo_api_key_here
```
**How to get**: Sign up at [Brevo](https://www.brevo.com/) → Go to SMTP & API → Generate API key

---

### 💸 Payment Processing (Flutterwave)
**Service**: Fiat payment gateway (card payments, bank transfers)
```env
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
FLW_SECRET_HASH=your_flutterwave_webhook_hash
FLW_ENCRYPTION_KEY=your_flutterwave_encryption_key
```
**How to get**: Sign up at [Flutterwave](https://flutterwave.com/) → Dashboard → Settings → API Keys

---

### 🔗 Blockchain API (Tatum)
**Service**: Cryptocurrency wallet management and blockchain interactions
```env
TATUM_KEY=your_tatum_api_key
TATUM_SECRET_KEY=your_tatum_secret_key
```
**How to get**: Sign up at [Tatum](https://tatum.io/) → Dashboard → API Keys

---

### 🔐 Blockchain Data APIs
**Services**: Blockchain explorers and transaction verification
```env
CRYPTO_PUBLIC_KEY=your_crypto_api_public_key
CRYPTO_SECRET_KEY=your_crypto_api_secret_key
BLOCK_BEE_API_KEY=your_blockbee_api_key
BLOCKCHAIR_API_KEY=your_blockchair_api_key
```
**How to get**:
- [Crypto APIs](https://cryptoapis.io/) → Register → API Keys
- [BlockBee](https://blockbee.io/) → Dashboard → API Credentials
- [Blockchair](https://blockchair.com/api) → Get API key

---

### 🔐 Google Cloud KMS
**Service**: Secure private key management for crypto wallets
```env
PROJECT_ID=your_gcp_project_id
LOCATION_ID=global
KEY_RING_ID=your_key_ring_name
PRIVATE_KEY_ID=your_key_id
TEMP_KEY_ID=your_temp_key_id
XPUB_KEY_ID=your_xpub_key_id
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_CLIENT_KEY=-----BEGIN PRIVATE KEY-----REDACTED-----END PRIVATE KEY-----
```
**How to get**: 
1. Google Cloud Console → IAM & Admin → Service Accounts
2. Create service account → Generate JSON key
3. Enable Cloud KMS API
4. Create key ring and crypto keys

---

### 📊 Tax Data API (APILayer)
**Service**: VAT/tax rate validation and lookup
```env
TAX_DATA_API_URL=https://api.apilayer.com/tax_data
TAX_DATA_API_KEY=your_apilayer_api_key
```
**How to get**: Sign up at [APILayer](https://apilayer.com/) → Subscribe to Tax Data API → Copy API key

**Note**: The system has fallback tax rates for major countries if API is unavailable.

---

### 🆔 Identity Verification (Veriff)
**Service**: KYC (Know Your Customer) identity verification
```env
VERIFF_API_KEY=your_veriff_api_key
VERIFF_API_SECRET=your_veriff_api_secret
```
**How to get**: Sign up at [Veriff](https://www.veriff.com/) → Dashboard → Integrations → API Keys

**Note**: KYC is optional. If not configured, KYC endpoints will return an error explaining that Veriff is not set up.

---

### 💱 Currency Exchange API
**Service**: Real-time cryptocurrency to fiat conversion rates
```env
FAST_FOREX_KEY=your_fast_forex_api_key
```
**How to get**: Sign up at [FastForex](https://www.fastforex.io/) → Get API key

---

### 💬 SMS Notifications (Infobip)
**Service**: SMS delivery for OTP and notifications
```env
INFOBIP_API_KEY=your_infobip_api_key
```
**How to get**: Sign up at [Infobip](https://www.infobip.com/) → API Keys

---

### 🤖 Telegram Alerts (Optional)
**Service**: Internal system alerts and notifications
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```
**How to get**: Message [@BotFather](https://t.me/botfather) on Telegram → Create new bot → Copy token

---

## Database & Redis

### PostgreSQL Database
```env
DB_NAME=your_database_name
USER_NAME=postgres
PASSWORD=your_db_password
HOST=your_db_host
DB_PORT=5432
```

### Redis Cache
```env
REDIS_PUBLIC_URL=redis://default:password@host:port
```

---

## Security & Authentication

### JWT & Encryption
```env
ACCESS_TOKEN=your_random_access_token
ACCESS_TOKEN_SECRET=your_random_secret_key
API_SECRET=your_api_secret
CYPHER_KEY=your_encryption_key
```

**How to generate**: Use strong random string generators:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Configuration Summary

### ✅ Already Using Environment Variables (Secure)
- ✅ Database credentials
- ✅ Redis URL
- ✅ JWT secrets
- ✅ Brevo API key
- ✅ Flutterwave keys
- ✅ Tatum API keys
- ✅ Blockchain API keys
- ✅ Google Cloud KMS credentials
- ✅ Tax Data API key (now added)
- ✅ Veriff credentials (now added)

### 🎯 No Hardcoded Credentials Found
After comprehensive search:
- ❌ No API keys in TypeScript files
- ❌ No secrets in controller files
- ❌ No credentials in service files
- ✅ All production code uses `process.env.*`

---

## Environment Variable Usage in Code

### Example 1: Tax API
```typescript
// /app/backend/controller/taxController.ts
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY; // ✅ Correct

// NOT: const TAX_DATA_API_KEY = "abc123..."; // ❌ Wrong
```

### Example 2: Veriff Service
```typescript
// /app/backend/services/veriffService.ts
export const getVeriffService = (): VeriffService => {
  const apiKey = process.env.VERIFF_API_KEY;        // ✅ Correct
  const apiSecret = process.env.VERIFF_API_SECRET;  // ✅ Correct
  
  if (!apiKey || !apiSecret) {
    throw new Error("Veriff credentials not configured");
  }
  // ...
};
```

### Example 3: Database Connection
```typescript
// Database config uses environment variables
const config = {
  database: process.env.DB_NAME,      // ✅ Correct
  username: process.env.USER_NAME,    // ✅ Correct
  password: process.env.PASSWORD,     // ✅ Correct
  host: process.env.HOST,             // ✅ Correct
};
```

---

## Deployment Checklist

Before deploying to production:

1. ✅ Copy `.env.example` to `.env`
2. ✅ Fill in ALL required API keys
3. ✅ Generate strong random secrets for JWT and encryption
4. ✅ Set up Google Cloud KMS for wallet security
5. ✅ Configure database and Redis connections
6. ✅ Test all external API integrations
7. ✅ Verify environment variables are loaded: `node -e "require('dotenv').config(); console.log(process.env.BREVO_API_KEY ? 'Loaded' : 'Missing')"`
8. ✅ **NEVER commit `.env` file to version control**

---

## Optional Services

These services are optional. The system will function with degraded features if not configured:

### Optional but Recommended:
- **Tax Data API**: Falls back to hardcoded rates (may be outdated)
- **Veriff KYC**: Required only if you need identity verification
- **Telegram Bot**: Only for internal alerts
- **SMS (Infobip)**: Can use email-only if preferred

### Required for Core Functionality:
- Database (PostgreSQL)
- Redis
- Tatum API (blockchain operations)
- Google Cloud KMS (wallet security)
- Brevo (email notifications)

---

## Security Notes

1. **Never log API keys**: All services use proper error handling without exposing secrets
2. **Key rotation**: Change keys periodically, especially after team changes
3. **Environment separation**: Use different keys for dev/staging/production
4. **Access control**: Limit who can access production `.env` file
5. **Backup**: Keep encrypted backup of production keys in secure location

---

## Troubleshooting

### Service Not Working?
Check if environment variable is loaded:
```bash
# In Node.js console
require('dotenv').config();
console.log(process.env.TAX_DATA_API_KEY); // Should show your key
```

### Common Issues:
- **"API credentials not configured"**: Environment variable not set in `.env`
- **"Invalid API key"**: Wrong key or expired subscription
- **"Connection timeout"**: Check internet connectivity and API service status

---

**Last Updated**: 2026-01-24  
**Status**: ✅ All credentials properly externalized to `.env` file
