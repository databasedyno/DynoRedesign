# Dynopay API - Developer Integration Guide

Welcome to the Dynopay API! This guide will help you integrate crypto payments and customer wallet management into your application.

## Table of Contents
- [Quick Start](#quick-start)
- [Ways to Accept Payments (Overview)](#ways-to-accept-payments-overview)
- [Userless Payment (Simplified)](#userless-payment-simplified)
- [Payment Links](#payment-links)
- [Buy Button](#buy-button)
- [Common Integration Patterns](#common-integration-patterns)
- [Embedded Checkout (iframe on your page)](#embedded-checkout-iframe-on-your-page)
- [Elements — Inline Crypto Widget (no iframe)](#elements--inline-crypto-widget-no-iframe)
- [Customer Wallet System](#customer-wallet-system)
- [Best Practices](#best-practices)
- [FAQ](#faq)

---

## Ways to Accept Payments (Overview)

Every method below settles the same way — the buyer pays in crypto, funds forward to the wallet you control, and a webhook fires when the status changes. Choose the one that fits your stack:

| Method | Code needed | Best for |
| --- | --- | --- |
| **Hosted Checkout** | 1 API call | Redirect the buyer to a Dynopay-hosted checkout page (`checkout_url`). Fastest server integration. |
| **Payment Links** | None (dashboard) | A reusable link (e.g. `dynopay.com/aBc123`) you share by email, chat, or QR. Invoices, one-off requests. |
| **Buy Button** | Copy-paste HTML | A `<dynopay-buy-button>` "Buy Now" snippet for any site (Webflow, WordPress, static HTML). |
| **Direct API (QR)** | API + your UI | Get an address + QR and render your own pay screen. Full control. |
| **Embedded Checkout** | `embed.js` + server session | Mount the full checkout in an iframe inside your page. |
| **Elements** | `embed.js` (no iframe) | Render the pay UI (currency picker, address, QR, live status) directly in your DOM. |
| **Webhooks** | Server endpoint | Required for reliable fulfilment — Dynopay POSTs your server on every status change. |

> No developer? Start with a **Payment Link** or a **Buy Button** — neither needs a backend.

**Multiple brands, one account.** Run several businesses or brands from a single Dynopay login — each with its own wallets, checkout and settlement. Pass a `company_id` when creating payments, links, or keys to scope them to a specific brand, and switch between brands in the dashboard with one click.

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
curl -X POST https://dynopay.com/api/user/createPayment \
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
curl -X POST https://dynopay.com/api/user/createPayment \
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
curl -X POST https://dynopay.com/api/user/cryptoPayment \
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
curl -X GET https://dynopay.com/api/user/getSupportedCurrency \
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

  const res = await axios.post('https://dynopay.com/api/user/createPayment', {
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
        'https://dynopay.com/api/user/createPayment',
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
curl -X POST https://dynopay.com/api/user/createUser \
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
curl -X POST https://dynopay.com/api/user/createPayment \
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
  const paymentRes = await axios.post('https://dynopay.com/api/user/createPayment', {
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
  const BASE_URL = 'https://dynopay.com/api/user';

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
  const BASE_URL = 'https://dynopay.com/api/user';

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

  const res = await axios.post('https://dynopay.com/api/user/cryptoPayment', {
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

## Payment Links

A **Payment Link** is a reusable hosted-checkout URL you can share anywhere — no site or code required. Create one from the dashboard (**Payment Links → New**) or via the API, then send it by email, chat, or a QR code.

- **Shareable short link:** `https://dynopay.com/<ref>` (e.g. `https://dynopay.com/aBc123`) — brand-friendly, redirects to the hosted checkout.
- **Direct checkout URL:** `https://checkout.dynopay.com/pay?d=<ref>` — the same session, used internally and by older integrations.

### Create a Payment Link (API)

```bash
curl -X POST https://dynopay.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer <your_dashboard_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "base_amount": 25.00,
    "base_currency": "USD",
    "accepted_currencies": ["BTC", "ETH", "USDT-TRC20"],
    "description": "Invoice #1042",
    "email": "buyer@example.com",
    "expire": "7d"
  }'
```

Response (trimmed):
```json
{
  "message": "Payment link created successfully",
  "data": {
    "link_id": 302,
    "payment_link": "https://checkout.dynopay.com/pay?d=aBc123",
    "short_link": "https://dynopay.com/aBc123",
    "base_amount": 25,
    "base_currency": "USD",
    "accepted_currencies": ["BTC", "ETH", "USDT-TRC20"]
  }
}
```

Share `short_link` with your customer. When they open it they pick a coin, pay, and Dynopay forwards the funds to your wallet — then fires your webhook. Manage or delete links anytime from the dashboard (or `DELETE /api/pay/deletePaymentLink/:link_id`).

> **Tip:** set `expire` to `24h`, `7d`, `30d`, or `No` (never expires). Add a `webhook_url` to receive status updates for that specific link.

---

## Buy Button

The **Buy Button** turns any web page into a checkout with a copy-paste snippet — perfect for Webflow, WordPress, Shopify blogs, or plain HTML. The shopper clicks **Buy Now** and the hosted checkout opens in a modal (or redirects). The price is resolved securely on the server from the `button-id`, so it can't be tampered with in the browser.

### 1. Create a button

1. Open **Developers → Buy Buttons** in your dashboard.
2. Set a **label**, a **fixed price** (or a min/max range so the customer chooses), and the currencies you accept.
3. Copy the snippet — it already embeds your **publishable key** (`pk_live_…` / `pk_test_…`) and **button id** (`btn_…`).

### 2. Paste the snippet

```html
<!-- Dynopay embed SDK — load once per page -->
<script src="https://checkout.dynopay.com/v1/embed.js"></script>

<!-- Paste the button anywhere on your page -->
<dynopay-buy-button
  publishable-key="pk_live_your_key"
  button-id="btn_xxxxxxxx"
  mode="modal"
  theme="dark"
></dynopay-buy-button>
```

### Attributes

| Attribute | Required | Description |
| --- | --- | --- |
| `publishable-key` | Yes | Browser-safe key (`pk_live_…` or `pk_test_…`). Domain-locked and amount-capped — **never** your secret API key. |
| `button-id` | Yes | The `btn_…` id you created. The price is resolved server-side from this id. |
| `amount` | No | Default amount for range / customer-chooses buttons. Ignored for fixed-price buttons. |
| `currency` | No | Pre-select a single crypto (e.g. `BTC`). Omit to let the buyer choose. |
| `mode` | No | `"modal"` (default) opens checkout in an overlay; `"redirect"` sends the buyer to the hosted page. |
| `theme` | No | `"dark"` or `"light"` to match your page. |

> **Fulfil on the webhook, not the button.** The button is UX only — always confirm the final payment via the `payment.confirmed` webhook before delivering the product.

### Test mode

Use a **`pk_test_…`** publishable key to try the whole flow in sandbox without moving real funds. Create/read your test key under **Developers → Publishable Keys** (environment = *development*), then swap it back to `pk_live_…` when you go live.

---


## Embedded Checkout (iframe on your page)

> **Keep customers on your site.** Instead of redirecting to `checkout.dynopay.com`, mount the Dynopay checkout as an **iframe** directly inside your page (inline) or as a **centered modal**. Same crypto flow, same currencies, same webhooks — different presentation.

Think of it like Stripe's **Embedded Checkout**: your server creates a session, your browser gets back a short-lived **`client_secret`**, and our tiny SDK (`embed.js`) renders it in a resizeable iframe.

### Architecture at a glance

```
Merchant site                       Merchant server                Dynopay
─────────────                       ────────────────               ─────────────
  <script src=CHECKOUT/v1/embed.js>
  Dynopay.initEmbeddedCheckout({
    fetchClientSecret ──────────▶  POST /api/user/embed/session
                                   headers: x-api-key: dpk_live_…  ────▶  Dynopay
                                   body:    { amount, ... }              creates
                                   ◀───────── { client_secret, ... }     session
  })
  checkout.mount('#dynopay-checkout')
  │
  └── iframe ── CHECKOUT/pay?d=<client_secret>&embed=1 ──▶ Dynopay
                                                         renders checkout
                     ◀── postMessage events (ready/resize/success/redirect)
```

**Two things you MUST know:**
1. Your **secret key** (`dpk_live_…` / `dpk_test_…`) **stays on your server**. The browser only ever sees the opaque `client_secret`.
2. **Trust webhooks, not the browser event.** Confirm every payment via the `payment.succeeded` webhook (`X-DynoPay-Signature`). The in-browser `onComplete` callback is a UX signal — never a fulfillment trigger.

---

### 1. Create the session (server-side)

**Endpoint:** `POST /api/user/embed/session`
**Auth:** header `x-api-key: <your secret key>`

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | ✅ | In your API key's base currency (USD/EUR/GBP/etc). Minimum **5**. |
| `accepted_currencies` | string[] | | Filter which cryptos the customer can pick, e.g. `["USDT-TRC20","BTC"]`. Must be a subset of what you've configured on your wallets — mismatches return a helpful 400. Omit → all configured. |
| `redirect_uri` | string | | Where to send the customer after success. |
| `webhook_url` | string | | Per-session override; else the key's default `webhook_url` is used. |
| `callback_url` | string | | Legacy webhook alias. |
| `fee_payer` | `"company"` \| `"customer"` | | Who covers the network fee. Default `"company"`. |
| `meta_data` | object | | Free-form JSON, echoed back in webhooks. |
| `allowed_origins` | string[] | | Domains permitted to iframe this session (e.g. `["https://shop.com"]`). Stored on the session for future frame-ancestors enforcement. |

**Response `200`:**
```json
{
  "success": true,
  "message": "Embedded checkout session created",
  "data": {
    "client_secret": "a1b2c3…",
    "checkout_url": "https://checkout.dynopay.com/pay?d=…&embed=1",
    "expires_at":  "2026-07-11T10:37:00.000Z",
    "ui_mode": "embedded",
    "fee_payer": "company",
    "payment_methods": [
      { "type": "crypto", "currencies": ["USDT-TRC20","BTC","ETH"] }
    ]
  }
}
```

Notes: `client_secret` is an opaque 48-char handle (NOT your API key). `expires_at` is ~60 minutes from creation.

**Node.js example (Express):**
```js
// POST /create-dynopay-session on YOUR server
app.post('/create-dynopay-session', async (req, res) => {
  const r = await fetch('https://dynopay.com/api/user/embed/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.DYNOPAY_API_KEY  // dpk_live_… — never send to the browser
    },
    body: JSON.stringify({
      amount: 50,
      redirect_uri: 'https://shop.com/thanks',
      webhook_url:  'https://shop.com/webhooks/dynopay',
      allowed_origins: ['https://shop.com'],
      meta_data: { order_id: req.body.order_id }
    })
  });
  const { data } = await r.json();
  res.json({ client_secret: data.client_secret });
});
```

---

### 2. Mount the checkout (browser)

Load the SDK once per page:

```html
<script src="https://checkout.dynopay.com/v1/embed.js"></script>
```

The SDK exposes a global `window.Dynopay`. It's ~7 KB, has no runtime deps, and is safe to load with `defer`.

#### 2a. Inline embed

```html
<div id="dynopay-checkout" style="max-width:460px;margin:auto;"></div>

<script>
  const checkout = await Dynopay.initEmbeddedCheckout({
    fetchClientSecret: () =>
      fetch('/create-dynopay-session', { method: 'POST' })
        .then(r => r.json())
        .then(d => d.client_secret),
    onReady:    ()          => console.log('checkout ready'),
    onComplete: (paymentId) => console.log('paid — verify via webhook', paymentId),
    onError:    (err)       => console.error(err),
  });

  checkout.mount('#dynopay-checkout');
  // checkout.destroy();  // when you unmount
</script>
```

The iframe **auto-resizes** as the customer moves through the flow (currency → address/QR → success) via `dynopay:resize` postMessage events. Minimum height 540px.

#### 2b. Modal / overlay

```js
const modal = Dynopay.openCheckout({
  fetchClientSecret: () => fetch('/create-dynopay-session', { method: 'POST' })
    .then(r => r.json()).then(d => d.client_secret),
  onComplete: (paymentId) => modal.close(),
});
// modal.close();  // programmatic close (or click × / overlay)
```

The overlay dims the page, centers a panel, and provides a close button — nothing else needed on your side.

#### 2c. Full-page fallback

If a browser blocks iframes (rare), fall back to the classic redirect:

```js
Dynopay.redirectToCheckout({
  fetchClientSecret: () => fetch('/create-dynopay-session', { method: 'POST' })
    .then(r => r.json()).then(d => d.client_secret),
});
// → navigates the top window to https://checkout.dynopay.com/pay?d=<cs>
```

---

### 3. postMessage events (advanced)

If you need finer control, listen for the underlying events yourself (the SDK already handles the common ones):

| Event | Direction | Payload |
|-------|-----------|---------|
| `dynopay:ready` | iframe → parent | — |
| `dynopay:resize` | iframe → parent | `{ height: number }` |
| `dynopay:success` | iframe → parent | `{ paymentId?: string }` (UX only — verify via webhook) |
| `dynopay:redirect` | iframe → parent | `{ url: string }` — SDK will navigate the top window |
| `dynopay:close` | iframe → parent | — |

Every message has `source: 'dynopay'` — filter on that before trusting.

---

### 4. React example

```tsx
import { useEffect, useRef } from 'react';

export function DynopayCheckout({ amount }: { amount: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      await new Promise<void>((resolve) => {
        if ((window as any).Dynopay) return resolve();
        const s = document.createElement('script');
        s.src = 'https://checkout.dynopay.com/v1/embed.js';
        s.onload = () => resolve();
        document.head.appendChild(s);
      });

      instRef.current = await (window as any).Dynopay.initEmbeddedCheckout({
        fetchClientSecret: () =>
          fetch('/api/dynopay/session', {
            method: 'POST',
            body: JSON.stringify({ amount }),
            headers: { 'Content-Type': 'application/json' },
          }).then(r => r.json()).then(d => d.client_secret),
        onComplete: () => { /* show your own "thank you" — webhook confirms fulfillment */ },
      });
      instRef.current.mount(boxRef.current!);
    })();

    return () => instRef.current?.destroy();
  }, [amount]);

  return <div ref={boxRef} style={{ maxWidth: 460, margin: 'auto' }} />;
}
```

---

### 5. Security checklist

- Secret key stays server-side — the browser only sees `client_secret`.
- `client_secret` is opaque, single checkout, expires in ~60 minutes.
- Pass `allowed_origins: ["https://your-domain.com"]` on the server to record which sites may host this session (used for future CSP `frame-ancestors` enforcement).
- Confirm payments via the **`payment.succeeded` webhook** (`X-DynoPay-Signature`). Never trust the browser `onComplete` for fulfillment.
- The iframe is served from your Dynopay checkout origin — CSP on YOUR page must allow `frame-src https://checkout.dynopay.com` (or your preview origin).
- `redirect_uri` is where the checkout sends the customer after success; keep it on your own domain.

---

### 6. Testing tip

A ready-to-open test harness is served alongside the SDK at `/embed-test.html` (same origin as `embed.js`). Open it, paste a `client_secret` from your session, and click **Mount inline checkout** or **Open modal checkout** to sanity-check your setup end to end. Your dashboard's **Developer Keys** page also renders copy-paste snippets for your specific origin.

---



## Elements — Inline Crypto Widget (no iframe)

> **Render Dynopay's crypto payment UI directly in your own DOM** — no iframe, no redirect. Uses a **publishable key** (browser-safe, domain-locked). The widget shows a currency picker → address + QR + copy button + live status pill. All fulfillment is still confirmed via **webhooks**, not the browser `succeeded` event.

Think of it like Stripe's **Payment Element**: your merchant-side JS creates a payment intent with your **publishable** key, the SDK renders the pay UI in a `<div>` you own, and events tell you when the customer picks a currency, when the address is shown, and when payment lands on-chain.

### Architecture at a glance

```
Merchant site (browser)                                Dynopay
─────────────────────────                              ─────────────
  <script src=CHECKOUT/v1/embed.js></script>
  <div id="dynopay-crypto-el"></div>
  const dp = Dynopay('pk_live_…');
  const elements = dp.elements({ appearance:{theme:'auto'} });
  const el = elements.create('crypto',{amount:20});
  el.mount('#dynopay-crypto-el');
        │
        ├── POST /api/embed/public/elements/intent        ─▶ creates intent
        │       headers: x-publishable-key + Origin              (Redis, 24h TTL)
        │   ◀───────── { intent_id, client_secret,
        │              available_currencies, amount, base_currency }
        │
        │ [customer clicks a currency]
        ├── POST /api/embed/public/elements/select-currency ─▶ reserves ONE
        │   ◀───────── { address, qr_code, amount,               merchant-pool
        │              currency, destination_tag? }              address
        │
        └── GET  /api/embed/public/elements/status?...     ─▶ polls every 5s
                                                              until succeeded/
                                                              expired/failed
```

**Three things you MUST know:**
1. Your **publishable key** (`pk_live_…` / `pk_test_…`) is **browser-safe** — but is **domain-locked** and **amount-capped** by default. Add every domain that mounts the widget to the key's `allowed_domains` (dashboard → Publishable Keys). Wildcards `*.example.com` are supported.
2. **Trust webhooks, not the browser event.** Confirm every payment via the `payment.succeeded` webhook (`X-DynoPay-Signature`). The `succeeded` event on the element is a UI signal — never a fulfillment trigger.
3. **The address is a real merchant-pool address** (same infra the hosted checkout uses). It's reserved for ~2h once the customer picks a currency; a real payment to that address triggers your webhook.

---

### 1. Load the SDK (once per page)

```html
<script src="https://checkout.dynopay.com/v1/embed.js"></script>
```

Exposes `window.Dynopay` — a **function** you call with your publishable key (`Dynopay('pk_live_…')`) that returns an SDK client. Backward-compat: `Dynopay.initEmbeddedCheckout` / `Dynopay.openCheckout` (from Embedded Checkout) still exist on the same object.

---

### 2. Mount the widget

```html
<div id="dynopay-crypto-el"></div>

<script>
  const dp = Dynopay('pk_live_…');
  const elements = dp.elements({
    appearance: {
      theme:  'auto',        // 'dark' | 'light' | 'auto' (follows prefers-color-scheme)
      preset: 'default',     // 'default' | 'stripe-like' | 'flat' | 'minimal'
      accent: '#CCFF00',
      radius: 12,            // px, or omit to use preset default
      locale: 'en',          // 'en'|'es'|'fr'|'pt'|'hi' — auto-detected if omitted
      // labels: { title: 'Pay with Bitcoin' }  // override any built-in string
    },
  });

  const el = elements.create('crypto', {
    amount: 20,                               // in the pk's base currency
    currency: 'USDT-TRC20',                   // optional — skips the picker
    redirectUri: 'https://shop.com/thanks',   // optional
    meta: { order_id: 'ORD-42' },             // optional — echoed in webhooks
  });

  el.on('currency_selected', d => console.log('picked', d.currency, d.address));
  el.on('succeeded', d => location.href = '/thanks?p=' + d.payment_id);
  el.on('expired',   () => console.log('intent expired'));
  el.on('failed',    () => console.log('payment failed'));
  el.on('error',     e  => console.error(e.message));

  el.mount('#dynopay-crypto-el');
  // el.destroy();  // when you unmount
</script>
```

The rendered UI has two phases:
1. **Currency picker** — a grid of the currencies allowed by (a) your wallets, (b) this pk's `allowed_currencies`, and (c) the merchant address pool.
2. **Address panel** — amount + QR + copy button + destination tag (for XRP/RLUSD) + live status pill polled every 5s + "Change currency" link (works until status becomes `processing`).

---

### 3. Endpoints (called by the SDK — reference)

You never call these yourself — the SDK does. Listed for debugging.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/embed/public/elements/intent` | `x-publishable-key` + `Origin` allow-list | Create an intent; returns `{intent_id, client_secret, available_currencies, amount, base_currency, expires_at}` |
| `POST` | `/api/embed/public/elements/select-currency` | `x-publishable-key` + `Origin` | Reserve one merchant-pool address for the chosen currency; returns `{address, qr_code, amount, currency, destination_tag?}` |
| `GET` | `/api/embed/public/elements/status?intent_id=…` | `x-publishable-key` + `Origin` | Live status: `requires_currency \| awaiting_payment \| processing \| succeeded \| expired \| failed` |

Rate limits + Origin/domain checks + amount ≤ `pk.max_amount` are enforced identically to the Buy Button endpoints.

---

### 4. Events (client-side, UX-only)

| Event | Fires when | Payload |
|---|---|---|
| `currency_selected` | Customer picks a currency & the address is reserved | `{ currency, address, amount }` |
| `succeeded` | Backend polling sees `payment.succeeded` | `{ status: 'succeeded', payment_id, currency, address }` |
| `expired` | Intent's 24h Redis TTL lapsed | `{ status: 'expired' }` |
| `failed` | Backend reported `failed` / `cancelled` | `{ status: 'failed' }` |
| `error` | Network or validation error | `{ message }` |

Every event is also fired as a `dynopay:<event>` `CustomEvent` on the mounted DOM node — handy for a global listener.

---

### 5. Appearance API (theming)

`elements({ appearance: {...} })` accepts:

| Key | Type | Default | Notes |
|---|---|---|---|
| `theme` | `'dark' \| 'light' \| 'auto'` | `'auto'` | `'auto'` follows the browser's `prefers-color-scheme` |
| `preset` | `'default' \| 'stripe-like' \| 'flat' \| 'minimal'` | `'default'` | Bundle of radius / border / panel-bg defaults |
| `accent` | hex color | `'#CCFF00'` | Copy button + focus + status dots |
| `radius` | number (px) | preset-dependent | Overrides the preset's radius |
| `locale` | `'en' \| 'es' \| 'fr' \| 'pt' \| 'hi'` | `navigator.language → 'en'` | Auto-detected if omitted |
| `labels` | `{ [key]: string }` | — | Override any built-in string (see keys below) |

Built-in string keys you can override in `labels`:
`title`, `subPick`, `sendTitle`, `sendSub`, `address`, `copy`, `copied`, `destTag`, `changeCurrency`, `secured`, `loading`, `errorTitle`, `waiting`, `processing`, `succeeded`, `expired`, `failed`. Variables like `{amount}`, `{currency}`, `{baseCurrency}`, `{baseAmount}`, `{tag}` are interpolated where applicable.

---

### 6. React example

```tsx
import { useEffect, useRef } from 'react';

export function DynopayCryptoElement({ amount = 20 }: { amount?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const el  = useRef<any>(null);

  useEffect(() => {
    (async () => {
      await new Promise<void>((r) => {
        if ((window as any).Dynopay) return r();
        const s = document.createElement('script');
        s.src = 'https://checkout.dynopay.com/v1/embed.js';
        s.onload = () => r();
        document.head.appendChild(s);
      });

      const dp = (window as any).Dynopay('pk_live_…');
      el.current = dp
        .elements({ appearance: { theme: 'auto', preset: 'stripe-like' } })
        .create('crypto', { amount });

      el.current.on('succeeded', () => { /* confirm via webhook */ });
      el.current.mount(box.current!);
    })();
    return () => el.current?.destroy();
  }, [amount]);

  return <div ref={box} />;
}
```

---

### 7. Security checklist

- Publishable key is **domain-locked** — add every host that mounts the widget to `allowed_domains` (wildcards `*.example.com` supported).
- Publishable key is **amount-capped** — requests with `amount > pk.max_amount` return `400`.
- Per-key rate limit (default **30/min**) — burst too high → `429`.
- **CSRF middleware is skipped** for `x-publishable-key` — you don't need cookies or a CSRF token.
- Fulfillment via **`payment.succeeded` webhook** (`X-DynoPay-Signature`) — the SDK `succeeded` event is UX only.
- The address is a **real** merchant-pool address, reserved for ~2h. Real crypto sent to it will trigger your webhook exactly like the hosted checkout.

---

### 8. Testing tip

A ready-to-open harness is served alongside the SDK at `/elements-test.html` (same origin as `embed.js`). Textbox for `pk` + amount + optional currency, "Mount Elements widget" button, real-time event log. Query prefill: `?pk=…&amt=20&ccy=USDT-TRC20`. Your dashboard's **Developer Keys → Elements — Inline Crypto Widget** section also has a "Show live preview" button that mounts the widget with your active publishable key using your dashboard's theme.

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
curl -X POST https://dynopay.com/api/admin/customers/123/credit \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "description": "Refund for order #12345"
  }'
```

#### Debit Customer Wallet
```bash
curl -X POST https://dynopay.com/api/admin/customers/123/debit \
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
  const BASE_URL = 'https://dynopay.com/api/admin';

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
  const BASE_URL = 'https://dynopay.com/api/user';

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

Verify the signature on **every** webhook before trusting it.

**Headers sent on each delivery**

| Header | Description |
|---|---|
| `X-DynoPay-Event` | Event name, e.g. `payment.succeeded` |
| `X-DynoPay-Timestamp` | Unix time (seconds) the webhook was sent |
| `X-DynoPay-Webhook-Id` | Unique id for this delivery (idempotency) |
| `X-Dynopay-Signature-V2` | **Recommended.** `t=<timestamp>,v1=<hmac>` — HMAC-SHA256 of `"<timestamp>.<rawBody>"` using your signing secret, computed over the **raw request body**. |
| `X-DynoPay-Signature` | Legacy v1 signature (HMAC over the re-serialised object). Kept for backward compatibility. |

**Verify V2 (recommended) — Node/Express**
```javascript
const crypto = require('crypto');

// IMPORTANT: capture the RAW body. e.g.
// app.use('/webhooks/dynopay', express.raw({ type: 'application/json' }))
app.post('/webhooks/dynopay', (req, res) => {
  const secret = process.env.DYNOPAY_WEBHOOK_SECRET;      // whsec_...
  const raw = req.body.toString('utf8');                  // exact bytes we signed
  const header = req.get('X-Dynopay-Signature-V2') || ''; // "t=...,v1=...,v1=..."

  const parts = Object.fromEntries(
    header.split(',').map(kv => kv.split('=').map(s => s.trim()))
  );
  const t = parts.t;

  // 1) Replay window — reject anything older than 5 minutes.
  const REPLAY_WINDOW_SECONDS = 300;
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > REPLAY_WINDOW_SECONDS) {
    return res.status(400).send('stale or missing timestamp');
  }

  // 2) Signature — the header may carry MULTIPLE `v1=` values during a
  //    24h secret-rotation grace window. Accept if ANY matches (constant-time).
  const expected = crypto.createHmac('sha256', secret)
    .update(`${t}.${raw}`).digest('hex');
  const provided = header.split(',')
    .filter(p => p.trim().startsWith('v1='))
    .map(p => p.trim().slice(3));
  const ok = provided.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch { return false; }
  });
  if (!ok) return res.status(401).send('bad signature');

  // 3) Idempotency — de-dupe on X-DynoPay-Webhook-Id before acting.
  const { transaction_id, status, amount } = JSON.parse(raw);
  if (status === 'completed' || status === 'successful') {
    // Update order status; credit account; send confirmation, etc.
  }
  res.status(200).send('OK');
});
```

**Replay / timestamp window.** Every webhook carries `X-DynoPay-Timestamp` (and `t=` inside `X-Dynopay-Signature-V2`). Reject deliveries whose timestamp is more than **5 minutes** (300s) from your server clock — this blocks replay attacks. Pick a tolerance that fits your clock skew; 5 minutes is the Stripe/Standard-Webhooks default.

**Zero-downtime secret rotation.** When you rotate your signing secret in the dashboard, the **previous secret stays valid for 24 hours** and DynoPay co-signs each webhook to the company URL with **both** secrets (two `v1=` entries in `X-Dynopay-Signature-V2`). Accept a webhook if *any* `v1=` verifies (as shown above), then swap your stored secret in during the grace window with no missed deliveries.

**Manual resend.** From **Dashboard → Developers → Webhooks**, open any past delivery and press **Re-send this event** to redeliver it (fresh id, timestamp and signature) — useful after your endpoint had an outage.


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
