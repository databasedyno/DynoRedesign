// Status page paths - programmatic definitions with correct HTTP methods.
// Previously this file contained JSDoc @swagger annotations that duplicated
// paths from company.ts, payment.ts, wallet.ts, and invoice.ts.
// Those duplicates have been removed.

export const statusPaths = {
  '/api/status': {
    get: {
      tags: ['Status'],
      summary: 'Get overall system status',
      description: 'Get the overall health status of all Dynopay services.',
      responses: {
        200: {
          description: 'System status',
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['operational', 'degraded', 'major_outage'] }, services: { type: 'array', items: { $ref: '#/components/schemas/ServiceStatus' } } } } } },
        },
        500: { description: 'Internal server error' },
      },
    },
  },
  '/api/status/health': {
    get: {
      tags: ['Status'],
      summary: 'Health check',
      description: 'Quick health check endpoint. Returns 200 if service is healthy.',
      responses: {
        200: { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'healthy' } } } } } },
      },
    },
  },
  '/api/status/check': {
    post: {
      tags: ['Status'],
      summary: 'Trigger health check',
      description: 'Manually trigger a health check and update the status of all services.',
      responses: {
        200: { description: 'Health check completed', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ServiceHealthResult' } } } } },
      },
    },
  },
  '/api/status/services': {
    get: {
      tags: ['Status'],
      summary: 'Get all services status',
      description: 'Get status of all monitored services including uptime and latency.',
      responses: {
        200: {
          description: 'List of service statuses',
          content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/ServiceDetailedStatus' } }, summary: { type: 'object', properties: { total_services: { type: 'integer' }, operational: { type: 'integer' }, degraded: { type: 'integer' }, outage: { type: 'integer' }, overall_status: { type: 'string', enum: ['operational', 'degraded', 'major_outage'] }, overall_uptime: { type: 'string', example: '99.95%' }, last_check: { type: 'string', format: 'date-time' } } } } } } },
        },
        500: { description: 'Internal server error' },
      },
    },
  },
  '/api/status/services/uptime': {
    get: {
      tags: ['Status'],
      summary: 'Get all services uptime',
      description: 'Get uptime history for all services over the specified period.',
      parameters: [
        { name: 'period', in: 'query', schema: { type: 'integer', default: 90 }, description: 'Number of days of history (default 90)' },
      ],
      responses: {
        200: {
          description: 'Uptime history for all services',
          content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/ServiceUptimeHistory' } }, period_days: { type: 'integer' }, overall_summary: { type: 'object', properties: { avg_uptime: { type: 'string', example: '99.95%' }, total_outage_hours: { type: 'number' } } } } } } },
        },
      },
    },
  },
  '/api/status/service/{serviceId}': {
    get: {
      tags: ['Status'],
      summary: 'Get service status',
      description: 'Get detailed status of a specific service.',
      parameters: [{ name: 'serviceId', in: 'path', required: true, schema: { type: 'string' }, description: 'Service identifier (e.g., api_gateway, blockchain, database)' }],
      responses: {
        200: { description: 'Service status details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/ServiceDetailedStatus' } } } } } },
        404: { description: 'Service not found' },
      },
    },
  },
  '/api/status/service/{serviceId}/uptime': {
    get: {
      tags: ['Status'],
      summary: 'Get service uptime history',
      description: 'Get uptime history for a specific service.',
      parameters: [
        { name: 'serviceId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'period', in: 'query', schema: { type: 'integer', default: 90 }, description: 'Days of history' },
      ],
      responses: {
        200: { description: 'Service uptime history', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/ServiceUptimeHistory' } } } } } },
        404: { description: 'Service not found' },
      },
    },
  },
  '/api/status/uptime': {
    get: {
      tags: ['Status'],
      summary: 'Get uptime chart data',
      description: 'Get uptime chart data for the status page visualization.',
      parameters: [
        { name: 'period', in: 'query', schema: { type: 'integer', default: 90 } },
      ],
      responses: {
        200: { description: 'Uptime chart data' },
      },
    },
  },
  '/api/status/incidents': {
    get: {
      tags: ['Status'],
      summary: 'Get incidents',
      description: 'Get list of incidents with pagination.',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      ],
      responses: {
        200: { description: 'List of incidents', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Incident' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } },
      },
    },
  },
  '/api/status/incidents/{id}': {
    get: {
      tags: ['Status'],
      summary: 'Get incident details',
      description: 'Get detailed information about a specific incident.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Incident details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Incident' } } } } } },
        404: { description: 'Incident not found' },
      },
    },
  },
};
