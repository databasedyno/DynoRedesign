export const directApiPaths = {
  '/api/user/createUser': {
    post: {
      tags: ['Direct API - Merchant Integration', 'Customer Management', 'Authentication'],
      summary: 'Create a customer for payment processing (Direct API)',
      description: `Create a customer record to initiate payments. Returns a customer token required for subsequent payment requests.

**🔍 KEYWORDS:** create customer, customer token, customer JWT, register customer, new customer, customer creation, API integration, programmatic payments

**🔐 Authentication:** Requires \`x-api-key\` header with your encrypted API key.

**📝 How to Get Your API Key:**
1. Login to Dynopay dashboard (\`POST /api/user/login\`)
2. Navigate to API Keys section
3. Create new API key (\`POST /api/userApi/addApi\`)
4. Copy the encrypted API key value
5. Use it in the \`x-api-key\` header

**🔄 Payment Flow:**
1. Create customer with this endpoint → Get customer \`token\`
2. Use customer \`token\` in \`Authorization: Bearer {token}\` header for \`/api/user/cryptoPayment\`
3. Customer can make multiple payments using same token (token doesn't expire)

**✨ Existing Customer Handling:**
- If email already exists for your company → Returns existing customer with new token
- No duplicate customers created

**💡 USE CASE:** Programmatic payment integration where you control the checkout experience`,
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  description: '✅ REQUIRED: Customer full name',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '✅ REQUIRED: Customer email address',
                  example: 'customer@example.com'
                },
                mobile: {
                  type: 'string',
                  description: '📱 OPTIONAL: Customer phone number',
                  example: '+1234567890'
                }
              }
            },
            examples: {
              'Basic Customer (Minimal)': {
                summary: 'Create customer with email only',
                value: {
                  name: 'John Doe',
                  email: 'john@example.com'
                }
              },
              'Customer with Mobile': {
                summary: 'Create customer with phone number',
                value: {
                  name: 'Jane Smith',
                  email: 'jane@example.com',
                  mobile: '+1234567890'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customer created or retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      token: { 
                        type: 'string', 
                        description: '🔑 Customer JWT token - use this in Authorization header for /api/user/cryptoPayment'
                      },
                      customer_id: { 
                        type: 'string', 
                        description: 'Unique customer UUID'
                      }
                    }
                  }
                }
              },
              examples: {
                'New Customer Created': {
                  summary: 'New customer successfully created',
                  value: {
                    success: true,
                    message: 'Registered Successful!',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                },
                'Existing Customer Retrieved': {
                  summary: 'Customer already exists, returned with new token',
                  value: {
                    success: true,
                    message: 'Customer already exists',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Bad Request - Missing required fields',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Name and email are required',
                errors: [
                  { key: 'name', error: 'Name is Required' },
                  { key: 'email', error: 'Email is Required' }
                ]
              }
            }
          }
        },
        403: { 
          description: 'Forbidden - Invalid or missing API key',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'API key is required in x-api-key header'
              }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
      }
    }
  },

  '/api/user/cryptoPayment': {
    post: {
      tags: ['Direct API - Merchant Integration', 'Crypto Payments', 'Bitcoin', 'Ethereum', 'Webhooks'],
      summary: 'Create a cryptocurrency payment (Direct API)',
      description: `Generate a crypto payment address for the customer. Returns a deposit address that the customer should send funds to.

**🔍 KEYWORDS:** crypto payment, bitcoin payment, ethereum payment, BTC, ETH, USDT, create payment, payment address, QR code, deposit address, webhook, callback, cryptocurrency, blockchain payment

**🔐 Authentication (2 Options):**

**Option 1: NEW Flow (Recommended)**
- Header \`x-api-key\`: Your encrypted merchant API key  
- Header \`Authorization\`: \`Bearer {customer_token}\` from \`/api/user/createUser\`

**Option 2: LEGACY Flow (Backward Compatibility)**
- Header \`x-api-key\`: Your encrypted merchant API key
- Header \`Authorization\`: Can be empty, invalid, or old wallet_token
- System automatically creates/finds a default customer for your company

**💰 Supported Cryptocurrencies:**
- \`BTC\` - Bitcoin
- \`ETH\` - Ethereum  
- \`LTC\` - Litecoin
- \`DOGE\` - Dogecoin
- \`TRX\` - Tron
- \`BCH\` - Bitcoin Cash
- \`USDT-TRC20\` - Tether (Tron Network)
- \`USDT-ERC20\` - Tether (Ethereum Network)
- \`USDC-ERC20\` - USD Coin (Ethereum Network)

**⚠️ Important:** You must have wallet addresses configured for the cryptocurrencies you want to accept. Check available currencies via \`GET /api/user/getSupportedCurrency\`.

**📡 Webhook Flow:**
1. Customer sends crypto to the returned address
2. Dynopay detects the deposit on blockchain (usually 1-3 confirmations)
3. Webhook sent to your \`webhook_url\` (and \`callback_url\` if set) with payment status updates
4. Optional: Customer's browser redirected to \`redirect_uri\` after payment

⚠️ **IMPORTANT — Do not confuse these fields:**

| Field | Type | Purpose | Receives POST data? |
|-------|------|---------|-------------------|
| \`webhook_url\` | Server-to-server | Payment notifications to YOUR SERVER | ✅ Yes (POST with JSON payload) |
| \`callback_url\` | Server-to-server | Secondary notification URL | ✅ Yes (POST with JSON payload) |
| \`redirect_uri\` | Browser redirect | "Thank you" page for the CUSTOMER | ❌ No (just a browser redirect) |

**🔗 URL Configuration Priority:**
1. Per-payment \`webhook_url\` (this request body)
2. API key's configured webhook URL (from dashboard)
3. Company's default webhook URL (from company settings)

**💸 Fee Payment Options:**
- \`company\` (default) - You pay fees, deducted from your portion
- \`customer\` - Customer pays extra to cover fees

**⚠️ Direct API Payment Handling:**
- Whatever crypto amount is received gets processed immediately
- **No grace period** — underpayments are processed with the actual received amount
- **No underpayment threshold** — even small shortfalls are processed as-is (not accepted as full)
- **No overpayment threshold** — excess is included in the merchant's payment
- Company-level \`grace_period_minutes\`, \`underpayment_threshold_usd\`, and \`overpayment_threshold_usd\` settings apply to **Payment Links only**

**💡 USE CASE:** Programmatic crypto payments with custom checkout UI, embedded payments, API-first integration`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: {
                  type: 'number',
                  description: '✅ REQUIRED: Payment amount in your base currency (default: USD)',
                  example: 100,
                  minimum: 0.01
                },
                currency: {
                  type: 'string',
                  description: '✅ REQUIRED: Cryptocurrency the customer will pay with',
                  enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON'],
                  example: 'ETH'
                },
                redirect_uri: {
                  type: 'string',
                  format: 'uri',
                  description: `🔗 OPTIONAL: Browser redirect URL — where the customer's browser navigates after payment.

**This is NOT a webhook.** No data is POSTed to this URL. It is purely a browser redirect (HTTP 302).

**Use Case:** Redirect the customer to your "Thank You" or order confirmation page.

⚠️ **COMMON MISTAKE:** Do NOT put your server webhook endpoint here. Use \`webhook_url\` for server-to-server notifications.`,
                  example: 'https://yourapp.com/order/12345/thank-you'
                },
                callback_url: {
                  type: 'string',
                  format: 'uri',
                  description: `📡 OPTIONAL: Secondary server-to-server callback URL (receives POST with payment data, just like webhook_url).

**How it works:** If both \`callback_url\` and \`webhook_url\` are set, Dynopay sends the webhook payload to BOTH URLs.

**Use Case:** Use this if you need payment notifications sent to two different server endpoints (e.g., order service + accounting service).

⚠️ **Note:** This is NOT the same as \`redirect_uri\`. This receives server-to-server POST requests with the full payment payload.`,
                  example: 'https://yourapp.com/callbacks/payment-status'
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: `📡 RECOMMENDED: Primary server-to-server webhook URL. Receives POST requests with payment status updates.

⚠️ **THIS IS THE FIELD MOST MERCHANTS NEED.** If you want to be notified when a payment is made, set this field.

**Webhook Events Sent:**
- \`payment.pending\` — Deposit detected on blockchain, awaiting confirmations
- \`payment.confirmed\` — Payment fully confirmed and processed (fulfill the order here)
- \`payment.underpaid\` — Partial payment received (less than expected amount)

**Webhook Payload Example (payment.confirmed):**
\`\`\`json
{
  "event": "payment.confirmed",
  "payment_type": "direct_api",
  "payment_id": "a3f2e1d4...",
  "transaction_reference": "a3f2e1d4...",
  "status": "done",
  "amount": 0.042156,
  "currency": "ETH",
  "base_amount": 100,
  "base_currency": "USD",
  "merchant_amount": 0.040156,
  "total_fee": 0.002,
  "total_fee_usd": 4.75,
  "fee_payer": "company",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "meta_data": { "order_id": "ORD-12345" },
  "timestamp": "2026-02-06T18:50:00.000Z"
}
\`\`\`

**Security:** Webhooks include \`X-DynoPay-Signature\` header (HMAC-SHA256) if you have a webhook_secret configured.

**Priority:** Per-payment webhook_url > API key webhook > Company webhook`,
                  example: 'https://yourapp.com/webhooks/crypto-payment'
                },
                fee_payer: {
                  type: 'string',
                  enum: ['customer', 'company'],
                  description: `💰 OPTIONAL: Who pays the processing fees.

**Options:**
- \`company\` (default) - Fees deducted from merchant's received amount
- \`customer\` - Customer pays additional amount to cover all fees

**Example (100 USD payment):**
- \`company\` mode: Customer sends ~0.042 ETH, you receive ~0.040 ETH (fees deducted)
- \`customer\` mode: Customer sends ~0.044 ETH, you receive full 0.042 ETH (customer pays extra)`,
                  default: 'company',
                  example: 'company'
                },
                topUp: {
                  type: 'boolean',
                  description: `📥 OPTIONAL: Payment type flag.
                  
- \`false\` (default) - Regular payment for goods/services
- \`true\` - Customer wallet top-up/deposit`,
                  default: false,
                  example: false
                },
                accepted_currencies: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
                  },
                  description: `🪙 OPTIONAL: Limit which cryptocurrencies customer can choose.
                  
**Use Case:** If you only want to accept BTC and ETH for this payment, pass \`["BTC", "ETH"]\`.

**Default:** All your configured wallet currencies are available.

**Validation:** All currencies in this array must have wallet addresses configured in your account.`,
                  example: ['BTC', 'ETH', 'USDT-TRC20']
                },
                meta_data: {
                  type: 'object',
                  description: `🏷️ OPTIONAL: Custom data to attach to this payment (max 2KB).
                  
**Use Cases:**
- Order ID: \`{ "order_id": "ORD-12345" }\`
- Customer reference: \`{ "customer_ref": "CUST-789", "invoice": "INV-2024-001" }\`
- Cart details: \`{ "items": ["Product A", "Product B"], "discount_code": "SAVE20" }\`

**Returned In:** Payment webhooks and transaction queries`,
                  example: {
                    order_id: 'ORD-12345',
                    customer_ref: 'CUST-789',
                    notes: 'Priority shipping'
                  }
                }
              }
            },
            examples: {
              'Minimal Payment': {
                summary: '⚡ Simplest - just amount and currency',
                description: 'Minimal required fields only',
                value: {
                  amount: 50,
                  currency: 'ETH'
                }
              },
              'Payment with Webhook': {
                summary: '📡 With server webhook notification',
                description: 'Receive payment updates on your server',
                value: {
                  amount: 100,
                  currency: 'BTC',
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  fee_payer: 'company'
                }
              },
              'Full Payment Options': {
                summary: '🚀 All available options',
                description: 'Complete example with all optional fields',
                value: {
                  amount: 250,
                  currency: 'USDT-TRC20',
                  redirect_uri: 'https://yourapp.com/order/12345/success',
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  fee_payer: 'customer',
                  topUp: false,
                  accepted_currencies: ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'],
                  meta_data: {
                    order_id: 'ORD-12345',
                    customer_ref: 'CUST-789',
                    notes: 'Express delivery'
                  }
                }
              },
              'Limited Currency Options': {
                summary: '🪙 Restrict payment currencies',
                description: 'Only allow BTC and ETH for this payment',
                value: {
                  amount: 500,
                  currency: 'BTC',
                  accepted_currencies: ['BTC', 'ETH'],
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  meta_data: {
                    order_id: 'ORD-99999',
                    vip_customer: true
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment address generated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      transaction_id: { 
                        type: 'string', 
                        description: '🆔 Unique payment transaction ID - use for tracking'
                      },
                      qr_code: { 
                        type: 'string', 
                        description: '📱 QR code data URL for customer scanning'
                      },
                      address: { 
                        type: 'string', 
                        description: '📥 Crypto deposit address - customer sends funds here'
                      },
                      amount: { 
                        type: 'number', 
                        description: '💰 Exact crypto amount customer must send'
                      },
                      currency: { 
                        type: 'string', 
                        description: '🪙 Cryptocurrency symbol'
                      },
                      base_amount: { 
                        type: 'number', 
                        description: '💵 Original amount in base currency (USD)'
                      },
                      base_currency: { 
                        type: 'string', 
                        description: 'Base currency code (e.g., USD)'
                      },
                      redirect_uri: { 
                        type: 'string', 
                        description: '🔗 Redirect URL after payment (if provided)'
                      }
                    }
                  }
                }
              },
              examples: {
                'ETH Payment': {
                  summary: 'Ethereum payment address generated',
                  value: {
                    success: true,
                    message: 'Payment Created!',
                    data: {
                      transaction_id: 'a3f2e1d4c5b6a7890fedcba987654321fedcba987654321fedcba9876543210',
                      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                      amount: 0.042156,
                      currency: 'ETH',
                      base_amount: 100,
                      base_currency: 'USD',
                      redirect_uri: 'https://yourapp.com/order/success'
                    }
                  }
                },
                'BTC Payment': {
                  summary: 'Bitcoin payment address generated',
                  value: {
                    success: true,
                    message: 'Payment Created!',
                    data: {
                      transaction_id: 'b4e3f2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3',
                      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      amount: 0.00234567,
                      currency: 'BTC',
                      base_amount: 100,
                      base_currency: 'USD',
                      redirect_uri: null
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Bad Request - Invalid parameters or unconfigured wallet',
          content: {
            'application/json': {
              examples: {
                'Missing Amount': {
                  summary: 'Amount field missing or invalid',
                  value: {
                    success: false,
                    message: 'Valid payment amount is required'
                  }
                },
                'Missing Currency': {
                  summary: 'Currency field missing',
                  value: {
                    success: false,
                    message: 'Currency is required',
                    available_currencies: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
                  }
                },
                'No Wallet Configured': {
                  summary: 'No crypto wallets configured',
                  value: {
                    success: false,
                    message: 'No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.'
                  }
                },
                'Currency Not Configured': {
                  summary: 'Requested currency not available',
                  value: {
                    success: false,
                    message: 'ETH is not available for this payment. Available currencies: BTC, USDT-TRC20',
                    available_currencies: ['BTC', 'USDT-TRC20']
                  }
                },
                'Unconfigured Accepted Currency': {
                  summary: 'accepted_currencies contains unconfigured wallet',
                  value: {
                    success: false,
                    message: 'No wallet configured for: SOL, MATIC. Available currencies: BTC, ETH, USDT-TRC20'
                  }
                }
              }
            }
          }
        },
        403: { 
          description: 'Forbidden - Invalid API key or unauthorized',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Invalid API key'
              }
            }
          }
        },
        500: { 
          description: 'Internal Server Error',
          content: {
            'application/json': {
              examples: {
                'Currency Rate Error': {
                  summary: 'Failed to fetch cryptocurrency rates',
                  value: {
                    success: false,
                    message: 'Failed to get currency rates'
                  }
                },
                'Payment Creation Error': {
                  summary: 'Error creating crypto payment',
                  value: {
                    success: false,
                    message: 'Failed to create crypto payment',
                    error: 'Internal payment processing error'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getTransactions': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer transactions',
      description: `Retrieve all transactions for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser

**Auto-Stablecoin Conversion:**
Transactions that were auto-converted from volatile crypto to stablecoin include:
- \`auto_converted: true\` — indicates the transaction went through Binance conversion
- \`auto_convert\` object — full conversion details (source crypto, converted stablecoin, rate, status)
- \`display_currency\` — amounts shown in the API key's base currency

**Conversion Statuses:** PENDING_DEPOSIT → DEPOSIT_CREDITED → CONVERTING → CONVERTED → WITHDRAWING → COMPLETED`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: 'Page number' },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 }, description: 'Items per page' },
      ],
      responses: {
        200: {
          description: 'Transactions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  display_currency: { type: 'string', description: "API key's base currency", example: 'USD' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        payment_mode: { type: 'string' },
                        base_amount: { type: 'number' },
                        base_currency: { type: 'string' },
                        paid_amount: { type: 'number' },
                        paid_currency: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'done', 'failed'] },
                        display_currency: { type: 'string', description: "API base key currency" },
                        auto_converted: { type: 'boolean', description: 'Whether this transaction was auto-converted to stablecoin' },
                        auto_convert: { nullable: true, $ref: '#/components/schemas/AutoConvertInfo' },
                        createdAt: { type: 'string', format: 'date-time' }
                      }
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

  '/api/user/getBalance': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer wallet balance',
      description: `Retrieve the wallet balance for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Balance retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      balance: { type: 'number' },
                      currency: { type: 'string' }
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

  '/api/user/getSupportedCurrency': {
    get: {
      tags: ['Direct API - Merchant Integration', 'Currencies', 'Configuration'],
      summary: 'Get supported cryptocurrencies for your account',
      description: `Retrieve list of cryptocurrencies configured for your merchant account. Only returns currencies where you have wallet addresses configured.

**🔍 KEYWORDS:** supported currencies, available cryptocurrencies, configured wallets, currency list, BTC ETH LTC DOGE TRX BCH USDT USDC, check currencies, wallet configuration

**🔐 Authentication:** Requires \`x-api-key\` header with your encrypted API key.

**Use Cases:**
- Display available payment options to customers
- Validate currency before calling /api/user/cryptoPayment
- Check which wallets are configured

**Response includes:**
- \`currencies\` - Your configured cryptocurrencies (what customers can actually use)
- \`all_supported\` - All cryptocurrencies Dynopay supports (for reference)

**💡 USE CASE:** Check wallet configuration before offering payment options to customers`,
      security: [{ ApiKeyAuth: [] }],
      responses: {
        200: {
          description: 'Supported currencies retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      currencies: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '✅ Your configured cryptocurrencies (what customers can use for payments)'
                      },
                      all_supported: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '📋 All cryptocurrencies supported by Dynopay platform'
                      }
                    }
                  }
                }
              },
              examples: {
                'Partial Configuration': {
                  summary: 'Merchant has some wallets configured',
                  value: {
                    success: true,
                    message: 'Supported currencies retrieved',
                    data: {
                      currencies: ['BTC', 'ETH', 'USDT-TRC20'],
                      all_supported: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
                    }
                  }
                },
                'Full Configuration': {
                  summary: 'Merchant has all wallets configured',
                  value: {
                    success: true,
                    message: 'Supported currencies retrieved',
                    data: {
                      currencies: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON'],
                      all_supported: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Forbidden - Invalid or missing API key',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Invalid API key'
              }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
      }
    }
  },
  '/api/user/createPayment': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create payment link via API',
      operationId: 'createPaymentViaApi',
      description: '**Create Payment Link Programmatically**\n\nCreate a payment link-style payment via the merchant API. This creates a hosted checkout page.\n\n**Authentication:** API Key (x-api-key header)',
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', example: 100, description: 'Payment amount' },
                currency: { type: 'string', example: 'USD', description: 'Base fiat currency' },
                description: { type: 'string', example: 'Product Purchase' },
                customer_email: { type: 'string', format: 'email', example: 'customer@example.com' },
                webhook_url: { type: 'string', format: 'uri', example: 'https://yourapp.com/webhooks/payment' },
                redirect_uri: { type: 'string', format: 'uri', example: 'https://yourapp.com/success' },
                metadata: { type: 'object', description: 'Custom metadata', example: { order_id: 'ORD-123' } },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Payment link created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { link_id: { type: 'integer' }, payment_link: { type: 'string' } } } } } } } },
        400: { description: 'Missing amount or currency' },
        401: { description: 'Invalid or missing API key' },
      },
    },
  },
  '/api/user/addFunds': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Add funds to customer wallet',
      operationId: 'addFundsViaApi',
      description: '**Add Funds to Customer Wallet**\n\nInitiate a crypto deposit to a customer wallet.\n\n**Authentication:** API Key + Customer Bearer Token',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', example: 50 },
                currency: { type: 'string', example: 'BTC' },
                redirect_uri: { type: 'string', format: 'uri' },
                webhook_url: { type: 'string', format: 'uri' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Deposit initiated' },
        400: { description: 'Missing required fields' },
        401: { description: 'Customer authentication required' },
      },
    },
  },
  '/api/user/useWallet': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Pay using wallet balance',
      operationId: 'useWalletViaApi',
      description: '**Use Wallet Balance for Payment**\n\nMake a payment using the customer existing wallet balance.\n\n**Authentication:** API Key + Customer Bearer Token',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', example: 25.00 },
                currency: { type: 'string', example: 'USDT' },
                recipient_email: { type: 'string', format: 'email' },
                description: { type: 'string' },
                webhook_url: { type: 'string', format: 'uri' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Wallet payment processed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { transaction_id: { type: 'string' }, amount: { type: 'number' }, status: { type: 'string' } } } } } } } },
        400: { description: 'Missing required fields' },
        401: { description: 'Customer authentication required' },
      },
    },
  },
  '/api/user/getSingleTransaction/{id}': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get single transaction',
      operationId: 'getSingleTransaction',
      description: '**Get Transaction Details**\n\nRetrieve details of a specific transaction by ID.\n\n**Authentication:** API Key + Customer Bearer Token',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Transaction ID' },
      ],
      responses: {
        200: { description: 'Transaction details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Transaction' } } } } } },
        404: { description: 'Transaction not found' },
        401: { description: 'Invalid or missing API key' },
      },
    },
  },
  '/api/user/getCryptoTransaction/{address}': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get transaction by crypto address',
      operationId: 'getCryptoTransaction',
      description: '**Lookup Transaction by Crypto Address**\n\nFind the transaction associated with a specific crypto deposit address.\n\n**Authentication:** API Key + Customer Bearer Token',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Crypto address' },
      ],
      responses: {
        200: { description: 'Transaction found', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { pool_transaction: { type: 'object' }, transaction: { $ref: '#/components/schemas/Transaction' }, address: { type: 'string' }, status: { type: 'string' } } } } } } } },
        404: { description: 'No transaction found for this address' },
        401: { description: 'Invalid or missing API key' },
      },
    },
  },
  '/api/user/getPaymentStatus/{payment_id}': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get payment status by payment_id (recommended for webhook re-verification)',
      operationId: 'getPaymentStatus',
      description: '**Verify a payment by its unique payment_id**\n\nReturns the authoritative payment status keyed on the immutable `payment_id` returned when the payment was created (`POST /api/user/cryptoPayment`). Unlike `GET /api/user/getCryptoTransaction/{address}`, it does NOT depend on reusable merchant-pool deposit addresses and returns the final status straight from the database — so it stays correct even after the short-lived checkout session has expired. **This is the recommended endpoint for verifying a payment when you receive a webhook.**\n\n`payment_status` is one of: `waiting`, `pending`, `confirmed`, `processing`, `settled`, `underpaid`, `failed`, `expired`, `refunded`. Funds have been forwarded to your merchant wallet when `payment_status` is `settled` (or the convenience flag `is_paid` is `true`).\n\n**Authentication:** API Key + Customer Bearer Token',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'payment_id', in: 'path', required: true, schema: { type: 'string' }, description: 'Dynopay payment_id returned by POST /api/user/cryptoPayment' },
      ],
      responses: {
        200: {
          description: 'Payment status retrieved',
          content: { 'application/json': { schema: { type: 'object', properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: {
              payment_id: { type: 'string' },
              payment_status: { type: 'string', enum: ['waiting', 'pending', 'confirmed', 'processing', 'settled', 'underpaid', 'failed', 'expired', 'refunded'] },
              is_paid: { type: 'boolean' },
              amount: { type: 'number', description: 'Crypto amount received' },
              currency: { type: 'string' },
              base_amount: { type: 'number' },
              base_currency: { type: 'string' },
              usd_value: { type: 'number' },
              fee: { type: 'number' },
              confirmations: { type: 'number' },
              incoming_tx_hash: { type: 'string', description: 'Customer deposit tx hash' },
              outgoing_tx_hash: { type: 'string', description: 'Settlement tx hash to merchant wallet' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            } },
          } } } },
        },
        400: { description: 'Missing or invalid payment_id' },
        404: { description: 'Payment not found for this merchant' },
        401: { description: 'Invalid or missing API key' },
      },
    },
  },
};
