/**
 * Swagger paths for Server-Sent Events (SSE) and Push Notification endpoints.
 * Mounted at /api/events/*
 */
export const eventsPaths = {
  '/api/events/stream': {
    get: {
      tags: ['Real-Time Events'],
      summary: 'SSE event stream',
      description: `Subscribe to real-time Server-Sent Events.

**How it works:**
- Opens a persistent HTTP connection (text/event-stream)
- Server pushes events as they occur (payments, price updates, notifications)
- Connection stays open until client disconnects

**Channels (comma-separated):**
- \`payments\` — Payment status updates (pending, confirmed, failed)
- \`prices\` — Live cryptocurrency price updates
- \`notifications\` — In-app notifications
- \`admin\` — Admin monitoring events (admin only)
- \`dashboard\` — Dashboard live data updates

**Event Types:**
| Event | Channel | Description |
|-------|---------|-------------|
| \`connected\` | (all) | Initial connection confirmation |
| \`payment_update\` | payments | Payment status change |
| \`price_update\` | prices | Crypto price update |
| \`notification\` | notifications | New in-app notification |
| \`announcement\` | (broadcast) | System-wide announcement |

**Example (JavaScript):**
\`\`\`javascript
const es = new EventSource('/api/events/stream?channels=payments,notifications', {
  headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' }
});

es.addEventListener('payment_update', (e) => {
  const data = JSON.parse(e.data);
  console.log('Payment:', data.transaction_id, data.status);
});

es.addEventListener('notification', (e) => {
  const data = JSON.parse(e.data);
  console.log('Notification:', data.title);
});

es.addEventListener('announcement', (e) => {
  const data = JSON.parse(e.data);
  alert(data.title + ': ' + data.message);
});
\`\`\`

**Note:** Requires JWT authentication. Server sends heartbeat every 30s to keep alive.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'channels',
          schema: { type: 'string', default: 'payments,notifications' },
          description: 'Comma-separated list of channels to subscribe to',
          example: 'payments,prices,notifications',
        },
      ],
      responses: {
        200: {
          description: 'SSE stream opened',
          content: {
            'text/event-stream': {
              schema: {
                type: 'string',
                description: 'Server-Sent Events stream',
                example: 'event: payment_update\ndata: {"transaction_id":"TX-123","status":"confirmed","amount":0.05,"currency":"BTC"}\n\n',
              },
            },
          },
        },
        401: { description: 'JWT authentication required' },
      },
    },
  },
  '/api/events/stats': {
    get: {
      tags: ['Real-Time Events'],
      summary: 'SSE connection stats',
      description: 'Get statistics about current SSE connections (number of connected clients, channels, etc.).',
      responses: {
        200: {
          description: 'SSE stats retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'SSE stats' },
                  data: {
                    type: 'object',
                    properties: {
                      total_clients: { type: 'integer', example: 12 },
                      clients_by_channel: {
                        type: 'object',
                        additionalProperties: { type: 'integer' },
                        example: { payments: 8, prices: 5, notifications: 10 },
                      },
                      uptime_seconds: { type: 'integer', example: 30 },
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
  '/api/events/push-stats': {
    get: {
      tags: ['Real-Time Events'],
      summary: 'Push notification service stats',
      description: 'Get statistics about the push notification service, including SSE connection stats and available channels.',
      responses: {
        200: {
          description: 'Push stats retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Push notification stats' },
                  data: {
                    type: 'object',
                    properties: {
                      sse: {
                        type: 'object',
                        properties: {
                          total_clients: { type: 'integer', example: 12 },
                          clients_by_channel: { type: 'object', example: { payments: 8 } },
                          uptime_seconds: { type: 'integer', example: 30 },
                        },
                      },
                      channels_available: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['payments', 'prices', 'notifications', 'admin', 'dashboard'],
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
  '/api/events/broadcast': {
    post: {
      tags: ['Real-Time Events'],
      summary: 'Broadcast system announcement',
      description: `Send a system-wide announcement to all connected SSE clients. Admin only.

**Use cases:**
- Scheduled maintenance notifications
- New feature announcements
- Emergency alerts
- Price alerts

The announcement is delivered as an SSE event with type \`announcement\` to ALL connected clients regardless of channel subscription.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'message'],
              properties: {
                title: { type: 'string', example: 'Scheduled Maintenance', description: 'Announcement title' },
                message: { type: 'string', example: 'Platform will be under maintenance from 2:00-3:00 UTC', description: 'Announcement message' },
                type: { type: 'string', enum: ['system', 'maintenance', 'feature', 'alert'], default: 'system', description: 'Announcement type' },
                data: { type: 'object', description: 'Additional data payload', example: { estimated_downtime: '1 hour' } },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Broadcast sent',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Broadcast sent' },
                  data: {
                    type: 'object',
                    properties: {
                      clients_reached: { type: 'integer', example: 42 },
                      announcement: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          message: { type: 'string' },
                          type: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'title and message are required' },
        401: { description: 'Admin authentication required' },
      },
    },
  },
  '/api/events/push': {
    post: {
      tags: ['Real-Time Events'],
      summary: 'Push notification to user',
      description: `Push a notification to a specific user. Admin only.

Delivers the notification through two channels:
1. **Database** — Persisted as an in-app notification (appears in user's notification center)
2. **SSE** — Real-time delivery if user is connected

Returns delivery status for each channel.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['user_id', 'title', 'message'],
              properties: {
                user_id: { type: 'integer', example: 42, description: 'Target user ID' },
                type: { type: 'string', default: 'system', description: 'Notification type', example: 'security_alert' },
                title: { type: 'string', example: 'Account Security Alert' },
                message: { type: 'string', example: 'New login detected from IP 192.168.1.1' },
                data: { type: 'object', description: 'Additional payload', example: { ip: '192.168.1.1', location: 'New York, US' } },
                company_id: { type: 'integer', description: 'Optional company context', example: 38 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Notification pushed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Notification pushed' },
                  data: {
                    type: 'object',
                    properties: {
                      persisted: { type: 'boolean', example: true, description: 'Whether notification was saved to DB' },
                      sse_delivered: { type: 'boolean', example: true, description: 'Whether SSE event was sent' },
                      notification_id: { type: 'integer', example: 156, description: 'DB notification ID (if persisted)' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'user_id, title, and message are required' },
        401: { description: 'Admin authentication required' },
        500: { description: 'Push delivery failed' },
      },
    },
  },
  '/api/events/admin-event': {
    post: {
      tags: ['Real-Time Events'],
      summary: 'Send admin monitoring event',
      description: `Send a custom event to all clients subscribed to the \`admin\` SSE channel. Admin only.

Used for real-time admin dashboard updates like:
- New payment received
- User registration
- Error spike detected
- Webhook delivery failure`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event'],
              properties: {
                event: { type: 'string', example: 'new_payment', description: 'Event name' },
                data: { type: 'object', description: 'Event payload', example: { transaction_id: 'TX-456', amount: 100, currency: 'BTC' } },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Event sent',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Admin event sent' },
                  data: {
                    type: 'object',
                    properties: {
                      event: { type: 'string', example: 'new_payment' },
                      clients_reached: { type: 'integer', example: 3 },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'event name is required' },
        401: { description: 'Admin authentication required' },
      },
    },
  },
};
