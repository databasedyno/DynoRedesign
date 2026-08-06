import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { log } from "../utils/loggers";

// Import path definitions
import { userPaths } from "./paths/user";
import { paymentPaths } from "./paths/payment";
import { walletPaths } from "./paths/wallet";
import { adminPaths } from "./paths/admin";
import { subscriptionPaths } from "./paths/subscription";
import { apiKeyPaths } from "./paths/apiKeys";
import { notificationPaths } from "./paths/notification";
import { referralPaths } from "./paths/referral";
import { knowledgeBasePaths } from "./paths/knowledgeBase";
import { apiUsagePaths } from "./paths/apiUsage";
import { companyPaths } from "./paths/company";
import { taxPaths } from "./paths/tax";
import { kycPaths } from "./paths/kyc";
import { directApiPaths } from "./paths/directApi";
import { embedPaths } from "./paths/embed";
import { webhookPaths } from "./paths/webhooks";
import { dashboardPaths } from "./paths/dashboard";
import { invoicePaths } from "./paths/invoice";
import { statusPaths } from "./paths/status";
import { securityPaths } from "./paths/security";
import { analyticsPaths } from "./paths/analytics";
import { eventsPaths } from "./paths/events";

// Merge all paths
const allPaths = {
  ...userPaths,
  ...paymentPaths,
  ...walletPaths,
  ...adminPaths,
  ...subscriptionPaths,
  ...apiKeyPaths,
  ...notificationPaths,
  ...referralPaths,
  ...knowledgeBasePaths,
  ...apiUsagePaths,
  ...companyPaths,
  ...taxPaths,
  ...kycPaths,
  ...directApiPaths,
  ...embedPaths,
  ...webhookPaths,
  ...dashboardPaths,
  ...invoicePaths,
  ...statusPaths,
  ...securityPaths,
  ...analyticsPaths,
  ...eventsPaths,
};

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dynopay API Documentation",
      version: "1.0.0",
      description: `# Dynopay - Crypto Payment Gateway API (v1)

Accept cryptocurrency payments with ease using Dynopay's comprehensive API.

---

## 📌 API Versioning

All endpoints are available under both base paths:

| Base Path | Description |
|-----------|-------------|
| \`/api/...\` | Default (backward compatible, currently maps to v1) |
| \`/api/v1/...\` | Explicitly versioned — recommended for new integrations |

**Example:** \`POST /api/user/login\` and \`POST /api/v1/user/login\` are identical.

Existing integrations require **no code changes**. When a future v2 is released, \`/api/v1/...\` will continue working as-is.

---

## 🔐 Authentication Guide

Dynopay uses **two types of authentication** depending on your use case:

### 1. JWT Token (Bearer Authentication)
**Use for:** Dashboard operations, managing your account, companies, payment links, wallets

| Operation | Auth Required |
|-----------|---------------|
| Create/Update Company | ✅ JWT Token |
| Create Payment Link | ✅ JWT Token |
| Manage Wallets | ✅ JWT Token |
| View Dashboard | ✅ JWT Token |
| Manage Profile | ✅ JWT Token |

**How to get JWT Token:**
\`\`\`
POST /api/user/login
{
  "email": "your@email.com",
  "password": "yourpassword"
}
\`\`\`
Response contains \`accessToken\` - use this in the \`Authorization: Bearer <token>\` header.

### 2. API Key (x-api-key Header)
**Use for:** Server-to-server integration, programmatic payment creation, direct crypto payments

| Operation | Auth Required |
|-----------|---------------|
| Create Customer | ✅ API Key only |
| Get Supported Currencies | ✅ API Key only |
| Direct Crypto Payment | ✅ API Key + Customer Token |
| Get Customer Balance | ✅ API Key + Customer Token |
| Get Customer Transactions | ✅ API Key + Customer Token |

**How to get API Key:**
1. Login to Dynopay dashboard (\`POST /api/user/login\`)
2. Navigate to API Keys section in dashboard
3. Create new API key via \`POST /api/userApi/addApi\` OR use dashboard UI
4. Copy the **encrypted API key** value (starts with long encrypted string)
5. Store it securely - treat it like a password

**Important Notes:**
- ⚠️ Use the **encrypted API key** from the response, NOT the raw key ID
- ✅ The encrypted key is a long string that looks like: \`U2FsdGVkX1+abc123def456...\`
- 🔒 Never commit API keys to version control
- 📝 Each API key is tied to a specific company

**Example API Key Request:**
\`\`\`bash
curl -X POST https://api.dynopay.com/api/user/createUser \\
  -H "x-api-key: U2FsdGVkX1+abc123def456ghi789jkl..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com"
  }'
\`\`\`

---

## 🔄 Authentication Flows

### Flow 1: NEW API (Recommended)
**For Direct Crypto Payments with Customer Management**

\`\`\`
1. Create Customer
   POST /api/user/createUser
   Headers: x-api-key: YOUR_ENCRYPTED_API_KEY
   → Returns: customer_token

2. Create Payment
   POST /api/user/cryptoPayment  
   Headers: x-api-key: YOUR_ENCRYPTED_API_KEY
           Authorization: Bearer CUSTOMER_TOKEN
   → Returns: crypto_address, qr_code, amount

3. Receive Webhook
   Your server receives payment.confirmed webhook
   → Process order fulfillment
\`\`\`

### Flow 2: LEGACY API (Backward Compatible)
**For Old Integrations Without Customer Management**

\`\`\`
1. Create Payment (One Step)
   POST /api/user/cryptoPayment
   Headers: x-api-key: YOUR_ENCRYPTED_API_KEY
           Authorization: Bearer (optional/empty/invalid)
   → System auto-creates default customer
   → Returns: crypto_address, qr_code, amount

2. Receive Webhook
   Your server receives payment.confirmed webhook
   → Process order fulfillment
\`\`\`

**Note:** Legacy flow automatically creates/reuses a default customer for your company.

---

## ❓ Common Questions & Flow Comparison

### Q: Do I need both JWT Token and API Key?
**A: No!** Choose based on your integration type:

| Your Use Case | Authentication Method | Endpoints to Use |
|---------------|----------------------|------------------|
| 🖥️ **Dashboard User** (creating payments via UI) | JWT Token only | \`/api/pay/createPaymentLink\` |
| 🔌 **API Integration** (programmatic payments) | API Key + Customer Token | \`/api/user/createUser\` → \`/api/user/cryptoPayment\` |
| 🔄 **Both** (dashboard + API) | Both methods for same company | Use appropriate auth for each endpoint |

### Q: How do I pass API Key for webhook delivery?
**A: You don't!** Webhooks are sent automatically - no authentication needed.

**How Webhooks Work:**
1. ✅ You configure \`webhook_url\` when creating payment (or in company settings)
2. ✅ System stores your webhook URL with the payment record
3. ✅ When payment completes, webhook is automatically sent to your URL
4. ❌ NO API Key or JWT needed for webhook delivery
5. ✅ System already knows which merchant from the payment record

### Q: Where do I configure webhook URLs?
**A: Three configuration options** (priority order):

| Priority | Location | When to Use |
|----------|----------|-------------|
| **1st** | Per-payment \`webhook_url\` field | Different webhook per payment/product |
| **2nd** | API Key settings | Different webhook per API integration |
| **3rd** | Company default settings | Same webhook for all payments |

**Example:**
\`\`\`javascript
// Option 1: Per-payment (highest priority)
POST /api/pay/createPaymentLink
{
  "amount": 100,
  "webhook_url": "https://myapp.com/webhooks/order-123"  // ← Specific to this payment
}

// Option 2: Company-wide (fallback)
// Configure once in dashboard → Settings → Webhooks
// Used for all payments if per-payment webhook_url not provided
\`\`\`

### Q: What's the difference between Payment Links and Direct API?
**A: Two integration methods with different payment handling:**

**🔗 Payment Links (Hosted Checkout)**
- **Best for:** Dashboard users, no-code integration, shareable payment pages
- **Auth:** JWT Token (login to dashboard)
- **Flow:** Create link → Share URL → Customer pays → Webhook sent
- **Customer experience:** Redirected to Dynopay hosted payment page
- **Endpoints:** \`/api/pay/createPaymentLink\`, \`/api/pay/getAllPaymentLinks\`
- **Payment handling:** Uses company-level settings for underpayment threshold, overpayment threshold, and grace period

**⚡ Direct API (Programmatic)**
- **Best for:** Custom checkout, embedded payments, full control
- **Auth:** API Key + Customer Token
- **Flow:** Create customer → Create payment → Get crypto address → Customer pays → Webhook sent
- **Customer experience:** Stay on your website/app (you build the UI)
- **Endpoints:** \`/api/user/createUser\`, \`/api/user/cryptoPayment\`, \`/api/user/getBalance\`
- **Payment handling:** Whatever crypto is received gets processed immediately — no grace period, no underpayment/overpayment thresholds

**⚠️ Key Difference — Payment Settings:**

| Setting | Payment Links | Direct API |
|---------|:------------:|:----------:|
| \`grace_period_minutes\` | ✅ Used (max 30 min) | ❌ Not used |
| \`underpayment_threshold_usd\` | ✅ Used | ❌ Not used |
| \`overpayment_threshold_usd\` | ✅ Used | ❌ Not used |
| Underpayment behavior | Wait for remainder during grace period | Process immediately with received amount |
| Overpayment behavior | Detect + notify customer of excess | Process full amount to merchant |

### Q: Can I use both Payment Links and Direct API in the same company?
**A: Yes!** You can use both methods simultaneously:
- Payment Links for manual/dashboard payments
- Direct API for automated/programmatic payments
- Both receive webhooks to same or different URLs

### Q: How do I test webhooks locally?
**A: Use a tunnel service** (localhost webhooks won't work from cloud):

1. **ngrok** (recommended): \`ngrok http 3000\` → Get public URL
2. **localtunnel**: \`lt --port 3000\`
3. **Cloudflare Tunnel**: \`cloudflared tunnel\`

Then use the public URL as your \`webhook_url\`:
\`\`\`json
{
  "webhook_url": "https://abc123.ngrok.io/webhooks/payment"
}
\`\`\`

**Why localhost doesn't work:**
- Dynopay servers are in the cloud
- Cannot reach \`http://localhost\` or \`http://127.0.0.1\` on your machine
- Need publicly accessible URL for webhook delivery

### Q: What headers are included in webhook requests?
**A: Standard webhook headers sent to your URL:**

\`\`\`http
POST /your-webhook-endpoint HTTP/1.1
Host: yourapp.com
Content-Type: application/json
X-Dynopay-Event: payment.confirmed
X-DynoPay-Signature: abc123... (HMAC-SHA256, if webhook_secret configured)
X-Dynopay-Timestamp: 1704067200
X-Dynopay-Webhook-Id: wh_abc123

{
  "event": "payment.confirmed",
  "payment_id": "pay_xyz789",
  "amount": 0.042,
  "currency": "ETH",
  ...
}
\`\`\`

**Signature Verification (Optional but Recommended):**
\`\`\`javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}
\`\`\`

### Q: What webhook events will I receive?
**A: Three main webhook events:**

| Event | When Sent | Action Required |
|-------|-----------|-----------------|
| \`payment.pending\` | Crypto deposit detected on blockchain | ⏳ Wait for confirmations |
| \`payment.confirmed\` | Payment fully confirmed (1-3 confirmations) | ✅ Fulfill order / deliver product |
| \`payment.underpaid\` | Partial payment received (less than expected) | ⚠️ Contact customer or wait for remainder |

**Best Practice:** Only fulfill orders on \`payment.confirmed\` event.

### Q: How do I get my API Key?
**A: Two methods:**

**Method 1: Via Dashboard (Recommended)**
1. Login to Dynopay dashboard
2. Navigate to Settings → API Keys
3. Click "Create New API Key"
4. Copy the **encrypted API key** (long string starting with U2FsdGVk...)
5. Store securely (treat like a password)

**Method 2: Via API**
\`\`\`bash
# Step 1: Login to get JWT token
POST /api/user/login
{
  "email": "your@email.com",
  "password": "yourpassword"
}
# Response: { "accessToken": "jwt_token_here" }

# Step 2: Create API key
POST /api/userApi/addApi
Authorization: Bearer jwt_token_here
{
  "company_id": 38,
  "name": "Production API Key"
}
# Response: { "api_key": "U2FsdGVkX1+abc123..." } ← Use this!
\`\`\`

⚠️ **Important:** Use the **encrypted string** (not the numeric ID) in \`x-api-key\` header.

### Q: What cryptocurrencies are supported?
**A: 15 cryptocurrencies across 7 networks:**

| Cryptocurrency | Symbol | Network | Min Amount |
|----------------|--------|---------|------------|
| Bitcoin | BTC | Bitcoin | 0.0001 BTC |
| Ethereum | ETH | Ethereum | 0.001 ETH |
| Litecoin | LTC | Litecoin | 0.01 LTC |
| Dogecoin | DOGE | Dogecoin | 10 DOGE |
| Tron | TRX | Tron | 10 TRX |
| Bitcoin Cash | BCH | Bitcoin Cash | 0.001 BCH |
| Tether (Tron) | USDT-TRC20 | Tron | 1 USDT |
| Tether (Ethereum) | USDT-ERC20 | Ethereum | 1 USDT |
| USD Coin | USDC-ERC20 | Ethereum | 1 USDC |
| Solana | SOL | Solana | 0.01 SOL |
| Ripple (XRP) | XRP | XRP Ledger | 1 XRP |
| Ripple USD | RLUSD | XRP Ledger | 1 RLUSD |
| Ripple USD (Ethereum) | RLUSD-ERC20 | Ethereum | 1 RLUSD |
| Polygon (POL) | POLYGON | Polygon | 1 POL |
| Tether (Polygon) | USDT-POLYGON | Polygon | 1 USDT |

**⚠️ XRP/RLUSD Note:** These use tag-based addressing (shared master address + destination tag). The \`destination_tag\` field is included in webhook payloads for XRP/RLUSD payments.

**Check your configured wallets:**
\`\`\`bash
GET /api/user/getSupportedCurrency
x-api-key: YOUR_API_KEY
\`\`\`

---

## 🚀 Quick Start Examples

### Example 1: Create Payment Link (JWT Auth)
**Use Case:** Accept payment via hosted checkout page

\`\`\`bash
# Step 1: Login to get JWT token
curl -X POST https://api.dynopay.com/api/user/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "merchant@example.com",
    "password": "yourpassword"
  }'

# Response: { "accessToken": "eyJhbGc..." }

# Step 2: Create payment link
curl -X POST https://api.dynopay.com/api/pay/createPaymentLink \\
  -H "Authorization: Bearer eyJhbGc..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100,
    "company_id": 38,
    "currency": "USD",
    "description": "Product Purchase",
    "webhook_url": "https://yourapp.com/webhooks/payment",
    "modes": ["CRYPTO"]
  }'

# Response: { "checkout_url": "https://pay.dynopay.com/abc123" }
# Share this URL with your customer!
\`\`\`

### Example 2: Direct Crypto Payment (API Key Auth)
**Use Case:** Programmatic payment with custom checkout

\`\`\`bash
# Step 1: Create customer
curl -X POST https://api.dynopay.com/api/user/createUser \\
  -H "x-api-key: U2FsdGVkX1+abc123def456..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "customer@example.com"
  }'

# Response: { "data": { "token": "customer_jwt_token", "customer_id": "uuid" } }

# Step 2: Create crypto payment
curl -X POST https://api.dynopay.com/api/user/cryptoPayment \\
  -H "x-api-key: U2FsdGVkX1+abc123def456..." \\
  -H "Authorization: Bearer customer_jwt_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100,
    "currency": "ETH",
    "webhook_url": "https://yourapp.com/webhooks/payment",
    "redirect_uri": "https://yourapp.com/order/success"
  }'

# Response: { 
#   "address": "0x742d35Cc...", 
#   "amount": 0.042156,
#   "qr_code": "data:image/png;base64,..."
# }
# Show QR code to customer for payment!
\`\`\`

### Example 3: Webhook Handler (Your Server)
**Handle payment notifications:**

\`\`\`javascript
// Node.js/Express webhook endpoint
app.post('/webhooks/payment', (req, res) => {
  const webhook = req.body;
  
  // Verify webhook signature (recommended)
  const signature = req.headers['x-dynopay-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(webhook),
    signature,
    process.env.WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Handle different events
  switch (webhook.event) {
    case 'payment.confirmed':
      // ✅ Payment successful - fulfill order
      fulfillOrder(webhook.payment_id, webhook.amount);
      console.log(\`Payment confirmed: \${webhook.payment_id}\`);
      break;
      
    case 'payment.pending':
      // ⏳ Payment detected - wait for confirmations
      console.log(\`Payment pending: \${webhook.payment_id}\`);
      break;
      
    case 'payment.underpaid':
      // ⚠️ Partial payment - notify customer
      notifyCustomer(webhook.customer_email, 'Partial payment received');
      break;
  }
  
  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

function verifyWebhookSignature(payload, signature, secret) {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expectedSignature;
}
\`\`\`

---

## 🔍 Searchable Keywords

**Authentication:** JWT Token, Bearer Auth, API Key, x-api-key, Login, Authorization, Customer Token

**Payment Creation:** Payment Link, Create Payment, Crypto Payment, Direct API, Hosted Checkout, Checkout URL

**Cryptocurrencies:** Bitcoin (BTC), Ethereum (ETH), Litecoin (LTC), Dogecoin (DOGE), Tron (TRX), Bitcoin Cash (BCH), Tether (USDT-TRC20, USDT-ERC20, USDT-POLYGON), USD Coin (USDC-ERC20), Solana (SOL), Ripple (XRP), Ripple USD (RLUSD, RLUSD-ERC20), Polygon (POL/POLYGON), Destination Tag, Tag-Based Chain

**Webhooks:** Webhook URL, Payment Notification, Callback URL, Webhook Signature, HMAC, Event Types, payment.confirmed, payment.pending, payment.underpaid

**Customer Management:** Create Customer, Customer Token, Customer Wallet, Balance, Transactions

**Integration Types:** REST API, Server-to-Server, Programmatic Integration, Dashboard Integration, Hosted Integration

**Common Operations:** Get Balance, Get Transactions, Get Supported Currencies, Create User, Verify Payment

**Testing:** ngrok, localhost tunnel, webhook testing, sandbox, test mode

**Errors:** 400 Bad Request, 401 Unauthorized, 403 Forbidden, 500 Internal Server Error, Invalid API Key, Missing Amount

---

## 📚 Additional Resources

**Dashboard:** https://dashboard.dynopay.com  
**API Base URL:** https://api.dynopay.com  
**Checkout Base URL:** https://pay.dynopay.com  
**Support:** support@dynopay.com  
**Documentation:** This page + inline endpoint descriptions

---

## 🔒 Security Best Practices

1. **Never expose API keys** in client-side code or public repositories
2. **Use HTTPS** for all API calls (enforced by server)
3. **Verify webhook signatures** to prevent spoofing attacks
4. **Store credentials** in environment variables, not hardcoded
5. **Rotate API keys** periodically (every 90 days recommended)
6. **Use separate API keys** for development and production
7. **Implement rate limiting** on your webhook endpoints
8. **Log all webhook events** for audit trail
9. **Validate webhook URLs** are publicly accessible (no localhost)
10. **Keep JWT tokens short-lived** (automatically handled - 7 days)

---

**For Dashboard Users (JWT Auth):**
1. Login: \`POST /api/user/login\` → Get JWT token
2. Create Company: \`POST /api/company/addCompany\` (if needed)
3. Create Payment Link: \`POST /api/pay/createPaymentLink\`
4. Share the payment link with your customers

**For Developers (API Key Auth):**
1. Get API Key from dashboard or \`POST /api/userApi/addApi\`
2. Create Customer: \`POST /api/user/createUser\` (with x-api-key)
3. Generate Payment: \`POST /api/user/cryptoPayment\` (with x-api-key + customer token)
4. Receive webhook when payment completes

---`,
      contact: {
        name: "Dynopay Support",
        url: "https://dynopay.com/support",
        email: "support@dynopay.com",
      },
      license: {
        name: "Private",
        url: "https://dynopay.com/terms",
      },
    },
    servers: [
      {
        url: process.env.SERVER_URL || "http://localhost:8001",
        description: "API Server — endpoints available at both /api/* and /api/v1/*",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Token - Get from POST /api/user/login. Use for: Dashboard operations, company management, payment links, wallets.",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API Key - Get from dashboard or POST /api/userApi/addApi. Use for: Server-to-server integration, programmatic payments.",
        },
        PublishableKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-publishable-key",
          description: "Browser-safe publishable key (pk_live_... / pk_test_...) — domain-locked + amount-capped. Used by the Elements Inline Widget endpoints (/api/embed/public/elements/*). The request Origin must match the key's allowed_domains.",
        },
      },
      schemas: {
        // User Schemas
        User: {
          type: "object",
          properties: {
            user_id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            mobile: { type: "string" },
            photo: { type: "string" },
            login_type: { type: "string", enum: ["EMAIL", "GOOGLE", "TELEGRAM"] },
            status: { type: "string" },
            email_verified: { type: "boolean", description: "Whether the user has verified their email via OTP. Unverified users cannot access company, wallet, or dashboard features.", example: false },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                token: { type: "string" },
                user: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
        // Company Schemas
        Company: {
          type: "object",
          properties: {
            company_id: { type: "integer" },
            company_name: { type: "string" },
            email: { type: "string" },
            website: { type: "string" },
            address_line1: { type: "string" },
            address_line2: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            country: { type: "string" },
            zip_code: { type: "string" },
            vat_number: { type: "string" },
            vat_type: { type: "string" },
            vat_verified: { type: "boolean" },
          },
        },
        // Wallet Schemas
        WalletAddress: {
          type: "object",
          properties: {
            id: { type: "integer" },
            wallet_address: { type: "string" },
            currency: { type: "string" },
            label: { type: "string" },
            wallet_name: { type: "string" },
            company_id: { type: "integer" },
            user_id: { type: "integer" },
          },
        },
        AddWalletAddressRequest: {
          type: "object",
          required: ["wallet_address", "currency"],
          properties: {
            wallet_address: { type: "string" },
            currency: { type: "string", enum: ["BTC", "ETH", "LTC", "TRX", "DOGE", "BCH", "USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "SOL", "XRP", "RLUSD", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"] },
            label: { type: "string" },
            wallet_name: { type: "string" },
            company_id: { type: "integer" },
          },
        },
        // API Key Schemas
        ApiKey: {
          type: "object",
          properties: {
            api_id: { type: "integer" },
            api_name: { type: "string" },
            apiKey: { type: "string" },
            base_currency: { type: "string" },
            company_id: { type: "integer" },
            company_name: { type: "string" },
          },
        },
        CreateApiKeyRequest: {
          type: "object",
          required: ["company_id", "base_currency"],
          properties: {
            company_id: { type: "integer" },
            base_currency: { type: "string", enum: ["USD", "EUR", "GBP", "AUD", "CAD", "NGN", "BRL", "ZAR", "KES", "GHS", "JPY", "CHF", "SGD", "HKD", "NZD", "MXN"] },
            api_name: { type: "string" },
            withdrawal_whitelist: { type: "array", items: { type: "string" } },
          },
        },
        // Dashboard Schemas
        DashboardStats: {
          type: "object",
          description: "Comprehensive dashboard statistics. Counts include ALL transactions (incoming + self-transfers) regardless of status. Volumes are converted from each crypto currency to the company's preferred fiat currency using live exchange rates.",
          properties: {
            total_transactions: {
              type: "object",
              description: "Transaction counts (incoming from tbl_user_transaction + self-transfers). No status filter — matches analytics historicalTrends behavior.",
              properties: {
                count: { type: "integer", description: "All-time total (incoming + self-transactions)", example: 640 },
                current_month: { type: "integer", description: "Transactions created in the current calendar month", example: 9 },
                change_percent: { type: "number", description: "Month-over-month % change: ((current - last) / last) * 100", example: -95.1 },
                comparison_period: { type: "string", enum: ["last_month"], example: "last_month" },
              },
            },
            total_volume: {
              type: "object",
              description: "Volume amounts converted to the company's preferred fiat currency. Each crypto currency is converted individually using live rates before summing.",
              properties: {
                amount: { type: "number", description: "All-time total volume in preferred currency", example: 14804.37 },
                amount_formatted: { type: "string", description: "Formatted display string with currency symbol", example: "$14,804.37 USD" },
                current_month: { type: "number", description: "Current month volume in preferred currency", example: 350.20 },
                current_month_formatted: { type: "string", example: "$350.20 USD" },
                currency: { type: "string", description: "The fiat currency used for display (from company settings)", example: "USD" },
                currency_info: { type: "object", description: "Currency metadata (symbol, name, decimals)" },
                change_percent: { type: "number", description: "Month-over-month volume % change in fiat terms", example: -42.5 },
                comparison_period: { type: "string", enum: ["last_month"], example: "last_month" },
              },
            },
            pending_transactions: {
              type: "object",
              properties: {
                count: { type: "integer", description: "Transactions currently in 'pending' status", example: 3 },
              },
            },
            active_wallets: {
              type: "object",
              properties: {
                count: { type: "integer", example: 5 },
                wallets: { type: "array", items: { type: "string" }, example: ["BTC", "ETH", "USDT-ERC20"] },
                details: { type: "array", items: { type: "object" }, description: "Full wallet records with wallet_type, wallet_name, company_id" },
              },
            },
            fee_tier: {
              type: "object",
              description: "Fee tier based on current month USD volume, with thresholds displayed in preferred currency.",
              properties: {
                current_tier: { type: "string", example: "Starter" },
                tier_description: { type: "string", example: "For new users testing the platform" },
                monthly_volume: { type: "number", description: "Current month volume in preferred currency", example: 350.20 },
                monthly_volume_usd: { type: "number", description: "Current month volume in USD (reference)", example: 350.20 },
                tier_threshold: { type: "number", nullable: true, description: "Upper threshold of current tier in preferred currency (null for Enterprise)", example: 10000 },
                tier_threshold_formatted: { type: "string", example: "$10,000 USD" },
                percent_complete: { type: "number", description: "Percentage progress toward next tier", example: 3.5 },
                amount_to_next_tier: { type: "number", example: 9649.80 },
                amount_to_next_tier_formatted: { type: "string", nullable: true, example: "$9,649.80 USD" },
                next_tier: { type: "string", nullable: true, example: "Standard" },
                currency: { type: "string", example: "USD" },
              },
            },
          },
        },
        // Tax Schemas
        TaxRate: {
          type: "object",
          properties: {
            country_code: { type: "string" },
            country_name: { type: "string" },
            tax_acronym: { type: "string" },
            standard_rate: { type: "number" },
            cached: { type: "boolean" },
          },
        },
        // Notification Schemas
        Notification: {
          type: "object",
          properties: {
            notification_id: { type: "integer" },
            type: { type: "string" },
            title: { type: "string" },
            message: { type: "string" },
            is_read: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        NotificationPreferences: {
          type: "object",
          properties: {
            transaction_updates: { type: "boolean" },
            payment_received: { type: "boolean" },
            weekly_summary: { type: "boolean" },
            security_alerts: { type: "boolean" },
            email_notifications: { type: "boolean" },
            sms_notifications: { type: "boolean" },
            browser_notifications: { type: "boolean" },
          },
        },
        // Error Response
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", default: false },
            message: { type: "string" },
            statusCode: { type: "integer" },
          },
        },
        // Success Response
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", default: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        // Status Page Schemas
        ServiceStatus: {
          type: "object",
          properties: {
            id: { type: "string", example: "api_gateway" },
            name: { type: "string", example: "API Gateway" },
            status: { type: "string", enum: ["operational", "degraded", "outage"] },
            uptime: { type: "string", example: "99.99" },
            latency: { type: "integer", example: 45 },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceDetailedStatus: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["operational", "degraded", "outage", "unknown"] },
            uptime: { type: "string", example: "99.99%" },
            uptime_value: { type: "number", example: 99.99 },
            latency_ms: { type: "integer" },
            total_checks: { type: "integer" },
            failed_checks: { type: "integer" },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceHealthResult: {
          type: "object",
          properties: {
            service_id: { type: "string" },
            service_name: { type: "string" },
            status: { type: "string", enum: ["operational", "degraded", "outage"] },
            latency_ms: { type: "integer" },
            last_check: { type: "string", format: "date-time" },
          },
        },
        ServiceUptimeHistory: {
          type: "object",
          properties: {
            service_id: { type: "string" },
            service_name: { type: "string" },
            period_days: { type: "integer" },
            uptime_percentage: { type: "string" },
            total_checks: { type: "integer" },
            summary: {
              type: "object",
              properties: {
                operational_days: { type: "integer" },
                degraded_days: { type: "integer" },
                outage_days: { type: "integer" },
                no_data_days: { type: "integer" },
              },
            },
            daily_status: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", format: "date" },
                  status: { type: "string", enum: ["operational", "degraded", "outage", "no_data"] },
                  checks: { type: "integer" },
                  avg_latency: { type: "integer" },
                },
              },
            },
          },
        },
        Incident: {
          type: "object",
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["resolved", "investigating", "identified", "monitoring"] },
            date: { type: "string", format: "date" },
            formatted_date: { type: "string" },
            services_affected: { type: "array", items: { type: "string" } },
          },
        },
        // Invoice Schemas
        Invoice: {
          type: "object",
          properties: {
            invoice_id: { type: "string" },
            invoice_number: { type: "string", example: "INV-2026-0001" },
            transaction_id: { type: "string" },
            company_id: { type: "integer" },
            customer_email: { type: "string" },
            customer_name: { type: "string" },
            subtotal: { type: "number" },
            fee_amount: { type: "number" },
            fee_percentage: { type: "number" },
            vat_rate: { type: "number" },
            vat_amount: { type: "number" },
            total_amount: { type: "number" },
            currency: { type: "string" },
            status: { type: "string", enum: ["draft", "sent", "paid", "cancelled"] },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Auto-Stablecoin Conversion Schemas
        AutoConvertInfo: {
          type: "object",
          description: "Auto-stablecoin conversion details for a transaction (present when auto_converted=true)",
          properties: {
            conversion_id: { type: "integer", description: "Unique conversion record ID" },
            status: { 
              type: "string", 
              enum: ["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING", "COMPLETED", "FAILED"],
              description: "Current conversion status",
              example: "COMPLETED",
            },
            source_currency: { type: "string", description: "Original volatile crypto received", example: "BTC" },
            source_amount: { type: "number", description: "Amount of original crypto", example: 0.5 },
            source_amount_usd: { type: "number", nullable: true, description: "USD value at time of payment", example: 33709.50 },
            source_amount_display: { type: "number", nullable: true, description: "Source amount converted to API base key currency", example: 31200.00 },
            source_amount_display_currency: { type: "string", nullable: true, description: "API base key currency", example: "EUR" },
            target_currency: { type: "string", description: "Stablecoin received after conversion", example: "USDT" },
            target_amount: { type: "number", nullable: true, description: "Amount of stablecoin after conversion", example: 33650.12 },
            settlement_chain: { type: "string", description: "Blockchain used for stablecoin withdrawal", example: "ERC20" },
            conversion_rate: { type: "number", nullable: true, description: "Exchange rate (e.g., 1 BTC = 67419.01 USDT)", example: 67419.01 },
            completed_at: { type: "string", format: "date-time", nullable: true, description: "When conversion was fully completed" },
          },
        },
        StablecoinConversion: {
          type: "object",
          description: "Full stablecoin conversion audit record",
          properties: {
            conversion_id: { type: "integer" },
            transaction_id: { type: "integer", description: "FK to original payment transaction" },
            company_id: { type: "integer" },
            user_id: { type: "integer" },
            source_currency: { type: "string", example: "BTC" },
            source_amount: { type: "number", example: 0.5 },
            source_amount_usd: { type: "number", nullable: true, example: 33709.50 },
            target_currency: { type: "string", example: "USDT" },
            target_amount: { type: "number", nullable: true, example: 33650.12 },
            settlement_wallet_address: { type: "string", example: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" },
            settlement_chain: { type: "string", example: "ERC20" },
            deposit_tx_hash: { type: "string", nullable: true, description: "TX hash of crypto sent to admin wallet" },
            admin_wallet_address: { type: "string", nullable: true },
            binance_quote_id: { type: "string", nullable: true, description: "Binance Convert quote ID" },
            binance_order_id: { type: "string", nullable: true, description: "Binance Convert order ID" },
            conversion_rate: { type: "number", nullable: true, example: 67419.01 },
            conversion_fee: { type: "number", nullable: true, description: "Spread charged by Binance" },
            withdrawal_id: { type: "string", nullable: true, description: "Binance withdrawal ID" },
            withdrawal_tx_hash: { type: "string", nullable: true, description: "On-chain TX of stablecoin to merchant" },
            withdrawal_fee: { type: "number", nullable: true, description: "Binance withdrawal fee" },
            status: { 
              type: "string", 
              enum: ["PENDING_DEPOSIT", "DEPOSIT_CREDITED", "CONVERTING", "CONVERTED", "WITHDRAWING", "COMPLETED", "FAILED"],
              example: "COMPLETED",
            },
            error_message: { type: "string", nullable: true },
            retry_count: { type: "integer", example: 0 },
            deposit_confirmed_at: { type: "string", format: "date-time", nullable: true },
            converted_at: { type: "string", format: "date-time", nullable: true },
            withdrawn_at: { type: "string", format: "date-time", nullable: true },
            completed_at: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        // Transaction Schema
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            transaction_reference: { type: "string" },
            base_amount: { type: "number" },
            base_currency: { type: "string" },
            crypto_amount: { type: "number" },
            crypto_currency: { type: "string" },
            status: { type: "string", enum: ["pending", "done", "failed", "expired"] },
            payment_mode: { type: "string" },
            customer_email: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Payment Link Schema
        PaymentLink: {
          type: "object",
          properties: {
            link_id: { type: "integer" },
            payment_link: { type: "string", format: "uri" },
            email: { type: "string" },
            base_amount: { type: "number" },
            base_currency: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["pending", "paid", "expired"] },
            fee_payer: { type: "string", enum: ["customer", "company"] },
            expires_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // KYC Schema
        KYCStatus: {
          type: "object",
          properties: {
            kyc_id: { type: "integer" },
            status: { type: "string", enum: ["not_started", "pending", "approved", "rejected"] },
            document_type: { type: "string" },
            submitted_at: { type: "string", format: "date-time" },
            reviewed_at: { type: "string", format: "date-time" },
            rejection_reason: { type: "string" },
          },
        },
        // Pagination Schema
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        // Subscription Schema
        Subscription: {
          type: "object",
          properties: {
            subscription_id: { type: "integer" },
            customer_email: { type: "string" },
            customer_name: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string" },
            interval: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
            status: { type: "string", enum: ["active", "paused", "cancelled", "expired"] },
            description: { type: "string" },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            next_billing_date: { type: "string", format: "date" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // API Plan Schema
        ApiPlan: {
          type: "object",
          properties: {
            plan_id: { type: "integer" },
            plan_name: { type: "string" },
            description: { type: "string" },
            rate_limit: { type: "integer" },
            price: { type: "number" },
            currency: { type: "string" },
            features: { type: "array", items: { type: "string" } },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Referral Schemas
        Referral: {
          type: "object",
          properties: {
            referral_id: { type: "integer" },
            referrer_user_id: { type: "integer" },
            referred_user_id: { type: "integer" },
            referral_code: { type: "string", example: "DYNO2025USR8A2B3C4D5" },
            status: { type: "string", enum: ["pending", "active", "rewarded", "expired"] },
            bonus_amount: { type: "number", example: 10.00 },
            bonus_currency: { type: "string", example: "USD" },
            referee_discount_percent: { type: "number", example: 50.00 },
            referee_discount_duration_days: { type: "integer", example: 30 },
            referred_at: { type: "string", format: "date-time" },
            activated_at: { type: "string", format: "date-time" },
            rewarded_at: { type: "string", format: "date-time" },
            expires_at: { type: "string", format: "date-time" },
            referred_user: {
              type: "object",
              properties: {
                user_id: { type: "integer" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        ReferralReward: {
          type: "object",
          properties: {
            reward_id: { type: "integer" },
            referral_id: { type: "integer" },
            user_id: { type: "integer" },
            reward_type: { type: "string", example: "bonus_credit" },
            amount: { type: "number", example: 10.00 },
            currency: { type: "string", example: "USD" },
            status: { type: "string", enum: ["pending", "credited", "withdrawn"] },
            credited_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // Knowledge Base Schemas
        KBCategory: {
          type: "object",
          properties: {
            category_id: { type: "integer" },
            category_name: { type: "string", example: "Getting Started" },
            category_slug: { type: "string", example: "getting-started" },
            category_icon: { type: "string", example: "rocket" },
            description: { type: "string" },
            article_count: { type: "integer" },
            display_order: { type: "integer" },
            is_active: { type: "boolean" },
          },
        },
        KBArticle: {
          type: "object",
          properties: {
            article_id: { type: "integer" },
            category_id: { type: "integer" },
            title: { type: "string", example: "How to Accept Crypto Payments" },
            slug: { type: "string", example: "how-to-accept-crypto-payments" },
            excerpt: { type: "string" },
            content: { type: "string" },
            content_html: { type: "string" },
            author_id: { type: "integer" },
            featured_image_url: { type: "string", format: "uri" },
            meta_title: { type: "string" },
            meta_description: { type: "string" },
            meta_keywords: { type: "string" },
            is_published: { type: "boolean" },
            views_count: { type: "integer" },
            helpful_count: { type: "integer" },
            not_helpful_count: { type: "integer" },
            reading_time_minutes: { type: "integer", example: 5 },
            published_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
            category: { $ref: "#/components/schemas/KBCategory" },
            author: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths: allPaths,
    tags: [
      // === AUTHENTICATION & USER ===
      { name: "Authentication", description: "User login, registration, email verification, and password management. Email verification (POST /api/user/verify-email) is required before accessing company, wallet, and dashboard features." },
      { name: "User Management", description: "User profile, settings, and account management" },
      
      // === MERCHANT SETUP ===
      { name: "Company", description: "Company profile and business configuration. ⚠️ Requires verified email." },
      { name: "Wallet Address Management", description: "Crypto wallet configuration (requires OTP for changes). ⚠️ Requires verified email." },
      { name: "API Keys", description: "API key management for server-to-server integration" },
      { name: "KYC Verification", description: "Identity verification with Veriff" },
      
      // === PAYMENTS ===
      { name: "Payments", description: "Payment link creation, management, and configuration" },
      { name: "Payment Processing", description: "Checkout flow: getData, currency selection, crypto payment" },
      { name: "Direct API - Merchant Integration", description: `Server-to-server API for programmatic payments.

**Flow:** Create API Key → Create Customer → Generate Payment → Receive Webhook

**Authentication:** x-api-key header + customer Bearer token` },
      
      // === TRANSACTIONS & REPORTS ===
      { name: "Transactions", description: "Transaction history and export" },
      { name: "Dashboard", description: "Analytics and statistics. ⚠️ Requires verified email." },
      { name: "Invoices", description: "Transaction invoices and PDF generation" },
      { name: "Subscriptions", description: "Recurring payment management" },
      { name: "Auto-Stablecoin Conversion", description: `Automatic conversion of volatile crypto (BTC, ETH, SOL, etc.) to stablecoins (USDT/USDC) via Binance.

**Flow:** Payment received in volatile crypto → Redirected to admin wallet (Binance deposit) → Binance Convert API → Stablecoin withdrawn to merchant's settlement wallet.

**Statuses:** PENDING_DEPOSIT → DEPOSIT_CREDITED → CONVERTING → CONVERTED → WITHDRAWING → COMPLETED

**Note:** Stablecoin payments (USDT, USDC, RLUSD) are NOT converted — they go directly to the merchant wallet.` },
      
      // === INTEGRATIONS ===
      { name: "Webhooks", description: `Webhook configuration and delivery.

**Events:** payment.confirmed, payment.pending, payment.underpaid, payment.overpaid` },
      { name: "Tax", description: "Tax rates and country-based calculations" },
      { name: "Notifications", description: "In-app and email notification management" },
      
      // === PLATFORM ===
      { name: "Status", description: "System health and infrastructure monitoring" },
      { name: "Knowledge Base", description: "Help articles and documentation" },
      { name: "Admin", description: "Platform administration (super-admin only)" },
      { name: "Security", description: "Two-Factor Authentication (2FA), session management, CSRF tokens, and account lockout" },
      { name: "Real-Time Events", description: "Server-Sent Events (SSE) for live payment, price, and notification updates" },
      
      // === REFERRALS ===
      { name: "Referral - User Code", description: "User referral codes (DYNO format)" },
      { name: "Referral - Referee Code", description: "Payment link referee codes (REF format)" },
      { name: "Referral - Fee Discount", description: "Fee discount from referral program" },
      
      // === MISC ===
      { name: "Email Unsubscribe", description: "Email unsubscribe (no auth)" },
    ],
  },
  apis: ["./swagger/paths/*.ts", "./routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Serve Swagger UI with enhanced search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { max-width: 100%; }
      .swagger-ui .info .description { line-height: 1.6; }
      .swagger-ui .info h2 { margin-top: 30px; color: #3b4151; }
      .swagger-ui .info h3 { margin-top: 20px; color: #555; }
      .swagger-ui .info code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    `,
    customSiteTitle: "Dynopay API Documentation",
    swaggerOptions: {
      persistAuthorization: true, // Keep authorization token on page refresh
      filter: true, // Enable filter/search box
      displayOperationId: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 3,
      docExpansion: 'list', // Show endpoints collapsed by default
      tryItOutEnabled: true,
    },
  }));

  // Serve raw OpenAPI spec
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  log("Swagger documentation available at /api/docs", "info");
};

export default swaggerSpec;
