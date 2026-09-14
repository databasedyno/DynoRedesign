export const knowledgeBasePaths = {
  '/api/kb/categories': {
    get: {
      tags: ['Knowledge Base'],
      summary: 'Get all categories',
      description: 'Retrieve all active knowledge base categories with article counts',
      responses: {
        200: {
          description: 'Categories retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      categories: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/KBCategory' },
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
  '/api/kb/articles': {
    get: {
      tags: ['Knowledge Base'],
      summary: 'Get articles',
      description: 'Retrieve knowledge base articles with optional category filter',
      parameters: [
        {
          in: 'query',
          name: 'category_id',
          schema: { type: 'integer' },
          description: 'Filter by category ID',
        },
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Items per page',
        },
        {
          in: 'query',
          name: 'published_only',
          schema: { type: 'string', default: 'true', enum: ['true', 'false'] },
          description: 'Return only published articles',
        },
      ],
      responses: {
        200: {
          description: 'Articles retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      articles: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/KBArticle' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
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
  '/api/kb/articles/{slug}': {
    get: {
      tags: ['Knowledge Base'],
      summary: 'Get article by slug',
      description: 'Retrieve a single knowledge base article by its URL slug. Increments the view count.',
      parameters: [
        {
          in: 'path',
          name: 'slug',
          required: true,
          schema: { type: 'string' },
          description: 'Article URL slug',
          example: 'getting-started-with-crypto-payments',
        },
      ],
      responses: {
        200: {
          description: 'Article retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      article: { $ref: '#/components/schemas/KBArticle' },
                    },
                  },
                },
              },
            },
          },
        },
        404: { description: 'Article not found' },
      },
    },
  },
  '/api/kb/search': {
    get: {
      tags: ['Knowledge Base'],
      summary: 'Search articles',
      description: 'Full-text search across article titles, content, excerpts, and keywords',
      parameters: [
        {
          in: 'query',
          name: 'q',
          required: true,
          schema: { type: 'string', minLength: 2 },
          description: 'Search query (minimum 2 characters)',
          example: 'payment',
        },
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Items per page',
        },
      ],
      responses: {
        200: {
          description: 'Search results retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      query: { type: 'string' },
                      articles: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/KBArticle' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Search query must be at least 2 characters' },
      },
    },
  },
  '/api/kb/popular': {
    get: {
      tags: ['Knowledge Base'],
      summary: 'Get popular articles',
      description: 'Retrieve the most viewed knowledge base articles',
      parameters: [
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 5 },
          description: 'Number of articles to return',
        },
      ],
      responses: {
        200: {
          description: 'Popular articles retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      articles: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            article_id: { type: 'integer' },
                            title: { type: 'string' },
                            slug: { type: 'string' },
                            excerpt: { type: 'string' },
                            views_count: { type: 'integer' },
                            reading_time_minutes: { type: 'integer' },
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
    },
  },
  '/api/kb/articles/{id}/feedback': {
    post: {
      tags: ['Knowledge Base'],
      summary: 'Submit article feedback',
      description: 'Submit feedback on whether an article was helpful',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'Article ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['is_helpful'],
              properties: {
                is_helpful: { type: 'boolean', description: 'Whether the article was helpful' },
                feedback_text: { type: 'string', description: 'Optional feedback text' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Feedback submitted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Thank you for your feedback!' },
                  data: {
                    type: 'object',
                    properties: {
                      helpful_count: { type: 'integer' },
                      not_helpful_count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'is_helpful must be a boolean value' },
        404: { description: 'Article not found' },
      },
    },
  },
  '/api/kb/admin/articles': {
    post: {
      tags: ['Knowledge Base'],
      summary: 'Create article (Admin)',
      description: 'Create a new knowledge base article. Requires admin authentication.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'slug', 'content'],
              properties: {
                category_id: { type: 'integer' },
                title: { type: 'string', example: 'Getting Started with Crypto Payments' },
                slug: { type: 'string', example: 'getting-started-with-crypto-payments' },
                excerpt: { type: 'string', description: 'Short summary of the article' },
                content: { type: 'string', description: 'Full article content in markdown' },
                content_html: { type: 'string', description: 'HTML version of content' },
                featured_image_url: { type: 'string', format: 'uri' },
                meta_title: { type: 'string' },
                meta_description: { type: 'string' },
                meta_keywords: { type: 'string' },
                is_published: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Article created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      article: { $ref: '#/components/schemas/KBArticle' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Missing required fields or slug already exists' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/kb/admin/articles/{id}': {
    put: {
      tags: ['Knowledge Base'],
      summary: 'Update article (Admin)',
      description: 'Update an existing knowledge base article',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'Article ID',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                category_id: { type: 'integer' },
                title: { type: 'string' },
                slug: { type: 'string' },
                excerpt: { type: 'string' },
                content: { type: 'string' },
                content_html: { type: 'string' },
                featured_image_url: { type: 'string' },
                meta_title: { type: 'string' },
                meta_description: { type: 'string' },
                meta_keywords: { type: 'string' },
                is_published: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Article updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      article: { $ref: '#/components/schemas/KBArticle' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Article not found' },
      },
    },
    delete: {
      tags: ['Knowledge Base'],
      summary: 'Delete article (Admin)',
      description: 'Delete a knowledge base article',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'Article ID',
        },
      ],
      responses: {
        200: { description: 'Article deleted successfully' },
        401: { description: 'Unauthorized' },
        404: { description: 'Article not found' },
      },
    },
  },
};
