export const paymentPaths = {
  // ==================== PAYMENT LINKS ====================
  '/api/pay/createPaymentLink': {
    post: {
      tags: ['Payments'],
      summary: 'Create payment link',
      description: `Create a new payment link for accepting crypto or fiat payments. The link can be shared with customers to collect payments.

**🔐 AUTHENTICATION:**
This endpoint requires **JWT Token** authentication (not API Key).
1. Login via \`POST /api/user/login\` to get your JWT token
2. Click "Authorize" button and enter your token
3. Then call this endpoint

**⚠️ KYC VERIFICATION REQUIRED:**
When your transaction volume exceeds **$10,000 USD**, you must complete KYC verification within 90 days to continue creating payment links.

| Volume | KYC Status | Can Create Links |
|--------|------------|------------------|
| < $10,000 | Not Required | ✅ Yes |
| ≥ $10,000 + KYC Approved | ✅ Verified | ✅ Yes |
| ≥ $10,000 + Within 90-day Grace | ⏳ Pending | ✅ Yes (with warning) |
| ≥ $10,000 + Grace Period Expired | ❌ Not Verified | ❌ **Blocked** (403 Error) |

If blocked, complete KYC at \`POST /api/kyc/submit\` first.

**🎁 REFEREE CODE FEATURE:**
When you provide a customer email, the system will automatically:
- Check if the email already has a Dynopay account (skips if yes)
- Check if a referee code was already sent to this email (skips if yes)
- Generate a unique one-time referee code (REF-XXXXXXXX)
- Include the code in the payment notification email

**Referee Code Benefits:**
- Customer who signs up gets **50% off fees for 90 days**
- You (the merchant) get **10% off fees for 30 days**

**FIELD NAME COMPATIBILITY:**
The API supports flexible field naming for backward compatibility. You only need to provide **ONE** currency field and **ONE** amount field:

**Currency Field (choose one):**
- \`currency\` - **RECOMMENDED** for most use cases
- \`base_currency\` - Alternative name (works identically)

**Amount Field (choose one):**
- \`amount\` - **RECOMMENDED** for most use cases  
- \`base_amount\` - Alternative name (works identically)

⚠️ **IMPORTANT:** Only provide ONE of each field type. If both are provided, \`base_*\` fields take priority.

**PAYMENT MODES:**
Modes must be provided in **UPPERCASE**. Valid modes:
- \`CRYPTO\` - Cryptocurrency payments
- \`CARD\` - Credit/debit card payments
- \`BANK_TRANSFER\` - Bank transfer
- \`GOOGLE_PAY\` - Google Pay
- \`APPLE_PAY\` - Apple Pay
- \`USSD\` - USSD payments
- \`MOBILE_MONEY\` - Mobile money
- \`QR_CODE\` - QR code payments

**EXPIRATION OPTIONS:**
- \`24h\` - Link expires in 24 hours
- \`7d\` - Link expires in 7 days (DEFAULT if not specified)
- \`30d\` - Link expires in 30 days
- \`No\` - Link never expires`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'company_id'],
              properties: {
                amount: { 
                  type: 'number', 
                  description: '✅ REQUIRED: Payment amount. Provide this OR base_amount',
                  example: 100.00,
                  minimum: 0.01
                },
                base_amount: { 
                  type: 'number', 
                  description: '✅ REQUIRED (alternative): Payment amount. Provide this OR amount',
                  example: 100.00,
                  minimum: 0.01
                },
                currency: { 
                  type: 'string', 
                  enum: [
                    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
                    'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
                    'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
                    'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF',
                    'BTC', 'LTC', 'DOGE'
                  ], 
                  description: '📝 OPTIONAL: Currency code (defaults to "USD"). Supports 35+ international, Latin American, and African currencies.',
                  example: 'USD',
                  default: 'USD'
                },
                base_currency: { 
                  type: 'string', 
                  enum: [
                    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
                    'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
                    'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
                    'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF',
                    'BTC', 'LTC', 'DOGE'
                  ], 
                  description: '📝 OPTIONAL: Currency code (alternative field name, defaults to "USD")',
                  example: 'USD',
                  default: 'USD'
                },
                company_id: { 
                  type: 'integer', 
                  description: '✅ REQUIRED: Company ID for multi-tenant isolation. Specifies which company this payment link belongs to. Get your company_id from GET /api/company/getCompany endpoint.',
                  example: 1
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '📝 OPTIONAL: Customer email for payment notifications and receipts',
                  example: 'customer@example.com'
                },
                name: {
                  type: 'string',
                  description: '👤 OPTIONAL: Customer name - identifies who the payment link is for. Displayed on the checkout page.',
                  example: 'John Smith'
                },
                modes: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE']
                  },
                  description: '📝 OPTIONAL: Payment modes (defaults to ["CRYPTO"]). Must be UPPERCASE',
                  example: ['CRYPTO'],
                  default: ['CRYPTO']
                },
                description: { 
                  type: 'string', 
                  description: '📝 OPTIONAL: Payment description shown to customer',
                  example: 'Order #12345 - Premium Subscription'
                },
                expire: {
                  type: 'string',
                  enum: ['24h', '7d', '30d', 'No'],
                  description: '📝 OPTIONAL: Link expiration period. Defaults to "7d" (7 days) if not specified. Use "No" for never expires.',
                  example: '7d',
                  default: '7d'
                },
                callback_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: '🔗 OPTIONAL: URL to call after payment completion',
                  example: 'https://example.com/callback'
                },
                redirect_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: '↪️ OPTIONAL: URL to redirect customer after successful payment',
                  example: 'https://example.com/success'
                },
                webhook_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: `📡 OPTIONAL: URL to receive payment status webhooks (per-link override).
                  
**Webhook Events:**
- \`payment.pending\` - Payment detected on blockchain, awaiting confirmations
- \`payment.confirmed\` - Payment fully confirmed and processed
- \`payment.underpaid\` - Partial payment received, awaiting remainder

**Note:** If not set, webhooks will be sent to the company's default webhook URL (configured via /api/company/webhook-settings).

**Headers Included:**
- \`X-Dynopay-Event\` - Event type
- \`X-DynoPay-Signature\` - HMAC signature (if webhook_secret configured)
- \`X-Dynopay-Timestamp\` - Unix timestamp
- \`X-Dynopay-Webhook-Id\` - Unique delivery ID
- \`X-Dynopay-Type\` - 'webhook' or 'callback'

**Enhanced Webhook Payload (payment.confirmed):**
\`\`\`json
{
  "event": "payment.confirmed",
  "payment_id": "uuid-here",
  "transaction_reference": "0xabc123...",
  "status": "processing",
  "amount": 0.042,
  "currency": "ETH",
  "base_amount": 100,
  "base_currency": "USD",
  "merchant_amount": 0.0399,
  "total_fee": 0.0021,
  "total_fee_usd": 5.00,
  "fee_payer": "company",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "description": "Order #12345",
  "link_id": 411,
  "tax_info": {
    "tax_amount_usd": 23.00,
    "tax_amount_crypto": 0.0097,
    "tax_rate": 23,
    "tax_country_code": "PT"
  },
  "overpayment": null,
  "meta_data": null,
  "completed_at": "2026-02-04T13:02:37.960Z"
}
\`\`\`

**Enhanced Webhook Fields:**
| Field | Type | Description |
|-------|------|-------------|
| \`merchant_amount\` | number | Net amount merchant receives (crypto) |
| \`total_fee\` | number | Total fees charged (crypto) |
| \`total_fee_usd\` | number | Total fees in USD |
| \`fee_payer\` | string | Who paid fees: 'customer' or 'company' |
| \`customer_name\` | string | Customer name (if provided) |
| \`customer_email\` | string | Customer email |
| \`description\` | string | Payment description |
| \`link_id\` | number | Payment link ID |
| \`tax_info\` | object/null | Tax details if tax was applied |
| \`overpayment\` | object/null | Overpayment details if customer overpaid |`,
                  example: 'https://example.com/webhook'
                },
                fee_payer: {
                  type: 'string',
                  enum: ['customer', 'company'],
                  description: `💰 OPTIONAL: Who pays blockchain/network fees.

**Options:**
- \`company\` (default) - Fees deducted from merchant's portion
- \`customer\` - Customer pays additional amount to cover fees

**Example (customer pays fees):**
- Base amount: $10.00
- Admin fee (33%): $3.30  
- Customer total: $13.30
- Merchant receives: $10.00 (full base amount)`,
                  example: 'company',
                  default: 'company'
                },
                apply_tax: {
                  type: 'boolean',
                  description: `🧾 OPTIONAL: Enable automatic tax calculation based on customer's location.

**When enabled:**
- Customer's country is auto-detected from IP at checkout
- Tax rate (VAT/GST/Sales Tax) is fetched for that country
- Tax is added to the payment total
- Tax goes to merchant (for remittance to tax authority)

**Default:** \`false\` (no tax applied)

**Example (Portuguese customer, 23% VAT):**
- Base amount: €100.00
- VAT (23%): €23.00
- Customer total: €123.00
- Merchant receives: base + tax = €123.00 (67% of base + full tax if company pays fees)`,
                  example: false,
                  default: false
                },
                accepted_currencies: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON']
                  },
                  description: `🪙 OPTIONAL: Specific cryptocurrencies to accept for this payment link.

**When NOT provided (null):**
- All cryptocurrencies with configured wallets are accepted
- Customer can choose from any configured wallet

**When provided:**
- Only the specified currencies are available at checkout
- Each currency must have a configured wallet (validation will fail otherwise)

**Supported Currencies:**
- \`BTC\` - Bitcoin
- \`ETH\` - Ethereum
- \`LTC\` - Litecoin
- \`DOGE\` - Dogecoin
- \`TRX\` - Tron
- \`BCH\` - Bitcoin Cash
- \`USDT-TRC20\` - Tether on Tron network
- \`USDT-ERC20\` - Tether on Ethereum network
- \`USDC-ERC20\` - USD Coin on Ethereum network

**Use Case:** Limit payment options when you only want to receive specific cryptocurrencies.`,
                  example: ['BTC', 'ETH', 'USDT-TRC20'],
                  nullable: true
                }
              }
            },
            examples: {
              'Minimal Required': {
                summary: '⚡ MINIMAL: Required fields only (amount + company_id)',
                value: {
                  amount: 10.00,
                  company_id: 38
                }
              },
              'With Customer Email': {
                summary: '📧 SIMPLE: Amount + company + customer email',
                value: {
                  amount: 50.00,
                  company_id: 38,
                  email: 'customer@example.com'
                }
              },
              'Standard Payment': {
                summary: '💡 STANDARD: Common use case with description',
                value: {
                  amount: 100.00,
                  company_id: 38,
                  currency: 'USD',
                  email: 'customer@example.com',
                  description: 'Order #12345'
                }
              },
              'With Tax Enabled': {
                summary: '🧾 TAX: Auto-calculate tax based on customer location',
                value: {
                  amount: 100.00,
                  company_id: 38,
                  currency: 'EUR',
                  email: 'customer@example.com',
                  description: 'Digital Product - Pro Plan',
                  apply_tax: true
                }
              },
              'Customer Pays Fees': {
                summary: '💰 FEES: Customer pays processing fees',
                value: {
                  amount: 50.00,
                  company_id: 38,
                  email: 'customer@example.com',
                  fee_payer: 'customer',
                  description: 'Service Fee - Customer Absorbs Fees'
                }
              },
              'With Expiration': {
                summary: '⏰ EXPIRY: Link expires in 24 hours',
                value: {
                  amount: 199.99,
                  company_id: 38,
                  email: 'customer@example.com',
                  description: 'Limited Time Offer',
                  expire: '24h'
                }
              },
              'Full Configuration': {
                summary: '🔧 COMPLETE: All options configured',
                value: {
                  amount: 199.99,
                  currency: 'USD',
                  company_id: 38,
                  name: 'John Smith',
                  email: 'customer@example.com',
                  modes: ['CRYPTO'],
                  description: 'Premium Subscription - Annual',
                  expire: '7d',
                  fee_payer: 'customer',
                  apply_tax: true,
                  callback_url: 'https://myapp.com/api/payment-callback',
                  redirect_url: 'https://myapp.com/thank-you',
                  webhook_url: 'https://myapp.com/webhooks/payment'
                }
              },
              'With Customer Name': {
                summary: '👤 NAMED: Payment for specific customer',
                value: {
                  amount: 150.00,
                  company_id: 38,
                  name: 'Alice Johnson',
                  email: 'alice@example.com',
                  description: 'Invoice #INV-2026-001'
                }
              },
              'Crypto Only Payment': {
                summary: '₿ CRYPTO: Bitcoin payment with webhook',
                value: {
                  amount: 0.001,
                  company_id: 38,
                  currency: 'BTC',
                  email: 'crypto@example.com',
                  description: 'BTC Payment - Invoice #001',
                  expire: '30d',
                  webhook_url: 'https://myapp.com/webhooks/payment'
                }
              },
              'Specific Currencies': {
                summary: '🪙 SELECTIVE: Only accept BTC, ETH, USDT',
                value: {
                  amount: 100.00,
                  company_id: 38,
                  currency: 'USD',
                  email: 'customer@example.com',
                  description: 'Payment with limited crypto options',
                  accepted_currencies: ['BTC', 'ETH', 'USDT-TRC20']
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment link created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      link_id: { type: 'string', format: 'uuid' },
                      payment_url: { type: 'string', format: 'uri' },
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      status: { type: 'string' },
                      customer_name: { type: 'string', nullable: true, description: 'Customer name if provided' },
                      created_at: { type: 'string', format: 'date-time' },
                      expires_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              },
              example: {
                message: 'Payment link created successfully',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  customer_name: 'John Smith',
                  status: 'active',
                  created_at: '2024-01-15T10:30:00Z',
                  expires_at: null
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request',
          content: {
            'application/json': {
              example: { message: 'Amount must be greater than 0', error: true }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },
  '/api/pay/getPaymentLinks': {
    get: {
      tags: ['Payments'],
      summary: 'Get all payment links',
      description: `Retrieve all payment links for the authenticated user with pagination and filtering.

**Multi-Tenant Filtering:**
- Omit \`company_id\` to get payment links from ALL your companies
- Provide \`company_id\` to filter payment links for a specific company

**Response includes company_id** for client-side filtering if needed.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        { 
          in: 'query', 
          name: 'company_id', 
          schema: { type: 'integer' }, 
          description: '📝 OPTIONAL: Filter by company ID. Omit to get all companies.' 
        },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'paid', 'expired', 'cancelled'] } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
      ],
      responses: {
        200: {
          description: 'Payment links retrieved',
          content: {
            'application/json': {
              example: {
                message: 'Payment links retrieved',
                data: {
                  links: [
                    {
                      link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      amount: 199.99,
                      currency: 'USD',
                      description: 'Order #12345',
                      status: 'paid',
                      payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4...',
                      created_at: '2024-01-15T10:30:00Z',
                      paid_at: '2024-01-15T10:45:00Z'
                    },
                    {
                      link_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                      amount: 50.00,
                      currency: 'USD',
                      description: 'Consultation Fee',
                      status: 'active',
                      payment_url: 'https://checkout.dynopay.com/pay/b2c3d4e5...',
                      created_at: '2024-01-16T09:00:00Z',
                      expires_at: '2024-01-23T09:00:00Z'
                    }
                  ],
                  pagination: { total: 25, page: 1, limit: 20, totalPages: 2 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/links/{id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get payment link by ID',
      description: 'Retrieve detailed information about a specific payment link',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      }],
      responses: {
        200: {
          description: 'Payment link details',
          content: {
            'application/json': {
              example: {
                message: 'Payment link retrieved',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  description: 'Order #12345 - Premium Subscription',
                  status: 'paid',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  redirect_url: 'https://mystore.com/order/12345/success',
                  webhook_url: 'https://mystore.com/webhooks/dynopay',
                  metadata: { order_id: '12345', customer_email: 'customer@example.com' },
                  created_at: '2024-01-15T10:30:00Z',
                  paid_at: '2024-01-15T10:45:00Z',
                  transaction: {
                    transaction_id: 'txn_abc123',
                    crypto_currency: 'BTC',
                    crypto_amount: 0.00456,
                    confirmations: 3,
                    tx_hash: '0x1234567890abcdef...'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment link not found',
          content: {
            'application/json': {
              example: { message: 'Payment link not found', error: true }
            }
          }
        }
      }
    },
    put: {
      tags: ['Payments'],
      summary: 'Update payment link',
      description: 'Update an existing payment link (only active links can be updated)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                redirect_url: { type: 'string', format: 'uri' },
                webhook_url: { type: 'string', format: 'uri' },
                expires_at: { type: 'string', format: 'date-time' },
                status: { type: 'string', enum: ['active', 'cancelled'] }
              }
            },
            example: {
              description: 'Updated: Order #12345 - Premium Subscription (Discounted)',
              expires_at: '2024-02-15T23:59:59Z'
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment link updated' },
        400: { description: 'Cannot update paid or expired links' },
        404: { description: 'Payment link not found' }
      }
    }
  },
  '/api/pay/deletePaymentLink/{id}': {
    delete: {
      tags: ['Payments'],
      summary: 'Delete payment link',
      description: 'Delete/cancel a payment link (only active unpaid links can be deleted)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      responses: {
        200: {
          description: 'Payment link deleted',
          content: {
            'application/json': {
              example: { message: 'Payment link deleted successfully' }
            }
          }
        },
        400: { description: 'Cannot delete paid links' },
        404: { description: 'Payment link not found' }
      }
    }
  },

  // ==================== PAYMENT PROCESSING ====================
  '/api/pay/getData': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get payment data for checkout',
      description: `Retrieve payment information for checkout page. Called when customer opens a payment link.

**Enhanced Response Includes:**
- Order details (description, invoice reference)
- Merchant branding (company name, logo)
- Fee breakdown (subtotal, processing fee, who pays)
- Tax calculation (if merchant enabled \`apply_tax\`)
- Link expiry with countdown
- Redirect URL for post-payment
- **Available currencies** (new!) - filtered list based on merchant's \`accepted_currencies\` selection
- **Payment timing settings**

**Available Currencies:**
The response includes \`available_currencies\` array when the merchant specified currency restrictions:
- If merchant set \`accepted_currencies: ["BTC", "ETH"]\` when creating the payment link, only those will be returned
- If no restriction was set, this field will be absent (call \`/configured-currencies\` endpoint instead)
- Frontend should use this to filter the cryptocurrency selector

**Payment Timing Settings (Payment Links only — Direct API ignores these):**
The response includes \`payment_settings\` object with:
- \`initial_window_minutes\`: Time to complete payment after selecting crypto (default: 15 min)
- \`grace_period_minutes\`: Time to complete partial payment (default: 30 min, max: 30 min, configurable per company)
- \`overpayment_threshold_usd\`: Minimum overpayment to trigger special handling (default: $5, configurable per company)
- \`underpayment_threshold_usd\`: Maximum underpayment to accept as full payment (default: $1, configurable per company)

**Tax Calculation:**
When \`apply_tax: true\` was set during payment link creation:
- Customer's country is auto-detected from IP
- Tax rate (VAT/GST) is fetched and calculated
- Response includes \`tax_info\` object with breakdown`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['data'],
              properties: {
                data: { type: 'string', description: 'Payment link reference (from URL parameter d)' }
              }
            },
            example: {
              data: 'a1b2c3d4e5f67890abcdef1234567890abcdef12'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment data retrieved',
          content: {
            'application/json': {
              examples: {
                'Standard Response': {
                  summary: 'Payment link without tax',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 50,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      customer_name: 'John Smith',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      order_reference: 'INV-2026-A1B2C3',
                      description: 'Order #12345 - Premium Subscription',
                      available_currencies: ['BTC', 'ETH', 'USDT-TRC20'],
                      merchant: {
                        company_name: 'My Online Store',
                        company_logo: 'https://mystore.com/logo.png'
                      },
                      payment_settings: {
                        initial_window_minutes: 15,
                        grace_period_minutes: 30,
                        overpayment_threshold_usd: 5,
                        underpayment_threshold_usd: 1
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-02-07T10:30:00Z',
                        is_expired: false,
                        countdown: {
                          days: 6,
                          hours: 23,
                          minutes: 45,
                          seconds: 30,
                          formatted: '6d : 23h : 45m : 30s'
                        }
                      },
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: false,
                      redirect_url: 'https://mystore.com/success'
                    }
                  }
                },
                'With Tax Enabled (Customer in Portugal)': {
                  summary: 'Payment with auto-calculated VAT',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 100,
                      base_currency: 'EUR',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      transaction_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                      order_reference: 'INV-2026-X7Y8Z9',
                      description: 'Digital Product - Pro Plan',
                      merchant: {
                        company_name: 'SaaS Company',
                        company_logo: 'https://saas.com/logo.png'
                      },
                      payment_settings: {
                        initial_window_minutes: 15,
                        grace_period_minutes: 30,
                        overpayment_threshold_usd: 5,
                        underpayment_threshold_usd: 1
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-02-07T10:30:00Z',
                        is_expired: false,
                        countdown: {
                          days: 7,
                          hours: 0,
                          minutes: 0,
                          seconds: 0,
                          formatted: '7d : 00h : 00m : 00s'
                        }
                      },
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: true,
                      tax_info: {
                        tax_enabled: true,
                        tax_rate: 23,
                        tax_acronym: 'VAT',
                        tax_amount: 23.00,
                        country_code: 'PT',
                        country_name: 'Portugal',
                        subtotal: 100.00,
                        total: 123.00,
                        currency: 'EUR'
                      },
                      redirect_url: 'https://saas.com/thank-you'
                    }
                  }
                },
                'Customer Pays Fees': {
                  summary: 'Fee breakdown when customer pays',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 50,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'customer',
                      transaction_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                      order_reference: 'INV-2026-FEE123',
                      description: 'Consulting Service',
                      merchant: {
                        company_name: 'Consulting Co',
                        company_logo: null
                      },
                      fee_info: {
                        fee_payer: 'customer',
                        processing_fee: 4.55,
                        total_amount: 54.55
                      },
                      expiry: null,
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: false
                    }
                  }
                },
                'Expired Link': {
                  summary: 'Payment link has expired',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 100,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      transaction_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
                      order_reference: 'INV-2026-EXP456',
                      description: 'Expired Order',
                      merchant: {
                        company_name: 'Test Store',
                        company_logo: null
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-01-30T10:30:00Z',
                        is_expired: true,
                        countdown: null
                      },
                      created_at: '2026-01-23T10:30:00Z',
                      apply_tax: false
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment not found or expired',
          content: {
            'application/json': {
              example: { message: 'Payment link not found or expired', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/createCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate crypto payment',
      description: `Customer selects cryptocurrency and receives a deposit address. The system monitors this address for incoming payments.

**Authentication:**
This endpoint requires a **customer token** (not merchant JWT). The customer token is returned in the \`getData\` response as the \`token\` field.

**Request Parameters:**
- \`uniqueRef\`: The payment reference (same as the "d" URL parameter from payment link)
- \`currency\`: The cryptocurrency to pay with (BTC, ETH, USDT-TRC20, etc.)

**Tax Handling:**
If the payment link has \`apply_tax: true\`, the crypto amount will include the calculated tax based on customer's detected location.

**Amount Calculation:**
- Base amount + Tax (if enabled) + Processing fee (if customer pays) = Total crypto amount`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['uniqueRef', 'currency'],
              properties: {
                uniqueRef: { type: 'string', description: 'Payment reference from getData response (the "d" URL parameter)' },
                currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'], description: 'Cryptocurrency to pay with' },
                customer_email: { type: 'string', format: 'email', description: 'Optional: for payment receipt' }
              }
            },
            examples: {
              'Bitcoin Payment': {
                summary: 'Pay with BTC',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'BTC',
                  customer_email: 'customer@example.com'
                }
              },
              'USDT on Tron': {
                summary: 'Pay with USDT (TRC20)',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'USDT-TRC20'
                }
              },
              'Ethereum Payment': {
                summary: 'Pay with ETH',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'ETH',
                  customer_email: 'customer@example.com'
                }
              },
              'XRP Payment': {
                summary: 'Pay with XRP (tag-based)',
                description: 'XRP uses a shared master address with a unique destination tag per payment. The destination_tag MUST be included when sending the transaction.',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'XRP',
                  customer_email: 'customer@example.com'
                }
              },
              'RLUSD Payment': {
                summary: 'Pay with RLUSD (XRP Ledger)',
                description: 'RLUSD on XRP Ledger — uses destination tag addressing like XRP.',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'RLUSD'
                }
              },
              'Solana Payment': {
                summary: 'Pay with SOL',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'SOL'
                }
              },
              'Polygon Payment': {
                summary: 'Pay with POL (Polygon)',
                value: {
                  uniqueRef: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
                  currency: 'POLYGON'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment initiated - deposit address generated',
          content: {
            'application/json': {
              examples: {
                'Standard Response (No Tax)': {
                  summary: 'Crypto address without tax',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      amount: 0.00456789,
                      base_amount: 199.99,
                      base_currency: 'USD',
                      rate: 0.0000228,
                      merchant_amount: 0.00306,
                      fees: 0.00151,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 1,
                      is_merchant_pool: true,
                      remaining_minutes: 15
                    }
                  }
                },
                'With Tax (Portuguese Customer)': {
                  summary: 'Crypto amount includes 23% VAT',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                      amount: 0.0615,
                      base_amount: 100.00,
                      base_currency: 'EUR',
                      rate: 0.0005,
                      merchant_amount: 0.0515,
                      fees: 0.01,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 2,
                      is_merchant_pool: true,
                      remaining_minutes: 15,
                      tax_info: {
                        tax_amount: 23.00,
                        tax_amount_crypto: 0.0115,
                        tax_rate: 23,
                        tax_acronym: 'VAT',
                        country_code: 'PT'
                      }
                    }
                  }
                },
                'USDT-TRC20 Response': {
                  summary: 'USDT TRC20 deposit address',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: 'TN7cWz1s5p5XKT8KJhKjZ8EWPH4v8hGhqN',
                      amount: 199.99,
                      base_amount: 199.99,
                      base_currency: 'USD',
                      rate: 1.00,
                      merchant_amount: 133.99,
                      fees: 66.00,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 3,
                      is_merchant_pool: true,
                      remaining_minutes: 15,
                      network: 'Tron (TRC20)'
                    }
                  }
                },
                'XRP Response (Tag-Based)': {
                  summary: '⚠️ XRP with destination tag — MUST include tag when sending',
                  description: 'XRP/RLUSD payments use a shared master address with a unique destination_tag per payment. The destination_tag MUST be included in the XRP transaction memo/tag field, otherwise the payment cannot be attributed.',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
                      destination_tag: 847291,
                      amount: 42.5,
                      base_amount: 100.00,
                      base_currency: 'USD',
                      rate: 2.35,
                      merchant_amount: 41.5,
                      fees: 1.0,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 4,
                      is_merchant_pool: true,
                      remaining_minutes: 15,
                      network: 'XRP Ledger',
                      tag_warning: '⚠️ You MUST include destination tag 847291 when sending XRP'
                    }
                  }
                },
                'SOL Response': {
                  summary: 'Solana deposit address',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                      amount: 0.667,
                      base_amount: 100.00,
                      base_currency: 'USD',
                      rate: 0.00667,
                      merchant_amount: 0.647,
                      fees: 0.02,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 5,
                      is_merchant_pool: true,
                      remaining_minutes: 15,
                      network: 'Solana'
                    }
                  }
                },
                'POLYGON Response': {
                  summary: 'Polygon deposit address',
                  value: {
                    message: 'Payment created successfully',
                    data: {
                      hash: 'customer-a1b2c3d4e5f67890abcdef1234567890abcdef12',
                      address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
                      amount: 250.5,
                      base_amount: 100.00,
                      base_currency: 'USD',
                      rate: 2.505,
                      merchant_amount: 245.5,
                      fees: 5.0,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      temp_id: 6,
                      is_merchant_pool: true,
                      remaining_minutes: 15,
                      network: 'Polygon'
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid currency or payment already processed',
          content: {
            'application/json': {
              example: { message: 'Unsupported cryptocurrency', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify crypto payment status',
      description: `Check the status of a cryptocurrency payment. Poll this endpoint to show payment progress to customers.
      
**Status Flow:**
- \`waiting\` - No payment detected yet on blockchain
- \`pending\` - Payment detected, awaiting blockchain confirmations
- \`underpaid\` - Partial payment received, waiting for remaining amount (customer sent less than expected)
- \`confirmed\` - Payment fully confirmed and processed (exact amount)
- \`overpaid\` - Payment confirmed but customer paid more than required
- \`failed\` - Payment processing failed

**USD Amounts:** All responses include USD-equivalent amounts for display purposes.

**Underpayment Handling:** When status is \`underpaid\`, the \`address\` field is returned so customer can send remaining payment to the SAME address within the grace period.

**Recommended Polling Interval:** 5-10 seconds`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address'],
              properties: {
                address: { 
                  type: 'string',
                  description: 'The cryptocurrency deposit address to check'
                }
              }
            },
            example: {
              address: '0x5c8282c96a89f002b908668bab6d5d30c68b610e'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment status retrieved',
          content: {
            'application/json': {
              examples: {
                'Waiting for Payment': {
                  summary: '🕐 No payment detected yet',
                  value: {
                    message: 'Waiting for payment',
                    data: {
                      status: 'waiting',
                      message: 'Payment address generated, waiting for transaction',
                      expected_amount: '0.005470',
                      currency: 'ETH'
                    }
                  }
                },
                'Payment Pending': {
                  summary: '⏳ Payment detected, awaiting confirmation',
                  value: {
                    message: 'Payment pending',
                    data: {
                      status: 'pending',
                      message: 'Payment detected, awaiting confirmation',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      amount: '0.005470',
                      expected_amount: '0.005470',
                      currency: 'ETH'
                    }
                  }
                },
                'Underpaid (Partial Payment)': {
                  summary: '⚠️ Partial payment received - customer needs to pay more',
                  value: {
                    message: 'Partial payment received',
                    data: {
                      status: 'underpaid',
                      message: 'Partial payment received. Please pay the remaining amount.',
                      paidAmount: 0.002,
                      expectedAmount: 0.00547,
                      remainingAmount: 0.00347,
                      currency: 'ETH',
                      paidAmountUsd: 5.48,
                      expectedAmountUsd: 15.00,
                      remainingAmountUsd: 9.52,
                      baseCurrency: 'USD',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      address: '0x5c8282c96a89f002b908668bab6d5d30c68b610e',
                      grace_period_minutes: 30,
                      partial_payment_timestamp: '2026-01-30T12:39:35.104Z'
                    }
                  }
                },
                'Payment Confirmed': {
                  summary: '✅ Payment confirmed and completed (exact amount)',
                  value: {
                    message: 'Payment confirmed',
                    data: {
                      status: 'confirmed',
                      message: 'Payment confirmed',
                      redirect: 'https://mystore.com/order/12345/success',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      paidAmount: 0.00547,
                      expectedAmount: 0.00547,
                      currency: 'ETH',
                      paidAmountUsd: 15.00,
                      expectedAmountUsd: 15.00,
                      baseCurrency: 'USD',
                      completedAt: '2026-01-30T12:45:00.000Z'
                    }
                  }
                },
                'Overpaid': {
                  summary: '💰 Payment confirmed with excess - customer paid more than required',
                  value: {
                    message: 'Payment confirmed with overpayment',
                    data: {
                      status: 'overpaid',
                      message: 'Payment confirmed with overpayment',
                      redirect: 'https://mystore.com/order/12345/success',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      paidAmount: 0.00647,
                      expectedAmount: 0.00547,
                      excessAmount: 0.001,
                      currency: 'ETH',
                      paidAmountUsd: 17.74,
                      expectedAmountUsd: 15.00,
                      excessAmountUsd: 2.74,
                      baseCurrency: 'USD',
                      completedAt: '2026-01-30T12:45:00.000Z'
                    }
                  }
                },
                'Payment Failed': {
                  summary: '❌ Payment processing failed',
                  value: {
                    message: 'Payment failed',
                    data: {
                      status: 'failed',
                      message: 'Transaction verification failed',
                      txId: '0x7a91f8b2c3d4e5f6...'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/confirmPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Confirm payment completion',
      description: 'Finalize and confirm a completed payment. Triggers webhook notification to merchant.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment confirmed',
          content: {
            'application/json': {
              example: {
                message: 'Payment confirmed successfully',
                data: {
                  status: 'completed',
                  redirect_url: 'https://mystore.com/order/12345/success'
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== FIAT PAYMENTS ====================
  '/api/pay/addPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate fiat payment',
      description: 'Create fiat (card/bank) payment via Flutterwave',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'payment_mode'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' },
                payment_mode: { type: 'string', enum: ['CARD', 'BANK'] },
                customer: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    phone: { type: 'string' }
                  }
                }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              payment_mode: 'CARD',
              customer: {
                email: 'customer@example.com',
                name: 'John Doe',
                phone: '+1234567890'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fiat payment initiated',
          content: {
            'application/json': {
              example: {
                message: 'Payment initiated',
                data: {
                  payment_url: 'https://checkout.flutterwave.com/v3/hosted/pay/xyz123',
                  reference: 'FLW-TXN-123456'
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify fiat payment',
      description: 'Verify fiat payment status after redirect from payment provider',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment verification result',
          content: {
            'application/json': {
              examples: {
                'Successful': {
                  value: {
                    status: 'successful',
                    message: 'Payment completed',
                    data: { redirect_url: 'https://mystore.com/success' }
                  }
                },
                'Pending': {
                  value: {
                    status: 'pending',
                    message: 'Payment is being processed'
                  }
                },
                'Failed': {
                  value: {
                    status: 'failed',
                    message: 'Payment was declined'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== UTILITIES ====================
  '/api/pay/getCurrencyRates': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get currency exchange rates',
      description: 'Retrieve current crypto-to-fiat exchange rates with calculated totals when customer pays fees',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Source currency (e.g., USD)' },
                amount: { type: 'number', description: 'Amount in source currency' },
                currencyList: { type: 'array', items: { type: 'string' }, description: 'List of target currencies' },
                fee_payer: { type: 'string', enum: ['customer', 'company'], description: 'Who pays the fees' }
              }
            },
            example: { 
              source: 'USD', 
              amount: 50,
              currencyList: ['BTC', 'ETH', 'USDT-TRC20'],
              fee_payer: 'customer'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Exchange rates with totals',
          content: {
            'application/json': {
              example: {
                message: 'Exchange rates retrieved successfully',
                data: [
                  {
                    currency: 'ETH',
                    amount: '0.01650000',
                    fee_payer: 'customer',
                    base_amount: 0.0155,
                    base_amount_usd: 50,
                    processing_fee: 4.55,
                    total_amount: '0.01650000',
                    total_amount_usd: 54.55,
                    total_amount_source: 54.55
                  },
                  {
                    currency: 'BTC',
                    amount: '0.00055000',
                    fee_payer: 'customer',
                    base_amount: 0.0005,
                    base_amount_usd: 50,
                    processing_fee: 4.55,
                    total_amount: '0.00055000',
                    total_amount_usd: 54.55,
                    total_amount_source: 54.55
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/network-fees': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get blockchain network fees',
      description: 'Retrieve current blockchain transaction fees for supported networks',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'] },
        required: true,
        example: 'BTC'
      }],
      responses: {
        200: {
          description: 'Network fees',
          content: {
            'application/json': {
              example: {
                data: {
                  currency: 'BTC',
                  slow: { fee: 5, time: '60 minutes', satoshi_per_byte: 10 },
                  medium: { fee: 12, time: '30 minutes', satoshi_per_byte: 25 },
                  fast: { fee: 25, time: '10 minutes', satoshi_per_byte: 50 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/calculate-payment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Calculate payment amount',
      description: 'Calculate total payment amount including processing fees',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount_usd', 'chain'],
              properties: {
                amount_usd: { type: 'number', description: 'Amount in USD' },
                chain: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'] },
                fee_payer: { type: 'string', enum: ['customer', 'company'], default: 'customer' }
              }
            },
            examples: {
              'Customer Pays Fees': {
                value: {
                  amount_usd: 100,
                  chain: 'ETH',
                  fee_payer: 'customer'
                }
              },
              'Company Absorbs Fees': {
                value: {
                  amount_usd: 100,
                  chain: 'BTC',
                  fee_payer: 'company'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment calculation',
          content: {
            'application/json': {
              example: {
                message: 'Payment amount calculated',
                data: {
                  fee_payer: 'customer',
                  base_amount_usd: 100,
                  base_amount_crypto: 0.0303,
                  processing_fee: 5.0,
                  total_amount_crypto: 0.0318,
                  total_amount_usd: 105.0,
                  crypto_currency: 'ETH',
                  crypto_price_usd: 3300
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/getBalance': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get customer balance',
      description: 'Retrieve customer wallet balance',
      parameters: [{
        in: 'query',
        name: 'customer_id',
        schema: { type: 'string' },
        required: true
      }],
      responses: {
        200: {
          description: 'Balance retrieved',
          content: {
            'application/json': {
              example: {
                data: {
                  balances: [
                    { currency: 'BTC', balance: 0.05234, usd_value: 2295.12 },
                    { currency: 'ETH', balance: 1.234, usd_value: 2883.09 },
                    { currency: 'USDT', balance: 500.00, usd_value: 500.00 }
                  ],
                  total_usd: 5678.21
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== WEBHOOKS ====================
  
  // MERCHANT WEBHOOK DOCUMENTATION - DEPRECATED
  // See 📡 Webhooks section for updated documentation
  '/webhooks/merchant-endpoint-legacy': {
    post: {
      tags: ['🗄️ Webhook Logs'],
      summary: '⚠️ DEPRECATED - See 📡 Webhooks section',
      description: `**⚠️ DEPRECATED DOCUMENTATION**

This documentation is outdated. Please refer to the **📡 Webhooks** section for:
- Current webhook payload structures
- All enhanced fields (merchant_amount, total_fee, customer_name, etc.)
- Payment Link vs Direct API webhook differences
- Integration guides and code examples

The 📡 Webhooks section contains the latest webhook documentation.`,
      requestBody: {
        description: 'See 📡 Webhooks section for current payload structures',
        content: {
          'application/json': {
            examples: {
              'deprecated': {
                summary: '⚠️ See 📡 Webhooks section',
                value: {
                  message: "This documentation is deprecated. Please refer to the 📡 Webhooks section for current webhook payload structures."
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'See 📡 Webhooks section for current documentation'
        }
      }
    }
  },
  
  
  '/api/crypto-webhook': {
    post: {
      tags: ['🔧 Internal'],
      summary: 'Blockchain webhook (Internal)',
      description: `**Internal endpoint** - receives blockchain transaction notifications.

### Multi-Tenant Routing

This endpoint uses multi-tenant routing for payment processing. When a crypto address is reserved for a payment, the subscription URL is dynamically updated to include tenant information as query parameters.

**Webhook URL Format:**
\`\`\`
/api/crypto-webhook?company_id={companyId}&user_id={userId}&address_id={addressId}
\`\`\`

### How it Works:
1. When \`reserveAddressFromPool\` is called, it updates the subscription URL with company info
2. When a deposit is detected, the blockchain provider calls this endpoint with the encoded parameters
3. The webhook handler extracts \`company_id\`, \`user_id\`, \`address_id\` from query params
4. Payment is processed and routed to the correct merchant/company

### Benefits:
- ✅ Multi-tenant routing without per-company backends
- ✅ Tenant info encoded directly in webhook URL
- ✅ Subscription URL updated synchronously when address is reserved
- ✅ Fallback to Redis data if query params missing`,
      parameters: [
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Company/merchant ID for multi-tenant routing',
          example: 38
        },
        {
          in: 'query',
          name: 'user_id',
          schema: { type: 'integer' },
          description: 'User ID (merchant owner)',
          example: 28
        },
        {
          in: 'query',
          name: 'address_id',
          schema: { type: 'integer' },
          description: 'Pool address ID (temp_address_id)',
          example: 5
        }
      ],
      requestBody: {
        description: 'Blockchain ADDRESS_EVENT webhook payload',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                subscriptionType: { type: 'string', description: 'Always ADDRESS_EVENT' },
                address: { type: 'string', description: 'Crypto address that received deposit' },
                counterAddress: { type: 'string', description: 'Sender address' },
                txId: { type: 'string', description: 'Blockchain transaction hash' },
                amount: { type: 'string', description: 'Amount received' },
                asset: { type: 'string', description: 'Asset/currency (ETH, BTC, etc.)' },
                blockNumber: { type: 'integer', description: 'Block number of transaction' }
              },
              required: ['address', 'txId', 'amount']
            },
            examples: {
              'BTC Deposit': {
                summary: 'Bitcoin deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                  txId: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                  amount: '0.00456789',
                  asset: 'BTC',
                  blockNumber: 823456
                }
              },
              'ETH Deposit': {
                summary: 'Ethereum deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                  counterAddress: '0xSenderAddress123...',
                  txId: '0xabc123def456789...',
                  amount: '0.085',
                  asset: 'ETH',
                  blockNumber: 19234567
                }
              },
              'USDT-TRC20 Deposit': {
                summary: 'USDT (Tron) deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: 'TN7cWz1s5p5XKT8KJhKjZ8EWPH4v8hGhqN',
                  txId: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
                  amount: '199.99',
                  asset: 'USDT',
                  blockNumber: 58234567
                }
              }
            }
          }
        }
      },
      responses: {
        200: { 
          description: 'Webhook processed successfully',
          content: {
            'text/plain': {
              example: 'OK'
            }
          }
        }
      }
    }
  },
  '/api/pay/getCurrencyRatesInternal': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get internal currency rates',
      description: 'Internal endpoint for service-to-service rate queries',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: { type: 'array', items: { type: 'string' } }
              }
            },
            example: { currencies: ['BTC', 'ETH', 'USDT'] }
          }
        }
      },
      responses: {
        200: { description: 'Internal rates retrieved' }
      }
    }
  },
  '/api/pay/authStep': {
    post: {
      tags: ['Payment Processing'],
      summary: '3D Secure authentication',
      description: 'Handle 3D Secure authentication step for card payments',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                transaction_id: { type: 'string' },
                otp: { type: 'string' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              otp: '123456'
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' },
        400: { description: 'Invalid OTP' }
      }
    }
  },

  // ==================== FEE PREVIEW ====================
  '/api/pay/fee-preview': {
    get: {
      tags: ['Payments'],
      summary: 'Get fee preview with referral discount',
      description: `Preview transaction fees with the user's referral discount applied.

**Use Cases:**
- Show users their discounted fees before creating payment links
- Display savings from referral discounts
- Help users understand their fee structure

**Discount Sources:**
- \`referee_code\` - From payment link email (50% off for 90 days)
- \`user_referral_referee\` - From user referral code (50% off for 30 days)
- \`user_referral_referrer\` - Reward for a successful referral (25% of the referred merchant's fees as credit for 12 months)
- \`referrer_reward\` - Reward when customer signs up (10% off for 30 days)`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'amount',
          required: true,
          schema: { type: 'number', minimum: 1 },
          description: 'Transaction amount to calculate fees for',
          example: 1000
        },
        {
          in: 'query',
          name: 'currency',
          schema: { type: 'string', default: 'USD' },
          description: 'Currency code',
          example: 'USD'
        }
      ],
      responses: {
        200: {
          description: 'Fee preview retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Fee preview retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      amount: { type: 'number', example: 1000 },
                      currency: { type: 'string', example: 'USD' },
                      fee_info: {
                        type: 'object',
                        properties: {
                          base_fee_percent: { type: 'number', example: 2, description: 'Standard fee percentage before discount' },
                          final_fee_percent: { type: 'number', example: 1, description: 'Fee percentage after discount applied' },
                          base_fee_amount: { type: 'number', example: 20, description: 'Fee amount before discount' },
                          discounted_fee_amount: { type: 'number', example: 10, description: 'Fee amount after discount' },
                          savings: { type: 'number', example: 10, description: 'Amount saved due to discount' },
                          you_receive: { type: 'number', example: 990, description: 'Net amount after fees' }
                        }
                      },
                      discount_info: {
                        type: 'object',
                        properties: {
                          has_discount: { type: 'boolean', example: true },
                          discount_percent: { type: 'number', example: 50 },
                          discount_reason: { 
                            type: 'string', 
                            enum: ['referee_code', 'user_referral_referee', 'user_referral_referrer', 'referrer_reward', 'promo'],
                            example: 'referee_code' 
                          },
                          expires_at: { type: 'string', format: 'date-time', example: '2026-04-01T00:00:00.000Z' },
                          days_remaining: { type: 'integer', example: 45 }
                        }
                      }
                    }
                  }
                }
              },
              examples: {
                'With 50% Discount': {
                  summary: 'User with active referral discount',
                  value: {
                    message: 'Fee preview retrieved successfully',
                    data: {
                      amount: 1000,
                      currency: 'USD',
                      fee_info: {
                        base_fee_percent: 2,
                        final_fee_percent: 1,
                        base_fee_amount: 20,
                        discounted_fee_amount: 10,
                        savings: 10,
                        you_receive: 990
                      },
                      discount_info: {
                        has_discount: true,
                        discount_percent: 50,
                        discount_reason: 'referee_code',
                        expires_at: '2026-04-01T00:00:00.000Z',
                        days_remaining: 45
                      }
                    }
                  }
                },
                'No Discount': {
                  summary: 'User without active discount',
                  value: {
                    message: 'Fee preview retrieved successfully',
                    data: {
                      amount: 1000,
                      currency: 'USD',
                      fee_info: {
                        base_fee_percent: 2,
                        final_fee_percent: 2,
                        base_fee_amount: 20,
                        discounted_fee_amount: 20,
                        savings: 0,
                        you_receive: 980
                      },
                      discount_info: {
                        has_discount: false,
                        discount_percent: 0,
                        discount_reason: null,
                        expires_at: null,
                        days_remaining: 0
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid amount' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  // ==================== CHECKOUT UTILITIES ====================
  '/api/pay/configured-currencies': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get available currencies for checkout',
      description: `Returns the list of cryptocurrencies available for this specific payment.

**⚠️ Important:** This endpoint respects the merchant's \`accepted_currencies\` restriction:
- If merchant created payment link with \`accepted_currencies: ["BTC", "ETH"]\`, only those will be returned
- If no restriction was set, ALL configured wallets are returned

**Priority Order:**
1. First check \`available_currencies\` in \`getData\` response (most efficient)
2. If not present, call this endpoint to get filtered currencies

**Response includes:**
- \`configured_currencies\` - Array of currency codes (filtered by merchant's \`accepted_currencies\` if set)
- \`skip_selection\` - If true and only one currency available, auto-select it
- \`fee_info\` - Fee configuration for the payment

**Note:** Requires customer token from getData response (not merchant JWT token).`,
      parameters: [],
      responses: {
        200: {
          description: 'Configured currencies retrieved',
          content: {
            'application/json': {
              examples: {
                'Filtered by accepted_currencies': {
                  summary: 'Payment link with currency restrictions',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: ['BTC', 'ETH'],
                      skip_selection: false,
                      wallet_count: 2,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                },
                'Multiple Currencies': {
                  summary: 'Merchant with multiple crypto options (no restrictions)',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'LTC', 'TRX'],
                      skip_selection: false,
                      wallet_count: 6,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                },
                'Single Currency (Auto-select)': {
                  summary: 'Merchant with only one crypto option',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: ['USDT-TRC20'],
                      skip_selection: true,
                      wallet_count: 1,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                },
                'No Currencies Configured': {
                  summary: 'Merchant has not configured any crypto wallets',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: [],
                      skip_selection: false,
                      wallet_count: 0,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Invalid customer session',
          content: {
            'application/json': {
              example: { message: 'Invalid customer session', error: true }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing customer token' }
      }
    }
  },

  // ==================== MERCHANT CURRENCY CONFIGURATION ====================
  '/api/pay/company-currencies/{company_id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get company configured currencies (Merchant)',
      description: `Returns all supported cryptocurrencies with their configuration status for a specific company.

**🔐 AUTHENTICATION:**
This endpoint requires **JWT Token** authentication (merchant login).

**Use Case:** 
Called by merchant dashboard when creating/editing payment links to show which currencies can be selected.

**Response includes for each currency:**
- \`type\` - Currency code (e.g., "BTC", "ETH")
- \`name\` - Full name (e.g., "Bitcoin", "Ethereum")
- \`symbol\` - Currency symbol (e.g., "₿", "Ξ")
- \`configured\` - Boolean: true if wallet is set up
- \`wallet_address\` - The configured wallet address (or null)

**Business Logic:**
- Only currencies with \`configured: true\` can be selected for payment links
- If no currencies are selected during payment link creation, ALL configured currencies are accepted`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'company_id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Company ID to get currencies for'
        }
      ],
      responses: {
        200: {
          description: 'Company currencies retrieved successfully',
          content: {
            'application/json': {
              example: {
                message: 'Configured currencies retrieved successfully',
                data: {
                  company_id: 38,
                  company_name: 'Acme Corp',
                  total_available: 9,
                  total_configured: 7,
                  currencies: [
                    { type: 'BTC', name: 'Bitcoin', symbol: '₿', configured: true, wallet_address: '1JH5TnZzjYTf1...' },
                    { type: 'ETH', name: 'Ethereum', symbol: 'Ξ', configured: true, wallet_address: '0x9a7221b5e32d...' },
                    { type: 'LTC', name: 'Litecoin', symbol: 'Ł', configured: true, wallet_address: 'LbTjMGN7gELw4...' },
                    { type: 'DOGE', name: 'Dogecoin', symbol: 'Ð', configured: true, wallet_address: 'DEReH1ES1zT8M...' },
                    { type: 'TRX', name: 'Tron', symbol: '◎', configured: true, wallet_address: 'TTve8v6Y48ChsC...' },
                    { type: 'BCH', name: 'Bitcoin Cash', symbol: '₿', configured: false, wallet_address: null },
                    { type: 'USDT-TRC20', name: 'USDT (TRC-20)', symbol: '₮', configured: true, wallet_address: 'TTve8v6Y48ChsC...' },
                    { type: 'USDT-ERC20', name: 'USDT (ERC-20)', symbol: '₮', configured: true, wallet_address: '0x9a7221b5e32d...' },
                    { type: 'USDC-ERC20', name: 'USDC (ERC-20)', symbol: '$', configured: false, wallet_address: null }
                  ],
                  configured: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT-TRC20', 'USDT-ERC20'],
                  unconfigured: ['BCH', 'USDC-ERC20']
                }
              }
            }
          }
        },
        400: { description: 'Invalid company_id' },
        401: { description: 'Unauthorized' },
        404: { description: 'Company not found or does not belong to user' }
      }
    }
  },

  // ==================== FEE CALCULATOR ====================
  '/api/pay/calculateFees': {
    post: {
      tags: ['Payments'],
      summary: 'Calculate fees for checkout (Public)',
      description: `Calculate and preview the fee breakdown for a payment before checkout.

**🔓 NO AUTHENTICATION REQUIRED**
This is a public endpoint for merchants and checkout pages to preview fees.

**Multi-Currency Support:**
Supports any fiat currency (USD, EUR, GBP, AUD, CAD, etc.). The system automatically converts to USD for fee tier calculation, then converts fees back to your currency.

**60% Promotional Discount:**
All displayed fees include a 60% promotional discount to encourage adoption.

**Use Case:**
1. Merchant enters payment amount in their local currency
2. Selects cryptocurrency they want to receive
3. API returns fee breakdown and net amount to merchant

**Fee Breakdown:**
- **Platform Fee**: ~0.4% of amount (1% with 60% discount)
- **Blockchain Fee**: Network fees for the selected cryptocurrency
- **Total Fees**: Sum of platform + blockchain fees (with 60% discount)
- **Net to Merchant**: Payment amount minus total fees

**Supported Fiat Currencies:**
USD, EUR, GBP, AUD, CAD, CHF, CNY, JPY, NZD, SGD, HKD, NGN, KES, ZAR, BRL, MXN, INR, AED, and many more.

**Supported Cryptocurrencies:**
BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'cryptocurrency'],
              properties: {
                amount: {
                  type: 'number',
                  description: 'Payment amount in the specified currency',
                  example: 100.00,
                  minimum: 0.01
                },
                currency: {
                  type: 'string',
                  description: 'Fiat currency code (default: USD)',
                  example: 'AUD',
                  default: 'USD'
                },
                cryptocurrency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'],
                  description: 'Selected cryptocurrency for payment',
                  example: 'ETH'
                }
              }
            },
            examples: {
              'USD Payment': {
                summary: 'Calculate fees for $100 USD ETH payment',
                value: {
                  amount: 100.00,
                  currency: 'USD',
                  cryptocurrency: 'ETH'
                }
              },
              'AUD Payment': {
                summary: 'Calculate fees for $100 AUD BTC payment',
                value: {
                  amount: 100.00,
                  currency: 'AUD',
                  cryptocurrency: 'BTC'
                }
              },
              'EUR Payment': {
                summary: 'Calculate fees for €500 EUR payment',
                value: {
                  amount: 500.00,
                  currency: 'EUR',
                  cryptocurrency: 'ETH'
                }
              },
              'GBP Payment': {
                summary: 'Calculate fees for £250 GBP USDT payment',
                value: {
                  amount: 250.00,
                  currency: 'GBP',
                  cryptocurrency: 'USDT-TRC20'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fee calculation successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      payment_amount: { type: 'number', description: 'Original payment amount' },
                      currency: { type: 'string', description: 'Fiat currency (e.g., USD, AUD, EUR)' },
                      cryptocurrency: { type: 'string', description: 'Selected crypto' },
                      fee_breakdown: {
                        type: 'object',
                        properties: {
                          platform_fee: { type: 'number', description: 'Platform processing fee (in currency)' },
                          platform_fee_percent: { type: 'number', description: 'Platform fee percentage (with discount)' },
                          blockchain_fee: { type: 'number', description: 'Blockchain network fee (in currency)' },
                          total_fees: { type: 'number', description: 'Total fees (in currency, with 60% discount)' }
                        }
                      },
                      net_to_merchant: { type: 'number', description: 'Amount merchant receives after fees' },
                      usd_equivalents: {
                        type: 'object',
                        description: 'USD equivalent amounts for reference',
                        properties: {
                          payment_amount_usd: { type: 'number', description: 'Payment amount in USD' },
                          total_fees_usd: { type: 'number', description: 'Total fees in USD' },
                          net_to_merchant_usd: { type: 'number', description: 'Net to merchant in USD' },
                          exchange_rate: { type: 'number', description: 'Exchange rate (currency to USD)' }
                        }
                      },
                      details: {
                        type: 'object',
                        description: 'Additional fee breakdown details'
                      }
                    }
                  }
                }
              },
              example: {
                message: 'Fee calculation successful',
                data: {
                  payment_amount: 100,
                  currency: 'AUD',
                  cryptocurrency: 'ETH',
                  fee_breakdown: {
                    platform_fee: 0.57,
                    platform_fee_percent: 0.4,
                    blockchain_fee: 2.86,
                    total_fees: 3.43
                  },
                  net_to_merchant: 96.57,
                  usd_equivalents: {
                    payment_amount_usd: 70.03,
                    total_fees_usd: 2.40,
                    net_to_merchant_usd: 67.63,
                    exchange_rate: 0.7003
                  },
                  details: {
                    promotional_discount_percent: 60,
                    actual_total_fees: 8.58,
                    displayed_total_fees: 3.43,
                    savings_displayed: 5.15
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid input',
          content: {
            'application/json': {
              examples: {
                'Missing Amount': {
                  value: { success: false, message: 'Valid payment amount is required', statusCode: 400 }
                },
                'Invalid Crypto': {
                  value: { success: false, message: 'Invalid cryptocurrency. Valid options: BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20', statusCode: 400 }
                },
                'Invalid Currency': {
                  value: { success: false, message: 'Invalid currency. Common options: USD, EUR, GBP, AUD, CAD, etc.', statusCode: 400 }
                }
              }
            }
          }
        }
      }
    }
  }
};
