export const webhookPaths = {
  '/api/webhooks': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Documentation',
      description: `# Webhook Events & Payloads

Dynopay sends webhook notifications to your configured URL when payment events occur.

---

## ⚠️ IMPORTANT: Webhook Endpoint Requirements

### Your Endpoint MUST Be Publicly Accessible

| URL Type | Works? | Notes |
|----------|:------:|-------|
| \`https://yourapp.com/webhook\` | ✅ | Recommended for production |
| \`https://abc123.ngrok.io/webhook\` | ✅ | Great for development/testing |
| \`http://localhost:8000/webhook\` | ❌ | Dynopay servers cannot reach your localhost |
| \`http://127.0.0.1:3000/webhook\` | ❌ | Same as localhost |
| \`http://192.168.x.x/webhook\` | ❌ | Private IPs are not routable |

### Your Endpoint MUST NOT Require Authentication

**Common 400 Error:** \`"No API key provided"\` or similar authentication errors.

Dynopay sends webhooks from our servers - we don't have your API keys. Your webhook endpoint must accept unauthenticated POST requests.

❌ **Wrong:**
\`\`\`javascript
// This will fail - Dynopay doesn't have your API key
app.post('/webhook', requireApiKey, handler);
\`\`\`

✅ **Correct:**
\`\`\`javascript
// No auth middleware - verify using signature instead
app.post('/dynopay-webhook', (req, res) => {
  // Optional: Verify X-DynoPay-Signature header
  const signature = req.headers['x-dynopay-signature'];
  // Process webhook...
  res.status(200).send('OK');
});
\`\`\`

### Your Endpoint MUST Respond Quickly

- Return \`200 OK\` within **10 seconds**
- Process webhooks asynchronously if needed
- We retry 3 times with exponential backoff (1s, 2s, 4s)

### Testing During Development

Use [ngrok](https://ngrok.com) to expose your local server:
\`\`\`bash
ngrok http 8000
# Use the https://xxx.ngrok.io URL in Dynopay
\`\`\`

---

## 🎯 Payment Types That Trigger Webhooks

Webhooks are sent for **ALL crypto payment types**:

| Payment Type | API Endpoint | Webhook Triggered |
|-------------|--------------|-------------------|
| **Payment Links** | \`POST /api/pay/createPaymentLink\` | ✅ Yes |
| **Direct API Payments** | \`POST /api/user/cryptoPayment\` | ✅ Yes |

### Field Availability by Payment Type

| Field | Payment Link | Direct API | Notes |
|-------|:------------:|:----------:|-------|
| \`payment_id\` | ✅ | ✅ | Always present |
| \`amount\` / \`currency\` | ✅ | ✅ | Crypto amount received |
| \`base_amount\` / \`base_currency\` | ✅ | ✅ | Original fiat amount |
| \`merchant_amount\` | ✅ | ✅ | Net amount after fees |
| \`total_fee\` / \`total_fee_usd\` | ✅ | ✅ | Fees charged |
| \`fee_payer\` | ✅ | ✅ | "customer" or "company" |
| \`link_id\` | ✅ | ❌ | Only for Payment Links |
| \`description\` | ✅ | ✅ | If provided during creation |
| \`customer_name\` | ✅ | ✅ | If provided during creation |
| \`customer_email\` | ✅ | ✅ | Required for Payment Links |
| \`tax_info\` | ✅ | ✅ | If tax enabled |
| \`meta_data\` | ✅ | ✅ | Custom data you passed |

---

## 📌 How to Configure Webhooks

### For Payment Links
Set \`webhook_url\` when creating a payment link:
\`\`\`json
POST /api/pay/createPaymentLink
{
  "amount": 100,
  "currency": "USD",
  "modes": ["CRYPTO"],
  "email": "customer@example.com",
  "customer_name": "John Doe",
  "description": "Order #12345",
  "webhook_url": "https://yourapp.com/webhooks/dynopay",
  "meta_data": { "order_id": "12345" }
}
\`\`\`

### For Direct API Payments
Set \`webhook_url\` when creating a crypto payment:
\`\`\`json
POST /api/user/cryptoPayment
{
  "amount": 100,
  "currency": "ETH",
  "customer_name": "John Doe",
  "description": "API Payment",
  "webhook_url": "https://yourapp.com/webhooks/dynopay",
  "meta_data": { "invoice_id": "INV-001" }
}
\`\`\`

### Company Default (Fallback)
Set default webhook URL for all payments without explicit webhook_url:
\`\`\`json
PUT /api/company/webhook-settings/{company_id}
{
  "webhook_url": "https://yourapp.com/webhooks/dynopay",
  "webhook_secret": "generate"
}
\`\`\`

**Priority Order:** Payment-specific \`webhook_url\` → Company default \`webhook_url\`

---

## 🔒 Webhook Security

All webhooks include these headers for verification:

| Header | Description |
|--------|-------------|
| \`X-Dynopay-Event\` | Event type (e.g., \`payment.confirmed\`) |
| \`X-DynoPay-Signature\` | **(v1, legacy)** HMAC-SHA256 of a re-serialised body. Kept for backward compatibility — prefer v2 below. |
| \`X-Dynopay-Signature-V2\` | **(v2, recommended)** \`t=<unix>,v1=<hex>\` where the hex is \`HMAC-SHA256(secret, "<t>.<rawBody>")\` over the **exact raw request body**. Sent only when a webhook secret is configured. |
| \`X-Dynopay-Timestamp\` | Unix timestamp of the request |
| \`X-Dynopay-Webhook-Id\` | Unique delivery ID for idempotency |
| \`X-Dynopay-Type\` | \`"payment_link"\` or \`"direct_api"\` |

### Verifying signatures (v2 — recommended)
Sign the **raw request body bytes** you receive — do not re-serialise the parsed JSON. Reject if the timestamp is more than **±300s** from now (replay protection).

\`\`\`javascript
const crypto = require('crypto');

// Express: capture the raw body — app.use(express.json({ verify: (req,_res,buf)=>{ req.rawBody = buf } }))
function verifyWebhookV2(rawBody, headerV2, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(String(headerV2).split(',').map(kv => kv.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false; // stale/replayed
  const expected = crypto.createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex');
  const got = Buffer.from(parts.v1 || '', 'hex');
  const exp = Buffer.from(expected, 'hex');
  return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}
\`\`\`

\`\`\`python
import hmac, hashlib, time

def verify_webhook_v2(raw_body: bytes, header_v2: str, secret: str, tolerance=300) -> bool:
    parts = dict(p.split("=", 1) for p in header_v2.split(","))
    t = int(parts.get("t", 0))
    if not t or abs(time.time() - t) > tolerance:
        return False
    signed = f"{t}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))
\`\`\`

### Verifying signatures (v1 — legacy)
\`\`\`javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

---

## 📨 Webhook Events

Dynopay sends these webhook events for **both Payment Links and Direct API Payments**:

| Event | Description | Triggered For |
|-------|-------------|---------------|
| \`payment.pending\` | Payment detected on blockchain, awaiting confirmations | Payment Links ✅, Direct API ✅ |
| \`payment.confirmed\` | Payment fully confirmed and processed | Payment Links ✅, Direct API ✅ |
| \`payment.created\` | **Opt-in.** A checkout was created and an address issued — nothing paid yet | Payment Links ✅, Direct API ✅ |
| \`payment.expired\` | **Opt-in.** A payment link passed \`expires_at\` unpaid | Payment Links ✅ |
| \`payment.overpaid\` | **Opt-in.** Customer sent more than requested (above your overpayment threshold) | Payment Links ✅, Direct API ✅ |
| \`payment.underpaid\` | Partial payment received | Payment Links ✅ (waits for remainder), Direct API ✅ (informational only — processed immediately) |

---

## 📦 Webhook Payloads

See the response examples below for detailed payload structures.

**Note:** Examples show Payment Link webhooks. Direct API webhooks have the same structure but \`link_id\` will be \`null\`.`,
      responses: {
        200: {
          description: 'Webhook payload examples',
          content: {
            'application/json': {
              examples: {
                'payment_link_pending': {
                  summary: '🟡 PAYMENT LINK: payment.pending',
                  description: 'Sent when a crypto transaction is detected for a Payment Link',
                  value: {
                    event: 'payment.pending',
                    payment_type: 'payment_link',
                    address: '0x1234567890abcdef1234567890abcdef12345678',
                    txId: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
                    amount: 0.042,
                    currency: 'ETH',
                    payment_id: 'pay_7668e15b-7f61-4bab-b123-abc123def456',
                    status: 'pending',
                    base_amount: 100,
                    base_currency: 'USD',
                    customer_name: 'John Doe',
                    customer_email: 'john@example.com',
                    description: 'Order #12345 - Premium Subscription',
                    link_id: 411,
                    fee_payer: 'company',
                    timestamp: '2026-02-04T13:02:27.843Z'
                  }
                },
                'payment_link_confirmed': {
                  summary: '✅ PAYMENT LINK: payment.confirmed',
                  description: 'Sent when a Payment Link payment is fully confirmed. Use link_id to match with your order.',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_7668e15b-7f61-4bab-b123-abc123def456',
                    transaction_reference: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
                    status: 'processing',
                    amount: 0.042,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 0.0399,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'company',
                    customer_name: 'John Doe',
                    customer_email: 'john@example.com',
                    description: 'Order #12345 - Premium Subscription',
                    link_id: 411,
                    tax_info: null,
                    overpayment: null,
                    meta_data: {
                      order_id: '12345',
                      customer_ref: 'CUST-001'
                    },
                    completed_at: '2026-02-04T13:02:37.960Z'
                  }
                },
                'direct_api_pending': {
                  summary: '🟡 DIRECT API: payment.pending',
                  description: 'Sent when a crypto transaction is detected for a Direct API Payment (cryptoPayment endpoint)',
                  value: {
                    event: 'payment.pending',
                    payment_type: 'direct_api',
                    address: '0xabcdef1234567890abcdef1234567890abcdef12',
                    txId: '0x789xyz123456789012345678901234567890abcdef1234567890abcdef789xyz',
                    amount: 0.015,
                    currency: 'BTC',
                    payment_id: 'pay_direct-api-1234-5678-abcd-ef0123456789',
                    status: 'pending',
                    base_amount: 500,
                    base_currency: 'USD',
                    customer_name: 'API Customer',
                    customer_email: 'api-customer@example.com',
                    description: 'Invoice INV-2024-001',
                    link_id: null,
                    fee_payer: 'customer',
                    timestamp: '2026-02-04T14:30:00.000Z'
                  }
                },
                'direct_api_confirmed': {
                  summary: '✅ DIRECT API: payment.confirmed',
                  description: 'Sent when a Direct API Payment is fully confirmed. Note: link_id is null for API payments.',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'direct_api',
                    payment_id: 'pay_direct-api-1234-5678-abcd-ef0123456789',
                    transaction_reference: '0x789xyz123456789012345678901234567890abcdef1234567890abcdef789xyz',
                    status: 'processing',
                    amount: 0.015,
                    currency: 'BTC',
                    base_amount: 500,
                    base_currency: 'USD',
                    merchant_amount: 0.01425,
                    total_fee: 0.00075,
                    total_fee_usd: 25.00,
                    fee_payer: 'customer',
                    customer_name: 'API Customer',
                    customer_email: 'api-customer@example.com',
                    description: 'Invoice INV-2024-001',
                    link_id: null,
                    tax_info: null,
                    overpayment: null,
                    meta_data: {
                      invoice_id: 'INV-2024-001',
                      customer_id: 'CUST-789'
                    },
                    completed_at: '2026-02-04T14:35:00.000Z'
                  }
                },
                'payment_link_with_tax': {
                  summary: '✅ PAYMENT LINK: With Tax Applied (EU VAT)',
                  description: 'Example when tax was applied to a Payment Link payment (e.g., EU VAT)',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_8899aabb-ccdd-eeff-0011-223344556677',
                    transaction_reference: '0xdef789...',
                    status: 'processing',
                    amount: 0.052,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'EUR',
                    merchant_amount: 0.0399,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'customer',
                    customer_name: 'Maria Silva',
                    customer_email: 'maria@example.pt',
                    description: 'Subscription Payment',
                    link_id: 422,
                    tax_info: {
                      tax_amount_usd: 23.00,
                      tax_amount_crypto: 0.0097,
                      tax_rate: 23,
                      tax_country_code: 'PT'
                    },
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T14:15:00.000Z'
                  }
                },
                'payment_link_overpaid': {
                  summary: '✅ PAYMENT LINK: Customer Overpaid',
                  description: 'Example when customer sent more crypto than required for a Payment Link',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_1122aabb-ccdd-eeff-0011-223344556677',
                    transaction_reference: '0xghi012...',
                    status: 'processing',
                    amount: 0.055,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 0.0499,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'company',
                    customer_name: 'Bob Wilson',
                    customer_email: 'bob@example.com',
                    description: 'One-time Purchase',
                    link_id: 433,
                    tax_info: null,
                    overpayment: {
                      amount_crypto: 0.003,
                      amount_usd: 7.50
                    },
                    meta_data: null,
                    completed_at: '2026-02-04T15:30:00.000Z'
                  }
                },
                'payment_link_underpaid': {
                  summary: '⚠️ PAYMENT LINK: Partial Payment (Underpaid)',
                  description: 'Sent when customer sends less than required for a Payment Link. Grace period (up to 30 min, configurable per company) to complete.',
                  value: {
                    event: 'payment.underpaid',
                    payment_type: 'payment_link',
                    address: '0x1234567890abcdef1234567890abcdef12345678',
                    txId: '0xpartial123...',
                    amount_received: 0.030,
                    amount_expected: 0.042,
                    amount_remaining: 0.012,
                    currency: 'ETH',
                    payment_id: 'pay_underpaid-1234-5678-abcd-ef0123456789',
                    status: 'underpaid',
                    base_amount: 100,
                    base_currency: 'USD',
                    customer_name: 'Jane Smith',
                    customer_email: 'jane@example.com',
                    description: 'Monthly Plan',
                    link_id: 444,
                    fee_payer: 'company',
                    grace_period_minutes: 30,
                    timestamp: '2026-02-04T16:00:00.000Z'
                  }
                },
                'direct_api_underpaid': {
                  summary: '⚠️ DIRECT API: Underpaid (Informational — processed immediately)',
                  description: 'Sent when customer sends less than required for a Direct API Payment. This is INFORMATIONAL ONLY — the payment is processed immediately with whatever was received. No grace period, no waiting. A payment.confirmed webhook follows shortly after.',
                  value: {
                    event: 'payment.underpaid',
                    payment_type: 'direct_api',
                    address: '0xabcdef1234567890abcdef1234567890abcdef12',
                    txId: '0xpartial789...',
                    amount_received: 0.010,
                    amount_expected: 0.015,
                    amount_remaining: 0.005,
                    currency: 'BTC',
                    payment_id: 'pay_api-underpaid-5678-abcd-ef0123456789',
                    status: 'underpaid',
                    base_amount: 500,
                    base_currency: 'USD',
                    customer_name: 'API Customer',
                    customer_email: 'api@example.com',
                    description: 'Invoice Payment',
                    link_id: null,
                    fee_payer: 'customer',
                    note: 'Direct API: processing with actual received amount',
                    timestamp: '2026-02-04T16:30:00.000Z'
                  }
                },
                'xrp_payment_confirmed': {
                  summary: '✅ XRP PAYMENT: With Destination Tag',
                  description: 'XRP/RLUSD payments include destination_tag in the webhook payload. This tag is critical for identifying which payment the funds belong to, as XRP uses a shared master address.',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_xrp-1234-5678-abcd-ef0123456789',
                    transaction_reference: 'ABC123DEF456789012345678901234567890ABCDEF1234567890ABCDEF123456',
                    status: 'processing',
                    amount: 42.5,
                    currency: 'XRP',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 41.5,
                    total_fee: 1.0,
                    total_fee_usd: 2.35,
                    fee_payer: 'company',
                    customer_name: 'XRP Customer',
                    customer_email: 'xrp@example.com',
                    description: 'XRP Payment',
                    link_id: 555,
                    destination_tag: 847291,
                    address: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
                    network: 'XRP Ledger',
                    tax_info: null,
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T17:00:00.000Z'
                  }
                },
                'rlusd_payment_confirmed': {
                  summary: '✅ RLUSD PAYMENT: Ripple USD on XRP Ledger',
                  description: 'RLUSD payments on XRP Ledger also include destination_tag.',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_rlusd-9876-5432-dcba-fedcba987654',
                    transaction_reference: 'DEF789ABC123456789012345678901234567890ABCDEF',
                    status: 'processing',
                    amount: 100.0,
                    currency: 'RLUSD',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 97.5,
                    total_fee: 2.5,
                    total_fee_usd: 2.5,
                    fee_payer: 'company',
                    customer_name: 'RLUSD Customer',
                    customer_email: 'rlusd@example.com',
                    description: 'RLUSD Stablecoin Payment',
                    link_id: 556,
                    destination_tag: 123456,
                    address: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
                    network: 'XRP Ledger',
                    tax_info: null,
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T17:15:00.000Z'
                  }
                },
                'sol_payment_confirmed': {
                  summary: '✅ SOL PAYMENT: Solana',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_sol-aaaa-bbbb-cccc-ddddeeeefffff',
                    transaction_reference: '5xKp...7mZq',
                    status: 'processing',
                    amount: 0.667,
                    currency: 'SOL',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 0.647,
                    total_fee: 0.02,
                    total_fee_usd: 3.00,
                    fee_payer: 'company',
                    customer_name: 'SOL Customer',
                    customer_email: 'sol@example.com',
                    description: 'SOL Payment',
                    link_id: 557,
                    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                    network: 'Solana',
                    tax_info: null,
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T17:30:00.000Z'
                  }
                },
                'polygon_payment_confirmed': {
                  summary: '✅ POLYGON PAYMENT: POL on Polygon',
                  value: {
                    event: 'payment.confirmed',
                    payment_type: 'payment_link',
                    payment_id: 'pay_pol-1111-2222-3333-444455556666',
                    transaction_reference: '0xpol123...',
                    status: 'processing',
                    amount: 250.5,
                    currency: 'POLYGON',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 245.5,
                    total_fee: 5.0,
                    total_fee_usd: 2.00,
                    fee_payer: 'company',
                    customer_name: 'Polygon Customer',
                    customer_email: 'polygon@example.com',
                    description: 'Polygon Payment',
                    link_id: 558,
                    address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
                    network: 'Polygon',
                    tax_info: null,
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T17:45:00.000Z'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/webhooks/fields': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Field Reference',
      description: `# Webhook Field Reference

Complete reference of all fields included in webhook payloads.

---

## Core Fields (All Events)

| Field | Type | Description |
|-------|------|-------------|
| \`event\` | string | Event type: \`payment.pending\`, \`payment.confirmed\`, \`payment.underpaid\` |
| \`payment_id\` | string | Unique payment identifier |
| \`status\` | string | Current payment status |
| \`amount\` | number | Amount in cryptocurrency |
| \`currency\` | string | Cryptocurrency code (ETH, BTC, etc.) |
| \`timestamp\` / \`completed_at\` | string | ISO 8601 timestamp |

---

## Enhanced Fields (Added Feb 2026)

These fields provide complete transaction visibility for accounting and reconciliation:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| \`merchant_amount\` | number | Net amount merchant receives (crypto) | \`0.0399\` |
| \`total_fee\` | number | Total fees deducted (crypto) | \`0.0021\` |
| \`total_fee_usd\` | number | Total fees in USD | \`5.00\` |
| \`fee_payer\` | string | Who paid fees: \`"customer"\` or \`"company"\` | \`"company"\` |
| \`customer_name\` | string\\|null | Customer name (if provided) | \`"John Doe"\` |
| \`customer_email\` | string\\|null | Customer email | \`"john@example.com"\` |
| \`description\` | string\\|null | Payment description | \`"Order #12345"\` |
| \`link_id\` | number\\|null | Payment link ID | \`411\` |
| \`base_amount\` | number | Original amount in fiat | \`100\` |
| \`base_currency\` | string | Fiat currency code | \`"USD"\` |

---

## Conditional Fields

### destination_tag (number | null) — XRP/RLUSD Only
Present for XRP and RLUSD payments. **Critical for payment identification.**

| Field | Type | Description |
|-------|------|-------------|
| \`destination_tag\` | number | Unique tag identifying this specific payment on the shared XRP master address |
| \`address\` | string | Shared master XRP address |
| \`network\` | string | "XRP Ledger" |

⚠️ **Important:** XRP and RLUSD use a shared master address with unique destination tags per payment. Always match payments by \`destination_tag\`, not just \`address\`.

### tax_info (object | null)
Present when tax was applied to the payment:

| Field | Type | Description |
|-------|------|-------------|
| \`tax_amount_usd\` | number | Tax amount in USD |
| \`tax_amount_crypto\` | number | Tax amount in cryptocurrency |
| \`tax_rate\` | number | Tax percentage (e.g., 23 for 23%) |
| \`tax_country_code\` | string | ISO country code (e.g., "PT") |

### overpayment (object | null)
Present when customer sent more than required:

| Field | Type | Description |
|-------|------|-------------|
| \`amount_crypto\` | number | Overpayment amount in crypto |
| \`amount_usd\` | number | Overpayment amount in USD |

### meta_data (object | null)
Custom metadata passed when creating the payment link.

---

## Underpaid-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| \`amount_received\` | number | Amount received so far (crypto) |
| \`amount_expected\` | number | Total amount expected (crypto) |
| \`amount_remaining\` | number | Remaining amount needed (crypto) |
| \`grace_period_minutes\` | number | Minutes left to complete payment (**Payment Links only**) |
| \`note\` | string | Processing note (**Direct API only** — e.g., "processing with actual received amount") |

### ⚠️ Important: Payment Link vs Direct API Underpayments

| Behavior | Payment Links | Direct API |
|----------|:------------:|:----------:|
| Grace period | ✅ Waits for remainder (up to 30 min, configurable per company) | ❌ No waiting — processed immediately |
| \`grace_period_minutes\` field | ✅ Present | ❌ Not present |
| Underpayment threshold | ✅ Minor underpayments accepted as full (configurable per company) | ❌ All underpayments processed as-is |
| Overpayment threshold | ✅ Excess detected and reported (configurable per company) | ❌ Full amount processed to merchant |
| Webhook meaning | Action needed: customer has time to send remainder | Informational only: \`payment.confirmed\` follows immediately |`,
      responses: {
        200: {
          description: 'Field reference documentation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'See description for field reference' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/webhooks/integration-guide': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Integration Guide',
      description: `# Webhook Integration Guide

Step-by-step guide to integrate Dynopay webhooks into your application.

---

## 1️⃣ Create a Webhook Endpoint

\`\`\`javascript
// Express.js example
app.post('/webhooks/dynopay', express.json(), (req, res) => {
  const event = req.headers['x-dynopay-event'];
  const signature = req.headers['x-dynopay-signature'];
  const payload = req.body;

  // Verify signature (recommended)
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Handle events
  switch (event) {
    case 'payment.pending':
      console.log('Payment pending:', payload.payment_id);
      // Update order status to "processing"
      break;

    case 'payment.confirmed':
      console.log('Payment confirmed:', payload.payment_id);
      console.log('Merchant receives:', payload.merchant_amount, payload.currency);
      console.log('Fee charged:', payload.total_fee_usd, 'USD');
      // Fulfill order, send confirmation email
      break;

    case 'payment.underpaid':
      console.log('Underpaid:', payload.amount_remaining, 'remaining');
      // Notify customer to send remaining amount
      break;
  }

  // Always respond 200 to acknowledge receipt
  res.status(200).send('OK');
});
\`\`\`

---

## 2️⃣ Configure Your Webhook URL

### Via API (Recommended for automation)
\`\`\`bash
curl -X PUT "https://dynopay.com/api/company/webhook-settings/YOUR_COMPANY_ID" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "webhook_url": "https://yourapp.com/webhooks/dynopay",
    "webhook_secret": "generate"
  }'
\`\`\`

### Via Dashboard
1. Go to Settings → Webhooks
2. Enter your webhook URL
3. Click "Generate Secret" for signature verification
4. Save settings

---

## 3️⃣ Handle Order Fulfillment

\`\`\`javascript
async function handlePaymentConfirmed(payload) {
  const {
    payment_id,
    merchant_amount,
    total_fee_usd,
    customer_name,
    customer_email,
    description,
    link_id,
    meta_data
  } = payload;

  // 1. Find the order using link_id or meta_data
  const order = await Order.findOne({
    where: { payment_link_id: link_id }
  });

  // 2. Update order with payment details
  await order.update({
    status: 'paid',
    payment_id: payment_id,
    amount_received: merchant_amount,
    fee_charged: total_fee_usd,
    paid_at: new Date()
  });

  // 3. Send confirmation email
  await sendEmail({
    to: customer_email,
    subject: 'Payment Confirmed',
    body: \`Hi \${customer_name}, your payment for \${description} is confirmed!\`
  });

  // 4. Trigger fulfillment
  await fulfillOrder(order.id);
}
\`\`\`

---

## 4️⃣ Best Practices

### Idempotency
Use \`X-Dynopay-Webhook-Id\` to prevent duplicate processing:

\`\`\`javascript
const processedWebhooks = new Set();

app.post('/webhooks/dynopay', (req, res) => {
  const webhookId = req.headers['x-dynopay-webhook-id'];
  
  if (processedWebhooks.has(webhookId)) {
    return res.status(200).send('Already processed');
  }
  
  processedWebhooks.add(webhookId);
  // Process webhook...
});
\`\`\`

### Async Processing
For long operations, respond quickly and process async:

\`\`\`javascript
app.post('/webhooks/dynopay', (req, res) => {
  // Respond immediately
  res.status(200).send('OK');
  
  // Process in background
  processWebhookAsync(req.body).catch(console.error);
});
\`\`\`

### Retry Handling
Dynopay retries failed webhooks with exponential backoff:
- Retry 1: 1 minute
- Retry 2: 5 minutes  
- Retry 3: 30 minutes
- Retry 4: 2 hours
- Retry 5: 24 hours

Always respond with 2xx status to acknowledge receipt.

---

## 🔧 Troubleshooting

### Common Errors & Solutions

| HTTP Status | Error Message | Cause | Solution |
|:-----------:|--------------|-------|----------|
| **N/A** | Connection refused | Dynopay can't reach your server | Use a public URL, not localhost |
| **N/A** | Connection timed out | Server too slow | Respond within 10 seconds |
| **400** | "No API key provided" | Your endpoint requires auth | Remove auth from webhook endpoint |
| **400** | "Invalid request body" | Payload parsing issue | Check Content-Type is application/json |
| **401** | Unauthorized | Your endpoint requires auth | Remove auth from webhook endpoint |
| **403** | Forbidden | Firewall blocking request | Whitelist Dynopay IPs |
| **404** | Not Found | Wrong endpoint path | Verify your webhook URL path |
| **500** | Internal Server Error | Bug in your handler | Check your server logs |

### Quick Checklist

✅ URL is publicly accessible (not localhost)  
✅ Using HTTPS (not HTTP)  
✅ Endpoint accepts POST without authentication  
✅ Endpoint responds with 200 OK  
✅ Response time < 10 seconds  
✅ Handling JSON body (not form data)  

### Test Your Endpoint

\`\`\`bash
# Test from your terminal
curl -X POST "https://your-webhook-url.com/webhook" \\
  -H "Content-Type: application/json" \\
  -H "X-Dynopay-Event: test" \\
  -d '{"event":"test","payment_id":"test-123"}'

# Should return: 200 OK
\`\`\``,
      responses: {
        200: {
          description: 'Integration guide',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'See description for integration guide' }
                }
              }
            }
          }
        }
      }
    }
  }
};
