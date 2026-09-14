export const apiKeyPaths = {
  '/api/userApi/addApi': {
    post: {
      tags: ['API Keys'],
      summary: 'Create new API key',
      description: `Create a new API key for programmatic access to Dynopay services.
      
**Features:**
- Auto-generates secure API key
- Configurable rate limits
- Webhook URL for notifications
- Withdrawal whitelist for security

**⚠️ MULTI-TENANT REQUIREMENT:**
- \`company_id\` is **REQUIRED** for proper data isolation
- \`base_currency\` is **REQUIRED** for transaction processing

**Optional Fields:**
- \`api_name\` - Custom name (defaults to "{Company Name} {Environment} API")
- \`environment\` - production or development (defaults to "production")`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['company_id', 'base_currency'],
              properties: {
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID for multi-tenant isolation. Get from GET /api/company/getCompany',
                  example: 38
                },
                base_currency: {
                  type: 'string',
                  enum: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NGN', 'BRL', 'ZAR', 'KES', 'GHS', 'JPY', 'CHF', 'SGD', 'HKD', 'NZD', 'MXN', 'BTC'],
                  description: '✅ REQUIRED: Default currency for transactions',
                  example: 'USD'
                },
                api_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Custom name for the API key. Defaults to "{Company Name} Production/Development API"',
                  example: 'Bozzmail Payment API'
                },
                environment: {
                  type: 'string',
                  enum: ['development', 'production'],
                  description: '📝 OPTIONAL: API key environment (defaults to "production")',
                  default: 'production',
                  example: 'production'
                },
                permissions: {
                  type: 'array',
                  items: { type: 'string', enum: ['payments', 'transactions', 'webhooks', 'wallets', 'invoices', 'customers'] },
                  description: '📝 OPTIONAL: API permissions (defaults to ["payments", "transactions", "webhooks", "wallets"])',
                  example: ['payments', 'transactions', 'webhooks']
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: '📝 OPTIONAL: URL for payment notifications',
                  example: 'https://yourapp.com/webhooks/dynopay'
                },
                withdrawal_whitelist: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '📝 OPTIONAL: Approved withdrawal addresses',
                  example: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa']
                }
              }
            },
            examples: {
              'Minimal': {
                summary: '⚡ REQUIRED FIELDS ONLY (name auto-generated)',
                value: {
                  company_id: 38,
                  base_currency: 'USD'
                }
              },
              'With Custom Name': {
                summary: '📝 With custom API name',
                value: {
                  company_id: 38,
                  base_currency: 'USD',
                  api_name: 'Bozzmail Payment Gateway'
                }
              },
              'Production Key': {
                summary: '🚀 PRODUCTION: Ready for live use',
                value: {
                  company_id: 38,
                  base_currency: 'USD',
                  api_name: 'Production API',
                  environment: 'production',
                  webhook_url: 'https://myapp.com/webhooks/dynopay'
                }
              },
              'Development Key': {
                summary: '🔧 DEV: For testing',
                value: {
                  company_id: 38,
                  base_currency: 'USD',
                  api_name: 'Test API',
                  environment: 'development'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'API key created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      api_id: { type: 'integer' },
                      apiKey: { type: 'string', description: '⚠️ SAVE THIS - Only shown once! Opaque token (dpk_live_… / dpk_test_…); only its SHA-256 hash is stored, so it can never be retrieved again.' },
                      key_hint: { type: 'string', description: 'Display-only hint, e.g. dpk_live_Ab3k…9xQz' },
                      api_name: { type: 'string', description: 'API key name (auto-generated if not provided)' },
                      environment: { type: 'string', enum: ['production', 'development'] },
                      status: { type: 'string', example: 'active' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid API configuration / At least one wallet required for production keys' },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/userApi/getApi': {
    get: {
      tags: ['API Keys'],
      summary: 'Get all API keys',
      description: `Retrieve all API keys for the authenticated user.
      
**Note:** API key values are masked for security.`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'API keys retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ApiKey' }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/userApi/getApi/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API key details',
      description: `Retrieve specific API key configuration and usage statistics.
      
**Security Note:** The actual API key value is not returned for security reasons. Only the key configuration and metadata are shown.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: '✅ REQUIRED: API key ID',
        example: 1
      }],
      responses: {
        200: {
          description: 'API key details retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'API key retrieved successfully' },
                  data: { $ref: '#/components/schemas/ApiKey' }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/updateApi/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API key configuration',
      description: `Update API key settings such as name, currency, webhook, and withdrawal whitelist.
      
**Configurable Settings:**
- API name (for identification)
- Base currency (default currency for transactions)
- Withdrawal whitelist (approved wallet addresses)
- Webhook URL (for payment notifications)

**Security:** Whitelisted addresses add extra security by only allowing withdrawals to approved wallets.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: '✅ REQUIRED: API key ID',
        example: 1
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                api_name: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for this API key',
                  example: 'Production API'
                },
                base_currency: { 
                  type: 'string', 
                  enum: ['USD', 'EUR', 'NGN', 'GBP'],
                  description: '📝 OPTIONAL: Default currency for API transactions',
                  example: 'USD'
                },
                withdrawal_whitelist: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: '📝 OPTIONAL: Approved wallet addresses for withdrawals (security feature)',
                  example: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy']
                },
                webhook_url: { 
                  type: 'string', 
                  format: 'uri',
                  description: '📝 OPTIONAL: URL to receive payment webhooks/notifications',
                  example: 'https://yourapp.com/api/webhooks/payments'
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'API key updated' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/regenerateKey/{id}': {
    post: {
      tags: ['API Keys'],
      summary: 'Regenerate API key',
      description: 'Generate a new API key (invalidates the old one)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: {
          description: 'New API key generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      apiKey: { type: 'string', description: 'New API key (shown only once; only its hash is stored). The previous key stops working immediately.' },
                      key_hint: { type: 'string', description: 'Display-only hint for the new key' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/toggleStatus/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Toggle API key status',
      description: 'Enable or disable an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: {
          description: 'API key status toggled',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      is_active: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/revoke/{id}': {
    post: {
      tags: ['API Keys'],
      summary: 'Revoke API key',
      description: 'Permanently revoke an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'API key revoked' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/createPlan': {
    post: {
      tags: ['API Keys'],
      summary: 'Create API plan',
      description: 'Create a new pricing plan for API access',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['plan_name', 'rate_limit', 'price'],
              properties: {
                plan_name: { type: 'string', example: 'Premium' },
                description: { type: 'string' },
                rate_limit: { type: 'integer', example: 1000, description: 'Requests per minute' },
                price: { type: 'number', example: 99.99 },
                currency: { type: 'string', default: 'USD' },
                features: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Plan created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/ApiPlan' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/userApi/getPlans/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API plans',
      description: 'Retrieve API plans for an API key',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID'
      }],
      responses: {
        200: {
          description: 'Plans retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      plans: { type: 'array', items: { $ref: '#/components/schemas/ApiPlan' } }
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
  '/api/userApi/updatePlan/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API plan',
      description: 'Update an existing API plan',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Plan ID'
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                plan_name: { type: 'string' },
                rate_limit: { type: 'integer' },
                price: { type: 'number' },
                features: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Plan updated' },
        404: { description: 'Plan not found' }
      }
    }
  },
  '/api/userApi/deletePlan/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Delete API plan',
      description: 'Delete an API plan',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Plan deleted' },
        404: { description: 'Plan not found' }
      }
    }
  },
  '/api/userApi/getApiCustomers': {
    post: {
      tags: ['API Keys'],
      summary: 'Get API customers',
      description: 'Retrieve customers using your API',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                api_id: { type: 'integer' },
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 20 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customers retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      customers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            customer_id: { type: 'integer' },
                            email: { type: 'string' },
                            plan: { type: 'string' },
                            requests_count: { type: 'integer' },
                            last_request: { type: 'string', format: 'date-time' }
                          }
                        }
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' }
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
  '/api/userApi/updateCustomer/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API customer',
      description: 'Update customer plan or settings',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                plan_id: { type: 'integer' },
                rate_limit_override: { type: 'integer' },
                is_active: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Customer updated' },
        404: { description: 'Customer not found' }
      }
    }
  },
  '/api/userApi/deleteCustomer/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Delete API customer',
      description: 'Remove a customer from API access',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Customer deleted' },
        404: { description: 'Customer not found' }
      }
    }
  },
  '/api/userApi/deleteApi/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Delete API key',
      description: 'Permanently delete an API key. This action cannot be undone.',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID to delete'
      }],
      responses: {
        200: { description: 'API key deleted successfully' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/usage/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API usage statistics',
      description: `Retrieve usage statistics for a specific API key including:
- Request counts by endpoint
- Error rates
- Rate limit status
- Usage over time`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID'
      }, {
        in: 'query',
        name: 'period',
        schema: { type: 'string', enum: ['24h', '7d', '30d'], default: '7d' },
        description: 'Time period for statistics'
      }],
      responses: {
        200: {
          description: 'Usage statistics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      total_requests: { type: 'integer' },
                      successful_requests: { type: 'integer' },
                      failed_requests: { type: 'integer' },
                      rate_limit_hits: { type: 'integer' },
                      average_response_time: { type: 'number' },
                      daily_breakdown: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            date: { type: 'string', format: 'date' },
                            requests: { type: 'integer' },
                            errors: { type: 'integer' }
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
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/logs/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API request logs',
      description: `Retrieve recent request logs for debugging and monitoring.
      
**Includes:**
- Request timestamp
- Endpoint called
- Response status
- Response time
- IP address`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID'
      }, {
        in: 'query',
        name: 'page',
        schema: { type: 'integer', default: 1 }
      }, {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', default: 50 }
      }, {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['success', 'error', 'all'], default: 'all' }
      }],
      responses: {
        200: {
          description: 'Logs retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      logs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            timestamp: { type: 'string', format: 'date-time' },
                            endpoint: { type: 'string' },
                            method: { type: 'string' },
                            status_code: { type: 'integer' },
                            response_time_ms: { type: 'number' },
                            ip_address: { type: 'string' },
                            error_message: { type: 'string', nullable: true }
                          }
                        }
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/rateLimit/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update rate limit',
      description: 'Update rate limiting configuration for an API key.',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'API key ID'
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                rate_limit: {
                  type: 'integer',
                  description: 'Requests per minute',
                  example: 100,
                  minimum: 1,
                  maximum: 10000
                },
                burst_limit: {
                  type: 'integer',
                  description: 'Maximum burst requests',
                  example: 200
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Rate limit updated' },
        400: { description: 'Invalid rate limit configuration' },
        404: { description: 'API key not found' }
      }
    }
  },
  '/api/userApi/availableCurrencies/{company_id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get available currencies for company',
      description: 'Get the list of supported cryptocurrencies that the company has wallets configured for. Used when setting up API key currency restrictions.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'company_id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Company ID' }],
      responses: {
        200: { description: 'Available currencies list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object', properties: { currency: { type: 'string', example: 'BTC' }, name: { type: 'string', example: 'Bitcoin' }, enabled: { type: 'boolean' } } } } } } } } },
        404: { description: 'Company not found' },
        401: { description: 'Unauthorized' },
      },
    },
  },
};
