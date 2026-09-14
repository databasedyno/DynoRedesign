/**
 * Swagger paths for Admin Analytics endpoints.
 * All endpoints require admin authentication (BearerAuth).
 * Mounted at /api/admin/analytics/*
 */
export const analyticsPaths = {
  '/api/admin/analytics/revenue': {
    get: {
      tags: ['Admin'],
      summary: 'Revenue analytics',
      description: `Retrieve platform revenue analytics for a given period.

**Includes:** Total revenue, fee breakdown, period comparisons, and trends.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'period',
          schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' },
          description: 'Time period for analytics',
        },
      ],
      responses: {
        200: {
          description: 'Revenue analytics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Revenue analytics retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      period: { type: 'string', example: '30d' },
                      total_revenue: { type: 'number', example: 15420.50 },
                      total_transactions: { type: 'integer', example: 342 },
                      avg_transaction_value: { type: 'number', example: 45.09 },
                      fee_revenue: { type: 'number', example: 1542.05 },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Invalid period parameter' },
        401: { description: 'Admin authentication required' },
      },
    },
  },
  '/api/admin/analytics/users': {
    get: {
      tags: ['Admin'],
      summary: 'User growth analytics',
      description: 'Retrieve user growth metrics including signups, active users, and retention data.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'User growth analytics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'User growth analytics retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      total_users: { type: 'integer', example: 1250 },
                      new_users_this_month: { type: 'integer', example: 85 },
                      active_users_30d: { type: 'integer', example: 420 },
                      growth_rate: { type: 'number', example: 7.2 },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Admin authentication required' },
      },
    },
  },
  '/api/admin/analytics/cohorts': {
    get: {
      tags: ['Admin'],
      summary: 'Cohort retention analysis',
      description: `Analyze user retention by weekly cohorts. Shows what percentage of users from each signup week are still active in subsequent weeks.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'weeks',
          schema: { type: 'integer', default: 8, maximum: 52 },
          description: 'Number of weeks to analyze (max 52)',
        },
      ],
      responses: {
        200: {
          description: 'Cohort analysis retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Cohort analysis retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      weeks_analyzed: { type: 'integer', example: 8 },
                      cohorts: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            week: { type: 'string', example: '2026-W05' },
                            cohort_size: { type: 'integer', example: 45 },
                            retention: {
                              type: 'array',
                              items: { type: 'number' },
                              description: 'Retention % for each subsequent week',
                              example: [100, 72, 58, 45, 38],
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
        },
        401: { description: 'Admin authentication required' },
      },
    },
  },
  '/api/admin/analytics/funnel': {
    get: {
      tags: ['Admin'],
      summary: 'Payment funnel analysis',
      description: `Analyze the payment conversion funnel: signup -> company creation -> wallet setup -> first payment.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'days',
          schema: { type: 'integer', default: 30, maximum: 365 },
          description: 'Number of days to analyze (max 365)',
        },
      ],
      responses: {
        200: {
          description: 'Payment funnel analysis retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Payment funnel analysis retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      days_analyzed: { type: 'integer', example: 30 },
                      stages: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            stage: { type: 'string', example: 'signup' },
                            count: { type: 'integer', example: 250 },
                            conversion_rate: { type: 'number', description: '% who proceed to next stage', example: 68.0 },
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
        401: { description: 'Admin authentication required' },
      },
    },
  },
};
