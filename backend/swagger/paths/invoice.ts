export const invoicePaths = {
  '/api/transactions/{id}/invoice': {
    get: {
      tags: ['Transactions', 'Invoices'],
      summary: 'Get invoice for a transaction',
      description: `Generate or retrieve the invoice for a specific transaction.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Transaction ID',
          example: 'a3f2e1d4-c5b6-a789-0fed-cba987654321'
        }
      ],
      responses: {
        200: {
          description: 'Invoice retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/Invoice' }
                }
              }
            }
          }
        },
        404: { description: 'Transaction not found' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  '/api/invoices': {
    get: {
      tags: ['Invoices'],
      summary: 'Get all invoices',
      description: `Retrieve all invoices for the authenticated user.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number'
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Items per page'
        },
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Filter by company ID'
        }
      ],
      responses: {
        200: {
          description: 'Invoices retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Invoice' }
                  },
                  pagination: { $ref: '#/components/schemas/Pagination' }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    }
  },

  '/api/invoices/{id}': {
    get: {
      tags: ['Invoices'],
      summary: 'Get invoice by ID',
      description: `Retrieve a specific invoice by its ID.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Invoice ID',
          example: 'INV-2026-0001'
        }
      ],
      responses: {
        200: {
          description: 'Invoice retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/Invoice' }
                }
              }
            }
          }
        },
        404: { description: 'Invoice not found' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  '/api/invoices/{id}/pdf': {
    get: {
      tags: ['Invoices'],
      summary: 'Download invoice as PDF',
      description: `Download a specific invoice as a PDF file.

**Authentication:** Requires JWT token (Bearer Auth).`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Invoice ID',
          example: 'INV-2026-0001'
        }
      ],
      responses: {
        200: {
          description: 'PDF generated successfully',
          content: {
            'application/pdf': {
              schema: {
                type: 'string',
                format: 'binary'
              }
            }
          }
        },
        404: { description: 'Invoice not found' },
        401: { description: 'Unauthorized' }
      }
    }
  },
};
