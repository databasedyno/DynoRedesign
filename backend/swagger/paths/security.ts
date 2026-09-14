/**
 * Swagger paths for Security features:
 * - Two-Factor Authentication (2FA)
 * - Session Management
 * - CSRF Token
 */
export const securityPaths = {
  // ── CSRF ──────────────────────────────────────────────────────────────────
  '/api/csrf-token': {
    get: {
      tags: ['Security'],
      summary: 'Get CSRF token',
      description: `Generate a CSRF token for state-changing requests.

**How it works:**
- Sets a \`dynopay_csrf\` cookie (readable by JavaScript)
- Returns the token in the response body
- Token is valid for 24 hours

**When to use:**
- Required for POST/PUT/DELETE requests that do NOT use Bearer token or x-api-key authentication
- Not needed when using JWT Bearer token (browser does not auto-send Authorization headers)
- Not needed when using API key (x-api-key header)

**Usage:**
1. Call this endpoint to get a token
2. Include the token in \`X-CSRF-Token\` header on subsequent state-changing requests`,
      responses: {
        200: {
          description: 'CSRF token generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csrf_token: { type: 'string', example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' },
                },
              },
            },
          },
        },
      },
    },
  },

  // ── Two-Factor Authentication ─────────────────────────────────────────────
  '/api/user/2fa/setup': {
    post: {
      tags: ['Security'],
      summary: 'Initiate 2FA setup',
      description: `Start 2FA setup for the authenticated user. Returns a QR code, manual secret, and one-time backup codes.

**Important:** Save backup codes securely. They will NOT be shown again.

**Flow:**
1. Call this endpoint to get QR code + backup codes
2. Scan QR with authenticator app (Google Authenticator, Authy, etc.)
3. Call \`/api/user/2fa/verify-setup\` with a code from the app to enable 2FA`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: '2FA setup initiated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '2FA setup initiated. Scan QR code with your authenticator app, then verify with a code.' },
                  data: {
                    type: 'object',
                    properties: {
                      qr_code: { type: 'string', description: 'Data URL of QR code image (base64 PNG)' },
                      secret: { type: 'string', description: 'Manual entry secret for authenticator apps', example: 'JBSWY3DPEHPK3PXP' },
                      backup_codes: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'One-time use backup codes (shown ONCE)',
                        example: ['A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2', 'M3N4O5P6', 'Q7R8S9T0'],
                      },
                      important: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        409: { description: '2FA already enabled for this account' },
      },
    },
  },
  '/api/user/2fa/verify-setup': {
    post: {
      tags: ['Security'],
      summary: 'Verify and enable 2FA',
      description: `Verify the TOTP token from your authenticator app to finalize 2FA setup. Must be called after \`/api/user/2fa/setup\`.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: {
                token: { type: 'string', description: '6-digit TOTP code from authenticator app', example: '123456' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: '2FA enabled successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '2FA has been enabled successfully.' },
                  data: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Invalid verification code or no pending setup' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/user/2fa/validate': {
    post: {
      tags: ['Security'],
      summary: 'Validate 2FA token (login step)',
      description: `Validate a 2FA token during the login flow. Called after initial login returns a \`requires_2fa\` flag.

**Accepts:**
- 6-digit TOTP code from authenticator app
- Or a one-time backup code

**No authentication required** — this is part of the login flow before JWT is issued.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['user_id', 'token'],
              properties: {
                user_id: { type: 'integer', description: 'User ID from login response', example: 42 },
                token: { type: 'string', description: '6-digit TOTP code or backup code', example: '654321' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: '2FA validation successful — returns JWT + session (same as login)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '2FA verification successful. Login complete.' },
                  data: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean', example: true },
                      method: { type: 'string', enum: ['totp', 'backup_code'], example: 'totp' },
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string', description: 'JWT access token' },
                      refreshToken: { type: 'string', description: 'Refresh token for token rotation' },
                      expiresIn: { type: 'integer', example: 3600, description: 'Access token expiry in seconds' },
                      session_id: { type: 'integer', example: 42 },
                      token_type: { type: 'string', example: 'Bearer' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'user_id and token are required' },
        401: { description: 'Invalid 2FA code' },
        404: { description: 'User not found' },
        429: { description: 'Account temporarily locked due to too many failed attempts' },
      },
    },
  },
  '/api/user/2fa/disable': {
    post: {
      tags: ['Security'],
      summary: 'Disable 2FA',
      description: 'Disable two-factor authentication. Requires current password for security.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string', description: 'Current account password', example: 'MySecurePassword123' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: '2FA disabled',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '2FA has been disabled.' },
                  data: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: '2FA is not currently enabled' },
        401: { description: 'Invalid password' },
      },
    },
  },
  '/api/user/2fa/regenerate-backup-codes': {
    post: {
      tags: ['Security'],
      summary: 'Regenerate backup codes',
      description: `Generate a new set of backup codes. **Previous backup codes are immediately invalidated.** Requires current password.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string', description: 'Current account password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'New backup codes generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'New backup codes generated. Save them securely.' },
                  data: {
                    type: 'object',
                    properties: {
                      backup_codes: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['X1Y2Z3A4', 'B5C6D7E8', 'F9G0H1I2', 'J3K4L5M6', 'N7O8P9Q0'],
                      },
                      important: { type: 'string', example: 'Your old backup codes are now invalid. Save these new codes securely.' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Invalid password' },
      },
    },
  },
  '/api/user/2fa/status': {
    get: {
      tags: ['Security'],
      summary: 'Get 2FA status',
      description: 'Check whether 2FA is enabled for the authenticated user.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: '2FA status retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '2FA status retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean', example: true },
                      verified: { type: 'boolean', example: true },
                      created_at: { type: 'string', format: 'date-time' },
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

  // ── Session Management ────────────────────────────────────────────────────
  '/api/user/refresh-token': {
    post: {
      tags: ['Security'],
      summary: 'Refresh access token',
      description: `Exchange a valid refresh token for a new access token + refresh token pair.

**Implements refresh token rotation:** each refresh token can only be used once. After use, a new pair is issued and the old refresh token is invalidated.

**No Bearer token required** — uses the refresh token from the request body.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refresh_token'],
              properties: {
                refresh_token: { type: 'string', description: 'Current refresh token', example: 'eyJhbGciOi...' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Token refreshed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Token refreshed successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string', description: 'New JWT access token' },
                      refreshToken: { type: 'string', description: 'New refresh token (old one is invalidated)' },
                      expiresIn: { type: 'string', example: '7d' },
                      token_type: { type: 'string', example: 'Bearer' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'refresh_token is required' },
        401: { description: 'Invalid or expired refresh token' },
      },
    },
  },
  '/api/user/sessions': {
    get: {
      tags: ['Security'],
      summary: 'List active sessions',
      description: 'Retrieve all active login sessions for the authenticated user, including device info and IP address.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Sessions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Active sessions retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      sessions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            session_id: { type: 'integer', example: 1 },
                            ip_address: { type: 'string', example: '203.0.113.42' },
                            user_agent: { type: 'string', example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...' },
                            created_at: { type: 'string', format: 'date-time' },
                            last_active: { type: 'string', format: 'date-time' },
                            is_current: { type: 'boolean', example: true },
                          },
                        },
                      },
                      total: { type: 'integer', example: 3 },
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
    delete: {
      tags: ['Security'],
      summary: 'Revoke all other sessions',
      description: 'Revoke all sessions except the current one. Useful for "Sign out everywhere else".',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                current_session_id: { type: 'integer', description: 'ID of current session to keep active', example: 1 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Sessions revoked',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Revoked 2 session(s)' },
                  data: {
                    type: 'object',
                    properties: {
                      revoked_count: { type: 'integer', example: 2 },
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
  '/api/user/sessions/{id}': {
    delete: {
      tags: ['Security'],
      summary: 'Revoke a specific session',
      description: 'Revoke a single session by its ID. The user can only revoke their own sessions.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer' },
          description: 'Session ID to revoke',
          example: 5,
        },
      ],
      responses: {
        200: {
          description: 'Session revoked',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Session revoked successfully' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid session ID' },
        401: { description: 'Unauthorized' },
        404: { description: 'Session not found or already revoked' },
      },
    },
  },
  '/api/user/login-history': {
    get: {
      tags: ['Security'],
      summary: 'Get login history',
      description: 'Retrieve recent login history for the authenticated user, including IP, device, and timestamp.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 20, maximum: 100 },
          description: 'Number of records to return (max 100)',
        },
      ],
      responses: {
        200: {
          description: 'Login history retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Login history retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      history: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            session_id: { type: 'integer' },
                            ip_address: { type: 'string', example: '203.0.113.42' },
                            user_agent: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            is_active: { type: 'boolean' },
                          },
                        },
                      },
                      total: { type: 'integer', example: 15 },
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
