export const subscriptionPaths = {
  '/api/subscriptions': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get all subscriptions',
      description: 'Retrieve paginated list of subscriptions',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'company_id', schema: { type: 'integer' }, description: 'Filter by company' },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'paused', 'cancelled', 'expired'] } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }
      ],
      responses: {
        200: {
          description: 'Subscriptions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      subscriptions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Subscription' }
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    },
    post: {
      tags: ['Subscriptions'],
      summary: 'Create recurring subscription',
      description: `Create a new recurring payment subscription for a customer.
      
**Subscription Features:**
- Automatic recurring billing
- Flexible billing intervals (daily, weekly, monthly, yearly)
- Multiple currency support
- Optional start and end dates
- Customizable metadata

**Billing Intervals:**
- \`daily\` - Charged every day
- \`weekly\` - Charged every 7 days
- \`monthly\` - Charged on same day each month
- \`yearly\` - Charged on same date each year

**Note:** First payment is processed immediately upon subscription creation.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['customer_email', 'amount', 'currency', 'interval', 'company_id'],
              properties: {
                customer_email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Customer email address',
                  example: 'customer@example.com'
                },
                customer_name: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Customer full name',
                  example: 'John Doe'
                },
                amount: { 
                  type: 'number', 
                  description: '✅ REQUIRED: Subscription amount per billing cycle',
                  example: 29.99,
                  minimum: 1.00
                },
                currency: { 
                  type: 'string', 
                  enum: ['USD', 'EUR', 'NGN', 'GBP'], 
                  description: '✅ REQUIRED: Currency code',
                  default: 'USD',
                  example: 'USD'
                },
                interval: { 
                  type: 'string', 
                  enum: ['daily', 'weekly', 'monthly', 'yearly'], 
                  description: '✅ REQUIRED: Billing frequency',
                  example: 'monthly' 
                },
                company_id: { 
                  type: 'integer',
                  description: '✅ REQUIRED: Your company ID receiving payments. Get from GET /api/company/getCompany',
                  example: 1
                },
                description: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Subscription description shown to customer',
                  example: 'Premium Plan - Monthly Subscription'
                },
                start_date: { 
                  type: 'string', 
                  format: 'date',
                  description: '📝 OPTIONAL: When to start billing (defaults to now)',
                  example: '2024-02-01'
                },
                end_date: { 
                  type: 'string', 
                  format: 'date',
                  description: '📝 OPTIONAL: When to stop billing (defaults to never)',
                  example: '2025-02-01'
                },
                metadata: { 
                  type: 'object',
                  description: '📝 OPTIONAL: Custom data for your reference',
                  example: { plan_tier: 'premium', user_id: '12345' }
                }
              }
            },
            examples: {
              'Monthly Subscription': {
                summary: '📅 Basic monthly subscription',
                value: {
                  customer_email: 'customer@example.com',
                  amount: 29.99,
                  currency: 'USD',
                  interval: 'monthly',
                  company_id: 38,
                  description: 'Premium Plan - Monthly'
                }
              },
              'Annual Subscription': {
                summary: '📆 Annual subscription with savings',
                value: {
                  customer_email: 'customer@example.com',
                  customer_name: 'John Doe',
                  amount: 299.00,
                  currency: 'USD',
                  interval: 'yearly',
                  company_id: 38,
                  description: 'Premium Plan - Annual (Save 17%)',
                  metadata: { plan_tier: 'premium', discount: '17%' }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Subscription created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Subscription created successfully' },
                  data: { $ref: '#/components/schemas/Subscription' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid subscription data' }
      }
    }
  },
  '/api/subscriptions/{id}': {
    get: {
      tags: ['Subscriptions'],
      summary: 'Get subscription by ID',
      description: 'Retrieve detailed subscription information',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Subscription ID'
      }],
      responses: {
        200: {
          description: 'Subscription retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/Subscription' }
                }
              }
            }
          }
        },
        404: { description: 'Subscription not found' }
      }
    },
    put: {
      tags: ['Subscriptions'],
      summary: 'Update subscription',
      description: 'Update subscription status or details',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['active', 'paused', 'cancelled'] },
                amount: { type: 'number' },
                interval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
                end_date: { type: 'string', format: 'date' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Subscription updated' },
        400: { description: 'Invalid update data' },
        404: { description: 'Subscription not found' }
      }
    },
    delete: {
      tags: ['Subscriptions'],
      summary: 'Cancel subscription',
      description: 'Cancel an active subscription',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' }
      }],
      responses: {
        200: { description: 'Subscription cancelled' },
        404: { description: 'Subscription not found' }
      }
    }
  }
};
