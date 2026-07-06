# Dynopay API - Developer Integration Guide

Welcome to the Dynopay API! This guide will help you integrate crypto payments and customer wallet management into your application.

## Table of Contents
- [Quick Start](#quick-start)
- [Userless Payment (Simplified)](#userless-payment-simplified)
- [Common Integration Patterns](#common-integration-patterns)
- [Customer Wallet System](#customer-wallet-system)
- [Best Practices](#best-practices)
- [FAQ](#faq)

---

## Quick Start

### 1. Get Your API Key
1. Log in to your Dynopay dashboard
2. Navigate to the **API** section
3. Click **"Create New Key"**
4. Save your API key securely (it won't be shown again!)

### 2. Make Your First Payment (No Customer Setup Required!)

With **Userless Payment**, you can create payments using just your API key — no customer creation step needed:

```bash
curl -X POST https://api.dynopay.com/api/user/createPayment \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "redirect_uri": "https://yoursite.com/thank-you"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "https://checkout.dynopay.com/pay?d=abc123...",
    "fee_payer": "company",
    "available_currencies": ["BTC", "ETH", "USDT-TRC20", "LTC"]
  }
}
```

**Redirect your customer to `redirect_url`** to complete the payment!

> **Note**: If you need to track customers individually (for wallets, transaction history, etc.), see the [Customer-Based Flow](#customer-based-flow-advanced) below.

---

## Userless Payment (Simplified)

**Userless Payment** is the fastest way to accept crypto payments. You only need your API key — no customer accounts, no tokens, no extra steps.

### How It Works
1. You send a payment request with just your `x-api-key` header
2. Dynopay automatically handles customer context internally
3. You get back a payment address, QR code, or checkout URL immediately

### Authentication
All userless endpoints require only one header:
```
x-api-key: your_api_key
```

No `Authorization: Bearer <token>` header is needed. If you do include a customer token, Dynopay will use that customer's context instead (backward compatible).

### Userless Checkout Payment

Create a hosted checkout page where your customer selects their preferred crypto:

```bash
curl -X POST https://api.dynopay.com/api/user/createPayment \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25.00,
    "redirect_uri": "https://yoursite.com/order/success",
    "webhook_url": "https://yoursite.com/webhooks/dynopay",
    "meta_data": { "order_id": "ORD-456" }
  }'
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Payment amount (minimum 5) in your base currency |
| `redirect_uri` | string | Yes | URL to redirect customer after payment |
| `webhook_url` | string | No | URL to receive payment status webhooks |
| `meta_data` | object | No | Custom data attached to the payment |
| `fee_payer` | string | No | Who pays network fees: `"company"` (default) or `"customer"` |
| `accepted_currencies` | array | No | Limit accepted cryptos, e.g. `["BTC", "ETH"]` |
| `callback_url` | string | No | Alternative callback URL for status updates |

**Response:**
```json
{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "https://checkout.dynopay.com/pay?d=abc123...",
    "fee_payer": "company",
    "available_currencies": ["BTC", "ETH", "LTC", "USDT-TRC20"],
    "webhook_url": "configured"
  }
}
```

### Userless Direct Crypto Payment (QR Code)

Generate a QR code and wallet address for a specific cryptocurrency — ideal for embedding in your own UI:

```bash
curl -X POST https://api.dynopay.com/api/user/cryptoPayment \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15.00,
    "currency": "BTC",
    "redirect_uri": "https://yoursite.com/payment/success"
  }'
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Payment amount in your base currency |
| `currency` | string | Yes | Crypto to pay with: `BTC`, `ETH`, `LTC`, `DOGE`, `TRX`, `BCH`, `USDT-TRC20`, `USDT-ERC20`, `USDC-ERC20`, `SOL`, `XRP`, `RLUSD`, `RLUSD-ERC20`, `POLYGON`, `USDT-POLYGON` |
| `redirect_uri` | string | No | URL to redirect customer after payment |
| `webhook_url` | string | No | URL to receive payment status webhooks |
| `meta_data` | object | No | Custom data attached to the payment |
| `fee_payer` | string | No | `"company"` (default) or `"customer"` |
| `accepted_currencies` | array | No | Limit accepted cryptos |
| `callback_url` | string | No | Alternative callback URL |

**Response:**
```json
{
  "success": true,
  "message": "Payment Created!",
  "data": {
    "transaction_id": "a1b2c3d4-e5f6-...",
    "qr_code": "data:image/png;base64,...",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "amount": 0.000245,
    "currency": "BTC",
    "base_amount": 15.00,
    "base_currency": "USD",
    "redirect_uri": "https://yoursite.com/payment/success"
  }
}
```

> **XRP/RLUSD payments**: The response includes a `destination_tag` field. You **must** display this to the customer along with the address — it is required for the payment to be identified.

### Get Supported Currencies

Check which cryptocurrencies are configured for your account:

```bash
curl -X GET https://api.dynopay.com/api/user/getSupportedCurrency \
  -H "x-api-key: your_api_key"
```

**Response:**
```json
{
  "success": true,
  "message": "Supported currencies retrieved",
  "data": {
    "currencies": ["BTC", "ETH", "USDT-TRC20"],
    "all_supported": ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "SOL", "XRP", "RLUSD", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"]
  }
}
```

> `currencies` = cryptos you have wallet addresses configured for. `all_supported` = all cryptos Dynopay supports.

### Quick Integration Example (Node.js)

```javascript
const axios = require('axios');

// Simplest possible crypto checkout — just API key, amount, and redirect
async function createPayment(orderAmount, orderId) {
  const API_KEY = process.env.DYNOPAY_API_KEY;

  const res = await axios.post('https://api.dynopay.com/api/user/createPayment', {
    amount: orderAmount,
    redirect_uri: `https://yoursite.com/orders/${orderId}/success`,
    webhook_url: 'https://yoursite.com/webhooks/dynopay',
    meta_data: { order_id: orderId }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return res.data.data.redirect_url;
}
```

```python
# Python example
import requests

def create_payment(order_amount, order_id):
    API_KEY = os.environ['DYNOPAY_API_KEY']
    
    response = requests.post(
        'https://api.dynopay.com/api/user/createPayment',
        json={
            'amount': order_amount,
            'redirect_uri': f'https://yoursite.com/orders/{order_id}/success',
            'webhook_url': 'https://yoursite.com/webhooks/dynopay',
            'meta_data': {'order_id': order_id}
        },
        headers={'x-api-key': API_KEY}
    )
    
    return response.json()['data']['redirect_url']
```

---

## Customer-Based Flow (Advanced)

If you need per-customer tracking (wallet balances, individual transaction histories), you can optionally create customers and use their tokens. **This is fully backward compatible with the userless flow.**

### Create a Customer

```bash
curl -X POST https://api.dynopay.com/api/user/createUser \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Registered Successful!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "customer_id": "a1b2c3d4-e5f6-..."
  }
}
```

### Create Payment with Customer Token

```bash
curl -X POST https://api.dynopay.com/api/user/createPayment \
  -H "x-api-key: your_api_key" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "redirect_uri": "https://yoursite.com/thank-you"
  }'
```

> **Tip**: When you include a valid `Authorization: Bearer <token>` header, the payment is associated with that specific customer. Without it, Dynopay uses a default internal customer.

---

## Common Integration Patterns

### Pattern 1: E-commerce Checkout (Userless - Recommended)
**Use Case**: Customer buys a product on your website — simplest integration

```javascript
const axios = require('axios');

async function createCryptoCheckout(orderAmount, orderId) {
  const API_KEY = process.env.DYNOPAY_API_KEY;

  // Single API call — no customer creation needed!
  const paymentRes = await axios.post('https://api.dynopay.com/api/user/createPayment', {
    amount: orderAmount,
    redirect_uri: `https://yoursite.com/orders/${orderId}/success`,
    webhook_url: 'https://yoursite.com/webhooks/dynopay',
    meta_data: { order_id: orderId }
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  // Return checkout URL to redirect customer
  return paymentRes.data.data.redirect_url;
}
```

### Pattern 2: E-commerce Checkout (With Customer Tracking)
**Use Case**: Customer buys a product and you want per-customer history

```javascript
const axios = require('axios');

async function createCryptoCheckout(customerEmail, customerName, orderAmount, orderId) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  // Step 1: Create/get customer
  const customerRes = await axios.post(`${BASE_URL}/createUser`, {
    name: customerName,
    email: customerEmail
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  const customerToken = customerRes.data.data.token;

  // Step 2: Create checkout payment with customer context
  const paymentRes = await axios.post(`${BASE_URL}/createPayment`, {
    amount: orderAmount,
    redirect_uri: `https://yoursite.com/orders/${orderId}/success`,
    webhook_url: 'https://yoursite.com/webhooks/dynopay',
    meta_data: { order_id: orderId }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  return paymentRes.data.data.redirect_url;
}
```

### Pattern 3: In-App Wallet Top-Up
**Use Case**: Customer adds funds to their wallet balance

```javascript
async function topUpWallet(customerToken, amount) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  const res = await axios.post(`${BASE_URL}/addFunds`, {
    amount: amount,
    redirect_uri: 'https://yourapp.com/wallet',
    fee_payer: 'company' // You pay the fees
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  return res.data.data.redirect_url; // Redirect customer here
}
```

### Pattern 4: Direct Crypto Payment (QR Code) - Userless
**Use Case**: Show QR code in your app for crypto payment — no customer setup

```javascript
async function createDirectPayment(amount, crypto = 'BTC') {
  const API_KEY = process.env.DYNOPAY_API_KEY;

  const res = await axios.post('https://api.dynopay.com/api/user/cryptoPayment', {
    amount: amount,
    currency: crypto,
    redirect_uri: 'https://yourapp.com/payment/success'
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  // Display QR code and address in your app
  return {
    qrCode: res.data.data.qr_code,           // Base64 image
    address: res.data.data.address,           // Crypto address
    amount: res.data.data.amount,             // Amount in crypto
    currency: res.data.data.currency,         // e.g. "BTC"
    baseAmount: res.data.data.base_amount,    // Original fiat amount
    baseCurrency: res.data.data.base_currency,// e.g. "USD"
    transactionId: res.data.data.transaction_id,
    // For XRP/RLUSD only:
    destinationTag: res.data.data.destination_tag
  };
}
```

---

## Customer Wallet System

Dynopay provides a built-in wallet system where customers can store funds and you can programmatically manage their balances.

> **Note**: Wallet operations (addFunds, useWallet, getBalance) work in both userless mode and with customer tokens. In userless mode, a default internal customer is used. For per-customer wallet tracking, use the [Customer-Based Flow](#customer-based-flow-advanced) with individual customer tokens.

### Customer Wallet Flow
1. **Customer adds funds** → `POST /api/user/addFunds` (hosted checkout)
2. **Customer pays from wallet** → `POST /api/user/useWallet` (instant debit)
3. **Admin credits wallet** → `POST /api/admin/customers/:id/credit` (refunds, bonuses)
4. **Admin debits wallet** → `POST /api/admin/customers/:id/debit` (fees, subscriptions)

### Admin Wallet Management (Programmatic)

You can manage customer wallets via API for scenarios like:
- **Refunds**: Credit customer wallet when order is cancelled
- **Subscription fees**: Debit wallet monthly for recurring charges
- **Loyalty bonuses**: Credit wallet as rewards
- **Service fees**: Debit wallet for premium features

#### Credit Customer Wallet
```bash
curl -X POST https://api.dynopay.com/api/admin/customers/123/credit \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "description": "Refund for order #12345"
  }'
```

#### Debit Customer Wallet
```bash
curl -X POST https://api.dynopay.com/api/admin/customers/123/debit \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25.00,
    "description": "Monthly subscription fee"
  }'
```

### Example: Automated Refund System
```javascript
async function processRefund(customerId, orderAmount, orderNumber) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/admin';

  try {
    const res = await axios.post(
      `${BASE_URL}/customers/${customerId}/credit`,
      {
        amount: orderAmount,
        description: `Refund for order #${orderNumber}`
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );

    console.log(`Refunded ${res.data.data.amount_credited} to customer ${customerId}`);
    console.log(`New balance: ${res.data.data.new_balance}`);
    
    return res.data.data;
  } catch (err) {
    console.error('Refund failed:', err.response.data.message);
    throw err;
  }
}
```

### Check Customer Balance
```javascript
async function getCustomerBalance(customerToken) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  const res = await axios.get(`${BASE_URL}/getBalance`, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  return res.data.data; // [{ wallet_type: "USD", amount: 150.00 }]
}
```

---

## Best Practices

### 1. Store Customer Tokens Securely
- Store the customer bearer token in your database linked to your user
- Never expose tokens in client-side code
- Use tokens server-side to create payments on behalf of customers

### 2. Handle Webhooks for Payment Status
```javascript
// Express.js webhook handler
app.post('/webhooks/dynopay', (req, res) => {
  const { transaction_id, status, amount, customer_id } = req.body;
  
  if (status === 'completed') {
    // Update order status in your database
    // Credit user account, send confirmation email, etc.
  }
  
  res.status(200).send('OK');
});
```

### 3. Use Meta Data for Tracking
```javascript
// Attach order info to payments
const payment = await createPayment({
  amount: 100,
  meta_data: {
    order_id: 'ORD-123',
    customer_name: 'Jane Doe',
    items: ['Product A', 'Product B']
  }
});
```

### 4. Handle Errors Gracefully
```javascript
try {
  const payment = await createPayment(/* ... */);
} catch (err) {
  if (err.response?.status === 400) {
    // Validation error (e.g., invalid amount)
    console.error(err.response.data.message);
  } else if (err.response?.status === 403) {
    // Auth error (invalid API key or token expired)
    console.error('Authentication failed');
  } else {
    // Server error
    console.error('Payment system temporarily unavailable');
  }
}
```

### 5. Wallet Balance Checks
Before debiting a customer wallet, check balance first:

```javascript
async function chargeSubscription(customerId, subscriptionFee) {
  // Get customer details (includes wallet balance)
  const customer = await getCustomerDetail(customerId);
  const balance = customer.wallet.amount;

  if (balance < subscriptionFee) {
    // Send email asking customer to top up
    await sendTopUpReminder(customer.email);
    return { success: false, reason: 'insufficient_balance' };
  }

  // Debit wallet for subscription
  await debitWallet(customerId, subscriptionFee, 'Monthly subscription');
  return { success: true };
}
```

---

## FAQ

### Q: Do I need to create a customer before accepting payments?
**A**: No! With **Userless Payment**, you can call `createPayment` or `cryptoPayment` with just your `x-api-key` header. Dynopay automatically handles customer context internally. Customer creation is only needed if you want per-customer wallet balances and transaction history.

### Q: What's the difference between userless and customer-based payments?
**A**: 
| Feature | Userless (API key only) | Customer-Based (API key + token) |
|---|---|---|
| Setup | 1 API call | 2 API calls (createUser + payment) |
| Customer tracking | Shared internal customer | Individual customer records |
| Wallet balance | Shared | Per-customer |
| Transaction history | Shared | Per-customer |
| **Best for** | Simple checkouts, one-time payments | Marketplaces, wallets, subscriptions |

### Q: Can I mix userless and customer-based payments?
**A**: Yes! Both flows are fully compatible. If you include an `Authorization: Bearer <token>` header, Dynopay uses that customer. If you don't, it uses a default internal customer. You can use userless for simple checkouts and customer-based for wallet features.

### Q: How do I test payments without real crypto?
**A**: Use the development API key (starts with `dpk_test_`). Development keys are limited to smaller amounts and sandbox mode.

### Q: Can I accept only specific cryptocurrencies?
**A**: Yes! Use the `accepted_currencies` parameter:
```javascript
{
  amount: 50,
  accepted_currencies: ["BTC", "ETH", "USDT-TRC20"]
}
```

### Q: How long does it take for payments to confirm?
**A**: Crypto payments are forwarded instantly to your wallet. Blockchain confirmations vary by network (BTC ~10min, ETH ~1min, USDT-TRC20 ~3min).

### Q: Can I refund a customer?
**A**: Yes! Credit their wallet using the admin API:
```bash
POST /api/admin/customers/:id/credit
```

### Q: What currencies are supported for wallet balances?
**A**: Wallet balances are stored in your API key's base currency (USD, EUR, GBP, etc.). This is a display/reporting conversion for your dashboard totals — merchants receive the actual crypto in their wallet. If you want on-chain conversion of incoming crypto to a stablecoin (USDT/USDC), that's a separate opt-in toggle per wallet — enable it in Company Settings → Crypto Conversion, otherwise you keep the original coin.

### Q: How do I get the customer_id for admin wallet operations?
**A**: 
1. Via dashboard: Navigate to Customers page and click on a customer to see their numeric `customer_id`
2. Via API: Use `GET /api/userApi/customers` to list all customers with their IDs
3. From transaction data: The `customer_id` is included in transaction responses

### Q: Can customers have negative wallet balances?
**A**: No. The debit endpoint validates sufficient balance before processing.

### Q: Are wallet operations atomic?
**A**: Yes. All wallet credit/debit operations use database transactions to ensure consistency.

### Q: What happens with XRP/RLUSD payments?
**A**: The `cryptoPayment` response includes a `destination_tag` field for XRP and RLUSD currencies. You **must** display this tag to your customer alongside the wallet address — it is required for the payment to be correctly identified on the blockchain.

---

## Need Help?

- **Full API Reference**: Visit your Dynopay dashboard → Documentation
- **Support**: Contact support@dynopay.com
- **Dashboard**: https://dashboard.dynopay.com

Happy integrating! 🚀
