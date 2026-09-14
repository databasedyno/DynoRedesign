// ============================================================
// Swagger paths — Embedded Checkout + Elements Inline Widget
// ------------------------------------------------------------
// Brings Swagger (/api/docs) to parity with the public /documentation
// page. Covers:
//   • POST /api/user/embed/session               (secret x-api-key)
//   • POST /api/embed/public/elements/intent      (publishable key + Origin)
//   • POST /api/embed/public/elements/select-currency (publishable key + Origin)
//   • GET  /api/embed/public/elements/status      (publishable key + Origin)
//
// Contracts mirror the live handlers in:
//   routes/merchantApiRouter.ts (embed/session)
//   controller/elementsController.ts (elements/*)
// ============================================================

export const embedPaths = {
  '/api/user/embed/session': {
    post: {
      tags: ['Embedded Checkout', 'Direct API - Merchant Integration'],
      summary: 'Create an Embedded Checkout session (embed.js)',
      description: `Create a server-side session for **Dynopay Embedded Checkout** (\`embed.js\`). Returns an opaque \`client_secret\` that your front-end passes to \`embed.js\` to render the hosted checkout inside an iframe on your page.

**🔐 Authentication:** Call from your **server** with your SECRET \`x-api-key\` header. Do NOT expose the secret key in the browser.

**🔄 Flow:**
1. Server: \`POST /api/user/embed/session\` → returns \`client_secret\` + \`checkout_url\`.
2. Browser: initialise \`embed.js\` with the \`client_secret\`.
3. Confirm fulfilment via the \`payment.succeeded\` webhook (never trust the client).

The session is Redis-backed and expires after 1 hour. No blockchain address is reserved until the customer picks a currency in the iframe.`,
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                amount: { type: 'number', description: '✅ REQUIRED: Amount in your API key base currency (min 5)', example: 49.99 },
                redirect_uri: { type: 'string', description: 'OPTIONAL: URL the customer returns to after payment', example: 'https://yoursite.com/thank-you' },
                accepted_currencies: { type: 'array', items: { type: 'string' }, description: 'OPTIONAL: Subset of your configured wallet currencies to accept', example: ['BTC', 'ETH', 'USDT-TRC20'] },
                fee_payer: { type: 'string', enum: ['company', 'customer'], description: "OPTIONAL: Who pays the network/processing fee (default 'company')", example: 'company' },
                webhook_url: { type: 'string', description: 'OPTIONAL: Per-payment webhook override', example: 'https://yoursite.com/webhooks/dynopay' },
                callback_url: { type: 'string', description: 'OPTIONAL: Extra server callback URL', example: 'https://yoursite.com/callback' },
                allowed_origins: { type: 'array', items: { type: 'string' }, description: 'OPTIONAL: Origins allowed to embed the iframe', example: ['https://shop.com'] },
                meta_data: { type: 'object', description: 'OPTIONAL: Custom metadata echoed back in webhooks', example: { order_id: 'ORD-12345' } },
              },
            },
            examples: {
              'Basic session': { summary: 'Minimal embedded checkout session', value: { amount: 49.99 } },
              'Scoped currencies': { summary: 'Restrict methods + attach metadata', value: { amount: 100, accepted_currencies: ['BTC', 'USDT-TRC20'], meta_data: { order_id: 'ORD-42' } } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Embedded checkout session created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Embedded checkout session created' },
                  data: {
                    type: 'object',
                    properties: {
                      client_secret: { type: 'string', description: 'Opaque handle loaded by embed.js (NOT the api key)', example: 'a1b2c3d4...' },
                      checkout_url: { type: 'string', example: 'https://checkout.dynopay.com/pay?d=a1b2c3d4...&embed=1' },
                      expires_at: { type: 'string', format: 'date-time', example: '2026-07-11T10:37:00.000Z' },
                      ui_mode: { type: 'string', example: 'embedded' },
                      fee_payer: { type: 'string', example: 'company' },
                      payment_methods: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', example: 'crypto' },
                            currencies: { type: 'array', items: { type: 'string' }, example: ['USDT-TRC20', 'BTC', 'ETH'] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Validation error (amount < 5, or no wallet configured)' },
        403: { description: 'Missing or invalid x-api-key' },
      },
    },
  },

  '/api/embed/public/elements/intent': {
    post: {
      tags: ['Elements Inline Widget', 'Embedded Checkout'],
      summary: 'Create an Elements payment intent (publishable key)',
      description: `Create a payment intent for the **Elements Inline Widget** — the SDK renders the pay UI (currency picker, address, QR, live status) directly in your DOM (no iframe). Usually called for you by \`Dynopay(pk).elements().create('crypto', { amount }).mount('#el')\`.

**🔐 Authentication:** Browser-safe **publishable key** in \`x-publishable-key\`. The request \`Origin\` must be on the key's \`allowed_domains\` (wildcards supported).

Returns an intersection of your configured wallets, the pk's \`allowed_currencies\`, and the merchant address pool. The \`intent_id\` (\`pi_...\`) is Redis-backed and valid for 24h.`,
      security: [{ PublishableKeyAuth: [] }],
      parameters: [
        { name: 'Origin', in: 'header', required: true, schema: { type: 'string' }, description: 'Must match an entry in the pk allowed_domains', example: 'https://your-site.com' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                amount: { type: 'number', description: "✅ REQUIRED: Amount in the pk base currency (min 5, ≤ pk.max_amount)", example: 20 },
                currency: { type: 'string', description: 'OPTIONAL: Crypto — if in the effective set, the picker is skipped', example: 'USDT-TRC20' },
                redirect_uri: { type: 'string', description: 'OPTIONAL: Echoed in webhooks (not used by the widget)', example: 'https://your-site.com/done' },
                meta_data: { type: 'object', description: 'OPTIONAL: Custom metadata echoed back in webhooks', example: { order_id: 'ORD-42' } },
              },
            },
            examples: {
              'Amount only': { summary: 'Let the customer pick a currency', value: { amount: 20 } },
              'Pre-selected currency': { summary: 'Skip the currency picker', value: { amount: 20, currency: 'USDT-TRC20' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Intent created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Intent created' },
                  data: {
                    type: 'object',
                    properties: {
                      intent_id: { type: 'string', example: 'pi_a1b2c3...' },
                      client_secret: { type: 'string', example: 'elm_x9y8z7...' },
                      status: { type: 'string', example: 'requires_currency' },
                      available_currencies: { type: 'array', items: { type: 'string' }, example: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'LTC'] },
                      amount: { type: 'number', example: 20 },
                      base_currency: { type: 'string', example: 'USD' },
                      expires_at: { type: 'string', format: 'date-time', example: '2026-07-12T09:00:00.000Z' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Validation error (amount < 5 or > pk.max_amount, no currencies available)' },
        403: { description: 'Invalid publishable key or Origin not in allowed_domains' },
      },
    },
  },

  '/api/embed/public/elements/select-currency': {
    post: {
      tags: ['Elements Inline Widget'],
      summary: 'Select a currency on an Elements intent (publishable key)',
      description: `Reserve a merchant-pool address for the chosen currency on an existing Elements intent. **Idempotent** — a second call with the same currency returns the SAME address. Switching currency after the intent reaches \`processing\`/\`succeeded\` returns \`400\`. Converts fiat → crypto at the live rate and generates a QR code. Called automatically by \`element.mount()\` after the customer picks a currency.

**🔐 Authentication:** \`x-publishable-key\` + matching \`Origin\`.`,
      security: [{ PublishableKeyAuth: [] }],
      parameters: [
        { name: 'Origin', in: 'header', required: true, schema: { type: 'string' }, description: 'Must match pk allowed_domains', example: 'https://your-site.com' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['intent_id', 'currency'],
              properties: {
                intent_id: { type: 'string', description: "✅ REQUIRED: The pi_... returned from Create Intent", example: 'pi_a1b2c3...' },
                currency: { type: 'string', description: "✅ REQUIRED: One of the intent's available_currencies", example: 'USDT-TRC20' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Currency selected — address + QR returned',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Currency selected' },
                  data: {
                    type: 'object',
                    properties: {
                      currency: { type: 'string', example: 'USDT-TRC20' },
                      address: { type: 'string', example: 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR' },
                      qr_code: { type: 'string', description: 'PNG data URL', example: 'data:image/png;base64,...' },
                      amount: { type: 'number', example: 20 },
                      destination_tag: { type: 'integer', nullable: true, description: 'XRP/RLUSD only', example: null },
                      payment_id: { type: 'string', example: 'txn_...' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Currency not in available_currencies, or intent already processing/succeeded' },
        403: { description: 'Invalid publishable key or Origin' },
        404: { description: 'Intent not found or expired' },
        410: { description: 'Intent expired (24h TTL)' },
      },
    },
  },

  '/api/embed/public/elements/status': {
    get: {
      tags: ['Elements Inline Widget'],
      summary: 'Poll an Elements intent status (publishable key)',
      description: `Read the live status of an Elements intent. The SDK polls this every ~5s. DB status is mapped to a stable client status: \`completed/successful/confirmed → succeeded\`, \`underpaid/partial/processing → processing\`, \`failed/expired/cancelled → failed\`; otherwise \`requires_currency\` / \`awaiting_payment\` / \`expired\` (24h TTL).

**⚠️ This endpoint is UX-only** — always confirm fulfilment via the \`payment.succeeded\` webhook.

**🔐 Authentication:** \`x-publishable-key\` + matching \`Origin\`.`,
      security: [{ PublishableKeyAuth: [] }],
      parameters: [
        { name: 'intent_id', in: 'query', required: true, schema: { type: 'string' }, description: 'The pi_... intent id to poll', example: 'pi_a1b2c3...' },
        { name: 'Origin', in: 'header', required: true, schema: { type: 'string' }, description: 'Must match pk allowed_domains', example: 'https://your-site.com' },
      ],
      responses: {
        200: {
          description: 'Current intent status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      intent_id: { type: 'string', example: 'pi_a1b2c3...' },
                      status: { type: 'string', enum: ['requires_currency', 'awaiting_payment', 'processing', 'succeeded', 'failed', 'expired'], example: 'awaiting_payment' },
                      currency: { type: 'string', example: 'USDT-TRC20' },
                      address: { type: 'string', example: 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR' },
                      amount: { type: 'number', example: 20 },
                      base_currency: { type: 'string', example: 'USD' },
                      payment_id: { type: 'string', example: 'txn_...' },
                      expires_at: { type: 'string', format: 'date-time', example: '2026-07-12T09:00:00.000Z' },
                    },
                  },
                },
              },
            },
          },
        },
        403: { description: 'Invalid publishable key or Origin' },
        404: { description: 'Intent not found' },
      },
    },
  },
};
