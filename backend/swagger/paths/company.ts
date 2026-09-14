export const companyPaths = {
  '/api/company/addCompany': {
    post: {
      tags: ['Company'],
      summary: 'Create a new company profile',
      description: 'Create a new company profile for the authenticated user.\n\n**Authentication Required:** JWT Bearer Token\n\n**Note:** Supports optional file upload for company logo.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['company_name', 'email'],
              properties: {
                company_name: { type: 'string', description: 'Company legal name', example: 'My Company Ltd' },
                email: { type: 'string', format: 'email', description: 'Company contact email', example: 'contact@company.com' },
                mobile: { type: 'string', example: '+1234567890' },
                website: { type: 'string', format: 'uri', example: 'https://company.com' },
                address_line1: { type: 'string', example: '123 Main St' },
                address_line2: { type: 'string', example: 'Suite 100' },
                city: { type: 'string', example: 'New York' },
                state: { type: 'string', example: 'NY' },
                country: { type: 'string', example: 'US' },
                zip_code: { type: 'string', example: '10001' },
                vat_number: { type: 'string', example: 'US123456789' },
                vat_type: { type: 'string', example: 'EIN' },
                logo: { type: 'string', format: 'binary', description: 'Company logo image' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Company created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/Company' } } } } } },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/updateCompany/{id}': {
    put: {
      tags: ['Company'],
      summary: 'Update company details',
      description: 'Update an existing company profile. Only the company owner can update.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                company_name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                mobile: { type: 'string' },
                website: { type: 'string' },
                address_line1: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                country: { type: 'string' },
                zip_code: { type: 'string' },
                vat_number: { type: 'string' },
                vat_type: { type: 'string' },
                logo: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Company updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Company' } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/getCompany': {
    get: {
      tags: ['Company'],
      summary: 'Get all companies for authenticated user',
      description: 'Returns all companies owned by the authenticated user.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'List of companies', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Company' } } } } } } },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/getCompany/{id}': {
    get: {
      tags: ['Company'],
      summary: 'Get company by ID',
      description: 'Get detailed information about a specific company.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Company details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Company' } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/getTransactions/{id}': {
    get: {
      tags: ['Company'],
      summary: 'Get company transactions',
      description: 'Get all transactions for a specific company with pagination and filters.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'done', 'failed', 'expired'] } },
      ],
      responses: {
        200: { description: 'Transaction list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/deleteCompany/{id}': {
    delete: {
      tags: ['Company'],
      summary: 'Delete a company',
      description: 'Permanently delete a company and all associated data. This action cannot be undone.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Company deleted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/validateTaxId': {
    post: {
      tags: ['Company'],
      summary: 'Validate company tax ID',
      description: 'Validate a tax ID (VAT, EIN, GST, etc.) against external registries.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['tax_id', 'country_code'],
              properties: {
                tax_id: { type: 'string', example: 'US123456789' },
                country_code: { type: 'string', example: 'US' },
                tax_type: { type: 'string', example: 'EIN' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Validation result', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, valid: { type: 'boolean' }, company_name: { type: 'string' } } } } } },
        400: { description: 'Missing required fields' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/webhook-settings/{id}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook settings',
      description: 'Get the webhook configuration for a company.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Webhook settings', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { webhook_url: { type: 'string' }, webhook_events: { type: 'array', items: { type: 'string' } }, retry_attempts: { type: 'integer' }, retry_interval_seconds: { type: 'integer' } } } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
    put: {
      tags: ['Webhooks'],
      summary: 'Update webhook settings',
      description: 'Update webhook URL, events, and retry configuration for a company.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                webhook_url: { type: 'string', format: 'uri', example: 'https://yourapp.com/webhooks/payment' },
                webhook_secret: { type: 'string', description: 'Secret for HMAC signature verification' },
                webhook_events: { type: 'array', items: { type: 'string', enum: ['payment.confirmed', 'payment.pending', 'payment.underpaid', 'payment.overpaid', 'conversion.completed', 'conversion.failed'] }, example: ['payment.confirmed', 'payment.pending'] },
                retry_attempts: { type: 'integer', example: 3 },
                retry_interval_seconds: { type: 'integer', example: 60 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Webhook settings updated' },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/webhook-test/{id}': {
    post: {
      tags: ['Webhooks'],
      summary: 'Test webhook endpoint',
      description: 'Send a test webhook payload to the configured webhook URL to verify connectivity.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Test webhook sent', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { url: { type: 'string' }, status: { type: 'integer' }, response_time_ms: { type: 'integer' } } } } } } } },
        400: { description: 'No webhook URL configured' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/webhook-history/{id}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook delivery history',
      description: 'View webhook delivery logs with filters for event type, status, and date range.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' },
        { name: 'event', in: 'query', schema: { type: 'string' }, description: 'Filter by event type' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['success', 'failed', 'pending'] } },
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: { description: 'Webhook delivery history' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/webhook-history/{id}/detail/{logId}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook delivery detail',
      description: 'Get full details of a specific webhook delivery attempt including request/response payload.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' },
        { name: 'logId', in: 'path', required: true, schema: { type: 'integer' }, description: 'Webhook log ID' },
      ],
      responses: {
        200: { description: 'Webhook delivery detail' },
        404: { description: 'Log not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/webhook-stats/{id}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook statistics',
      description: 'Get webhook delivery statistics including success rate, event breakdown, and response times.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Webhook statistics', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { total_deliveries: { type: 'integer' }, success_rate: { type: 'string', example: '95.5%' }, status_breakdown: { type: 'array', items: { type: 'object' } }, event_breakdown: { type: 'array', items: { type: 'object' } }, response_time: { type: 'object' }, recent_failures: { type: 'array', items: { type: 'object' } } } } } } } } },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/auto-convert/{id}': {
    get: {
      tags: ['Auto-Stablecoin Conversion'],
      summary: 'Get auto-convert settings',
      description: 'Get the auto-stablecoin conversion configuration for a company.\n\nReturns current settings and lists of valid currencies and chains.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Auto-convert settings', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { company_id: { type: 'integer' }, auto_convert_enabled: { type: 'boolean', example: false }, settlement_currency: { type: 'string', nullable: true, enum: ['USDT', 'USDC'] }, settlement_wallet_address: { type: 'string', nullable: true }, settlement_chain: { type: 'string', nullable: true, enum: ['ERC20', 'TRC20', 'POLYGON', 'BEP20', 'SOL'] }, valid_currencies: { type: 'array', items: { type: 'string' }, example: ['USDT', 'USDC'] }, valid_chains: { type: 'array', items: { type: 'string' }, example: ['ERC20', 'TRC20', 'POLYGON', 'BEP20', 'SOL'] } } } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
    put: {
      tags: ['Auto-Stablecoin Conversion'],
      summary: 'Update auto-convert settings',
      description: 'Enable or disable auto-stablecoin conversion for a company.\n\n**To Enable:** Send `auto_convert_enabled: true` with `settlement_currency`, `settlement_chain`. Volatile crypto will be auto-converted to your chosen stablecoin.\n\n**To Disable:** Send `auto_convert_enabled: false`. Returns `wallet_readiness` showing which volatile crypto wallets are configured. Payments resume forwarding directly to your saved merchant wallets.\n\n**When Disabled:** All payments go directly to merchant wallets. Missing wallets for specific currencies will cause those payments to fail.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['auto_convert_enabled'],
              properties: {
                auto_convert_enabled: { type: 'boolean', example: false, description: 'Set to false to disable and resume direct wallet forwarding' },
                settlement_currency: { type: 'string', enum: ['USDT', 'USDC'], example: 'USDT', description: 'Required only when enabling' },
                settlement_wallet_address: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', description: 'Required only when enabling' },
                settlement_chain: { type: 'string', enum: ['ERC20', 'TRC20', 'POLYGON', 'BEP20', 'SOL'], example: 'ERC20', description: 'Required only when enabling' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Settings updated. When disabling, includes wallet_readiness check.', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string', description: 'Includes warning if merchant wallets are missing for some currencies' }, data: { type: 'object', properties: { auto_convert_enabled: { type: 'boolean' }, forwarding_mode: { type: 'string', enum: ['direct_to_merchant_wallets', 'auto_convert_via_binance'] }, previous_settlement: { type: 'object', nullable: true, properties: { currency: { type: 'string' }, chain: { type: 'string' } } }, wallet_readiness: { type: 'object', description: 'Only present when disabling', properties: { all_configured: { type: 'boolean', description: 'True if merchant has wallets for all volatile currencies' }, configured_wallets: { type: 'array', items: { type: 'string' }, example: ['BTC', 'ETH'] }, missing_wallets: { type: 'array', items: { type: 'string' }, example: ['LTC', 'DOGE', 'SOL'] }, total_volatile_currencies: { type: 'integer', example: 8 } } } } } } } } } },
        400: { description: 'Validation error (invalid currency/chain when enabling)' },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/conversion-history/{id}': {
    get: {
      tags: ['Auto-Stablecoin Conversion'],
      summary: 'Get conversion history',
      description: 'Get the history of auto-stablecoin conversions for a company.\n\n**Statuses:** PENDING_DEPOSIT -> DEPOSIT_CREDITED -> CONVERTING -> CONVERTED -> WITHDRAWING -> COMPLETED (or FAILED)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING_DEPOSIT', 'DEPOSIT_CREDITED', 'CONVERTING', 'CONVERTED', 'WITHDRAWING', 'COMPLETED', 'FAILED'] }, description: 'Filter by conversion status' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: { description: 'Conversion history', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/StablecoinConversion' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/conversion/{conversionId}': {
    get: {
      tags: ['Auto-Stablecoin Conversion'],
      summary: 'Get single conversion details',
      description: 'Get full details of a specific auto-stablecoin conversion including all audit trail fields.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'conversionId', in: 'path', required: true, schema: { type: 'integer' }, description: 'Conversion ID' }],
      responses: {
        200: { description: 'Conversion details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/StablecoinConversion' } } } } } },
        404: { description: 'Conversion not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/company/conversion/{conversionId}/retry': {
    post: {
      tags: ['Auto-Stablecoin Conversion'],
      summary: 'Retry failed conversion',
      description: 'Manually retry a failed auto-stablecoin conversion. Only conversions with status FAILED can be retried.\n\nThis resets the status to PENDING_DEPOSIT and re-enters the conversion pipeline.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'conversionId', in: 'path', required: true, schema: { type: 'integer' }, description: 'Conversion ID' }],
      responses: {
        200: { description: 'Conversion retry initiated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/StablecoinConversion' } } } } } },
        400: { description: 'Conversion is not in FAILED status' },
        404: { description: 'Conversion not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
};
