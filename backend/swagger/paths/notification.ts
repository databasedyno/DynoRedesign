export const notificationPaths = {
  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'Get all notifications',
      description: `Retrieve paginated list of user notifications.

**Multi-Tenant Filtering:**
- Omit \`company_id\` to get notifications from ALL your companies
- Provide \`company_id\` to filter notifications for a specific company`,
      security: [{ BearerAuth: [] }],
      parameters: [
        { 
          in: 'query', 
          name: 'company_id', 
          schema: { type: 'integer' },
          description: '📝 OPTIONAL: Filter by company ID. Omit to get all companies.'
        },
        { in: 'query', name: 'type', schema: { type: 'string' } },
        { in: 'query', name: 'is_read', schema: { type: 'boolean' } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
      ],
      responses: {
        200: {
          description: 'Notifications retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      notifications: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Notification' }
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
  '/api/notifications/preferences': {
    get: {
      tags: ['Notifications'],
      summary: 'Get notification preferences',
      description: 'Retrieve user\'s notification settings and preferences.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Preferences retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      email_notifications: { type: 'boolean' },
                      push_notifications: { type: 'boolean' },
                      sms_notifications: { type: 'boolean' },
                      payment_alerts: { type: 'boolean' },
                      security_alerts: { type: 'boolean' },
                      marketing_emails: { type: 'boolean' },
                      weekly_summary: { type: 'boolean' }
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
    put: {
      tags: ['Notifications'],
      summary: 'Update notification preferences',
      description: 'Update user\'s notification settings.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email_notifications: { type: 'boolean' },
                push_notifications: { type: 'boolean' },
                sms_notifications: { type: 'boolean' },
                payment_alerts: { type: 'boolean' },
                security_alerts: { type: 'boolean' },
                marketing_emails: { type: 'boolean' },
                weekly_summary: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Preferences updated successfully' },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/notifications/unread-count': {
    get: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
      description: 'Get the count of unread notifications for badge display.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Unread count retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      unread_count: { type: 'integer', example: 5 }
                    }
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
  '/api/notifications/read-all': {
    put: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      description: 'Mark all user notifications as read.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'All notifications marked as read',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'All notifications marked as read' },
                  data: {
                    type: 'object',
                    properties: {
                      updated_count: { type: 'integer' }
                    }
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
  '/api/notifications/{id}/read': {
    put: {
      tags: ['Notifications'],
      summary: 'Mark notification as read',
      description: 'Mark a single notification as read.',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Notification ID'
      }],
      responses: {
        200: { description: 'Notification marked as read' },
        404: { description: 'Notification not found' }
      }
    }
  },
  '/api/notifications/types': {
    get: {
      tags: ['Notifications'],
      summary: 'Get notification types',
      description: 'Retrieve all available notification types',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Notification types retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      types: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            label: { type: 'string' },
                            description: { type: 'string' }
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
      }
    }
  },
  '/api/notifications/{id}': {
    delete: {
      tags: ['Notifications'],
      summary: 'Delete notification',
      description: 'Delete a specific notification',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Notification ID'
      }],
      responses: {
        200: { description: 'Notification deleted' },
        404: { description: 'Notification not found' }
      }
    }
  },
  '/api/notifications/trigger-weekly-summary': {
    post: {
      tags: ['Notifications'],
      summary: 'Trigger weekly summary',
      description: 'Manually trigger weekly summary notification (testing)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user_id: { type: 'integer', description: 'Optional: specific user ID' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Weekly summary triggered',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      results: { type: 'object' }
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
  '/api/notifications/trigger-wallet-reminder': {
    post: {
      tags: ['Notifications'],
      summary: 'Trigger wallet reminder',
      description: 'Manually trigger wallet reminder notification (testing)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user_id: { type: 'integer', description: 'Optional: specific user ID' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet reminder triggered',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      results: { type: 'object' }
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
};
