export const apiUsagePaths = {
  '/api/userApi/usage/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API usage statistics',
      description: 'Retrieve detailed usage statistics for an API key including daily request counts, response times, and top endpoints',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'API key ID',
        },
        {
          in: 'query',
          name: 'days',
          schema: { type: 'integer', default: 7 },
          description: 'Number of days to retrieve stats for',
        },
      ],
      responses: {
        200: {
          description: 'Usage statistics retrieved',
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
                      api_name: { type: 'string' },
                      total_requests: { type: 'integer', example: 15420 },
                      last_used_at: { type: 'string', format: 'date-time' },
                      rate_limits: {
                        type: 'object',
                        properties: {
                          per_minute: { type: 'integer', example: 60 },
                          per_hour: { type: 'integer', example: 3600 },
                          per_day: { type: 'integer', example: 100000 },
                        },
                      },
                      usage_by_day: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            date: { type: 'string', format: 'date' },
                            request_count: { type: 'integer' },
                            avg_response_time: { type: 'number' },
                            success_count: { type: 'integer' },
                            error_count: { type: 'integer' },
                          },
                        },
                      },
                      top_endpoints: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            endpoint: { type: 'string' },
                            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
                            count: { type: 'integer' },
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
        401: { description: 'Unauthorized' },
        404: { description: 'API key not found' },
      },
    },
  },
  '/api/userApi/logs/{id}': {
    get: {
      tags: ['API Keys'],
      summary: 'Get API request logs',
      description: 'Retrieve recent API request logs with details like endpoint, status code, response time, and IP address',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'API key ID',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 50 },
          description: 'Number of logs to return',
        },
        {
          in: 'query',
          name: 'offset',
          schema: { type: 'integer', default: 0 },
          description: 'Number of logs to skip',
        },
        {
          in: 'query',
          name: 'status_code',
          schema: { type: 'integer' },
          description: 'Filter by HTTP status code',
        },
      ],
      responses: {
        200: {
          description: 'API logs retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      logs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            log_id: { type: 'integer' },
                            endpoint: { type: 'string', example: '/api/payment/link' },
                            method: { type: 'string', example: 'POST' },
                            status_code: { type: 'integer', example: 200 },
                            ip_address: { type: 'string', example: '192.168.1.1' },
                            response_time_ms: { type: 'integer', example: 45 },
                            error_message: { type: 'string', nullable: true },
                            request_time: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          limit: { type: 'integer' },
                          offset: { type: 'integer' },
                          has_more: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'API key not found' },
      },
    },
  },
  '/api/userApi/rateLimit/{id}': {
    put: {
      tags: ['API Keys'],
      summary: 'Update API rate limits',
      description: 'Configure custom rate limits for an API key',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'API key ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                rate_limit_per_minute: {
                  type: 'integer',
                  example: 60,
                  description: 'Maximum requests per minute',
                },
                rate_limit_per_hour: {
                  type: 'integer',
                  example: 3600,
                  description: 'Maximum requests per hour',
                },
                rate_limit_per_day: {
                  type: 'integer',
                  example: 100000,
                  description: 'Maximum requests per day',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Rate limits updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Rate limits updated' },
                  data: {
                    type: 'object',
                    properties: {
                      api_id: { type: 'integer' },
                      rate_limits: {
                        type: 'object',
                        properties: {
                          per_minute: { type: 'integer' },
                          per_hour: { type: 'integer' },
                          per_day: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'No rate limits provided' },
        401: { description: 'Unauthorized' },
        404: { description: 'API key not found' },
      },
    },
  },
  '/api/userApi/addApi': {
    post: {
      tags: ['API Keys'],
      summary: 'Create new API key',
      description: 'Generate a new API key for a company. Supports production and development environments with different capabilities.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['company_id', 'base_currency'],
              properties: {
                company_id: { type: 'integer', description: 'Company ID to associate the API key with' },
                base_currency: { type: 'string', enum: ['USD', 'EUR', 'NGN'], description: 'Base currency for transactions' },
                api_name: { type: 'string', description: 'Custom name for the API key' },
                environment: {
                  type: 'string',
                  enum: ['production', 'development'],
                  default: 'production',
                  description: 'API environment (development keys have sandbox restrictions)',
                },
                permissions: {
                  type: 'array',
                  items: { type: 'string', enum: ['payments', 'transactions', 'webhooks', 'wallets', 'invoices', 'customers'] },
                  default: ['payments', 'transactions', 'webhooks', 'wallets'],
                  description: 'API permissions',
                },
                withdrawal_whitelist: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of whitelisted wallet addresses for withdrawals',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'API key generated successfully',
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
                      apiKey: { type: 'string', description: 'The generated API key (shown only once)' },
                      admin_token: { type: 'string', description: 'Admin token for managing this API' },
                      environment: { type: 'string', enum: ['production', 'development'] },
                      permissions: { type: 'array', items: { type: 'string' } },
                      rate_limit_per_minute: { type: 'integer' },
                      rate_limit_per_hour: { type: 'integer' },
                      rate_limit_per_day: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request (missing wallet for production keys or duplicate key)',
        },
        401: { description: 'Unauthorized' },
        500: { description: 'Company does not exist' },
      },
    },
  },
  '/api/userApi/getApi': {
    get: {
      tags: ['API Keys'],
      summary: 'Get all API keys',
      description: 'Retrieve all API keys for the authenticated user, optionally filtered by environment or status',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'environment',
          schema: { type: 'string', enum: ['production', 'development'] },
          description: 'Filter by environment',
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Filter by company',
        },
        {
          in: 'query',
          name: 'status',
          schema: { type: 'string', enum: ['active', 'inactive', 'revoked'] },
          description: 'Filter by status',
        },
      ],
      responses: {
        200: {
          description: 'API keys retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      all: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ApiKey' },
                      },
                      grouped: {
                        type: 'object',
                        properties: {
                          production: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
                          development: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
                        },
                      },
                      total: { type: 'integer' },
                      production_count: { type: 'integer' },
                      development_count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
      },
    },
  },
};
