export const referralPaths = {
  // ============================================
  // TYPE 1: USER REFERRAL CODE (Organic Growth)
  // ============================================
  '/api/referral/my-code': {
    get: {
      tags: ['Referral - User Code'],
      summary: 'Get my referral code',
      description: 'Retrieve the authenticated user\'s referral code, stats, and referral link. This is the user\'s permanent referral code that can be shared unlimited times.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Referral code retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Referral code retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      referral_code: { type: 'string', example: 'DYNO2026JOH4C9DB0E1' },
                      referral_link: { type: 'string', format: 'uri', example: 'https://dynopay.com/signup?ref=DYNO2026JOH4C9DB0E1' },
                      stats: {
                        type: 'object',
                        properties: {
                          total_referrals: { type: 'integer', example: 5 },
                          pending_referrals: { type: 'integer', example: 2 },
                          active_referrals: { type: 'integer', example: 1 },
                          rewarded_referrals: { type: 'integer', example: 2 },
                          total_earnings: { type: 'string', example: '20.00' },
                        },
                      },
                      user: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', example: 'John Doe' },
                          email: { type: 'string', format: 'email', example: 'john@example.com' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized - Please login' },
        404: { description: 'User not found' },
      },
    },
  },
  '/api/referral/list': {
    get: {
      tags: ['Referral - User Code'],
      summary: 'List my referrals',
      description: 'Get a paginated list of users referred by the authenticated user',
      security: [{ BearerAuth: [] }],
      parameters: [
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
          name: 'status',
          schema: { type: 'string', enum: ['pending', 'active', 'rewarded', 'expired'] },
          description: 'Filter by referral status',
        },
      ],
      responses: {
        200: {
          description: 'Referrals retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      referrals: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Referral' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
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
  '/api/referral/earnings': {
    get: {
      tags: ['Referral - User Code'],
      summary: 'Get referral earnings',
      description: 'Retrieve the authenticated user\'s referral rewards and earnings summary',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Earnings retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      summary: {
                        type: 'object',
                        properties: {
                          total_earnings: { type: 'number', example: 50.00 },
                          pending_earnings: { type: 'number', example: 10.00 },
                          credited_earnings: { type: 'number', example: 30.00 },
                          withdrawn_earnings: { type: 'number', example: 10.00 },
                        },
                      },
                      rewards: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ReferralReward' },
                      },
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
  '/api/referral/validate': {
    post: {
      tags: ['Referral - User Code'],
      summary: 'Validate user referral code',
      description: 'Check if a user referral code (format: DYNO2026XXXXXXXXX) is valid and get info about the referrer. Use this during signup.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['referral_code'],
              properties: {
                referral_code: { type: 'string', example: 'DYNO2026JOH4C9DB0E1', description: 'User referral code in format DYNO{YEAR}{NAME}{RANDOM}' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referral code is valid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Referral code is valid' },
                  valid: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      referrer_name: { type: 'string', example: 'John Doe' },
                      bonus_info: {
                        type: 'object',
                        properties: {
                          referrer_bonus: { type: 'string', example: "Earn 25% of the referred merchant's fees as credit for 12 months" },
                          referee_discount: { type: 'string', example: '50% off fees for 30 days' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Referral code is required' },
        404: { description: 'Invalid referral code' },
      },
    },
  },
  '/api/referral/apply': {
    post: {
      tags: ['Referral - User Code'],
      summary: 'Apply user referral code',
      description: "Apply a user referral code during signup. The new user gets 50% off fees for 30 days. The referrer earns 25% of the referred merchant's fees as credit for 12 months, starting after the referee completes their first $100+ transaction.",
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['referral_code', 'user_id'],
              properties: {
                referral_code: { type: 'string', example: 'DYNO2026JOH4C9DB0E1' },
                user_id: { type: 'integer', description: 'The ID of the newly registered user' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referral code applied successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      referral_id: { type: 'integer' },
                      status: { type: 'string', example: 'pending' },
                      bonus_info: {
                        type: 'object',
                        properties: {
                          referrer_bonus: { type: 'string' },
                          referee_discount: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Bad request (missing fields, self-referral, or already applied)' },
        404: { description: 'Invalid referral code' },
      },
    },
  },
  '/api/referral/leaderboard': {
    get: {
      tags: ['Referral - User Code'],
      summary: 'Get referral leaderboard',
      description: 'Retrieve the top referrers by referral count (public endpoint)',
      parameters: [
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Number of top referrers to return',
        },
      ],
      responses: {
        200: {
          description: 'Leaderboard retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      leaderboard: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            rank: { type: 'integer', example: 1 },
                            user_id: { type: 'integer', example: 123 },
                            name: { type: 'string', example: 'John Doe' },
                            referral_count: { type: 'integer', example: 25 },
                            total_earnings: { type: 'number', example: 250.00 },
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

  // ============================================
  // TYPE 2: REFEREE CODE (Payment Link Conversion)
  // ============================================
  '/api/referral/referee/validate': {
    post: {
      tags: ['Referral - Referee Code'],
      summary: 'Validate referee code',
      description: 'Validate a referee code (format: REF-XXXXXXXX) received via payment link email. These codes are one-time use and expire after 30 days.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', example: 'REF-45575572', description: 'Referee code from payment link email' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referee code is valid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Valid referee code' },
                  valid: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      discount_percent: { type: 'number', example: 50 },
                      discount_duration_days: { type: 'integer', example: 90 },
                      expires_at: { type: 'string', format: 'date-time', example: '2026-03-01T15:15:31.677Z' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { 
          description: 'Invalid request or code already used/expired',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Referee code has already been used' },
                  valid: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        404: { description: 'Invalid referee code' },
      },
    },
  },
  '/api/referral/referee/redeem': {
    post: {
      tags: ['Referral - Referee Code'],
      summary: 'Redeem referee code',
      description: 'Redeem a referee code during/after signup. The new user gets 50% off fees for 90 days. The merchant who sent the payment link gets 10% off fees for 30 days.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'user_id'],
              properties: {
                code: { type: 'string', example: 'REF-45575572', description: 'Referee code to redeem' },
                user_id: { type: 'integer', example: 123, description: 'ID of the new user redeeming the code' },
                email: { type: 'string', format: 'email', example: 'newuser@example.com', description: 'Email of the new user (optional)' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referee code redeemed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Welcome! You have 50% off fees for 90 days' },
                  discountPercent: { type: 'number', example: 50 },
                  discountDays: { type: 'integer', example: 90 },
                  expiresAt: { type: 'string', format: 'date-time' },
                  referrerUserId: { type: 'integer', description: 'ID of the merchant who sent the code' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request, code already used, or code expired' },
      },
    },
  },

  // ============================================
  // FEE DISCOUNT STATUS
  // ============================================
  '/api/referral/discount-status': {
    get: {
      tags: ['Referral - Fee Discount'],
      summary: 'Get discount status',
      description: 'Get the authenticated user\'s current fee discount status, including discount percentage, expiration date, and reason.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Discount status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Discount status retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      has_discount: { type: 'boolean', example: true },
                      discount_percent: { type: 'number', example: 50 },
                      expires_at: { type: 'string', format: 'date-time', example: '2026-04-01T00:00:00.000Z' },
                      reason: { 
                        type: 'string', 
                        enum: ['referee_code', 'user_referral_referee', 'user_referral_referrer', 'referrer_reward', 'promo'],
                        example: 'referee_code' 
                      },
                      days_remaining: { type: 'integer', example: 45 },
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
