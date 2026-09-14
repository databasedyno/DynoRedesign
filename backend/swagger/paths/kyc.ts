export const kycPaths = {
  '/api/kyc/status': {
    get: {
      tags: ['KYC Verification'],
      summary: 'Get KYC status',
      description: `Get the current KYC verification status for the authenticated user.

**Status Values:**
- \`not_started\` - User hasn't initiated KYC
- \`pending\` - Verification in progress
- \`approved\` - User is verified
- \`declined\` - Verification was rejected
- \`resubmission_requested\` - Additional documents needed
- \`expired\` - Session expired, needs restart`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'KYC status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'KYC status retrieved' },
                  data: {
                    type: 'object',
                    properties: {
                      status: { 
                        type: 'string', 
                        enum: ['not_started', 'pending', 'approved', 'declined', 'resubmission_requested', 'expired'],
                        example: 'pending'
                      },
                      veriff_session_id: { type: 'string', nullable: true },
                      veriff_session_url: { type: 'string', format: 'uri', nullable: true },
                      veriff_decision: { type: 'string', nullable: true },
                      rejection_reason: { type: 'string', nullable: true },
                      submitted_at: { type: 'string', format: 'date-time', nullable: true },
                      reviewed_at: { type: 'string', format: 'date-time', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Please login' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/kyc/requirements': {
    get: {
      tags: ['KYC Verification'],
      summary: 'Get KYC requirements',
      description: `Get the list of required documents and information for KYC verification.

**Document Types:**
- Government ID (passport, driver's license, national ID)
- Proof of address (utility bill, bank statement)
- Selfie verification`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'KYC requirements retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      required_documents: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', example: 'government_id' },
                            description: { type: 'string' },
                            accepted_formats: { 
                              type: 'array', 
                              items: { type: 'string' },
                              example: ['passport', 'drivers_license', 'national_id']
                            }
                          }
                        }
                      },
                      volume_threshold: { 
                        type: 'number', 
                        description: 'Transaction volume threshold requiring KYC (USD)',
                        example: 10000
                      }
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
  '/api/kyc/history': {
    get: {
      tags: ['KYC Verification'],
      summary: 'Get KYC history',
      description: 'Get the verification history for the authenticated user, including all past submissions and decisions.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'KYC history retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      history: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            kyc_id: { type: 'integer' },
                            status: { type: 'string' },
                            veriff_decision: { type: 'string', nullable: true },
                            veriff_decision_code: { type: 'string', nullable: true },
                            veriff_reason: { type: 'string', nullable: true },
                            submitted_at: { type: 'string', format: 'date-time' },
                            reviewed_at: { type: 'string', format: 'date-time', nullable: true }
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
        401: { description: 'Unauthorized' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/kyc/submit': {
    post: {
      tags: ['KYC Verification'],
      summary: 'Start KYC verification',
      description: `Initiate a new KYC verification session with Veriff.

**Process:**
1. Creates a Veriff session for the user
2. Returns a session URL to redirect the user
3. User completes verification on Veriff's platform
4. Webhook receives the verification result

**Note:** Company ID is optional. If not provided, uses the user's default company.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                company_id: { 
                  type: 'integer', 
                  description: 'Optional: Company ID for the KYC record',
                  example: 1
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'KYC session created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'KYC verification session created' },
                  data: {
                    type: 'object',
                    properties: {
                      session_id: { type: 'string', description: 'Veriff session ID' },
                      session_url: { type: 'string', format: 'uri', description: 'URL to redirect user for verification' },
                      status: { type: 'string', example: 'pending' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Verification already in progress or approved' },
        401: { description: 'Unauthorized' },
        500: { description: 'Failed to create Veriff session' }
      }
    }
  },
  '/api/kyc/resubmit': {
    post: {
      tags: ['KYC Verification'],
      summary: 'Resubmit KYC verification',
      description: `Restart KYC verification after a previous rejection or expiration.

**Use Cases:**
- Previous verification was declined
- Session expired before completion
- Resubmission was requested by Veriff`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                company_id: { 
                  type: 'integer', 
                  description: 'Optional: Company ID for the KYC record'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'KYC resubmission session created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'KYC verification resubmitted' },
                  data: {
                    type: 'object',
                    properties: {
                      session_id: { type: 'string' },
                      session_url: { type: 'string', format: 'uri' },
                      status: { type: 'string', example: 'pending' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Cannot resubmit - verification is approved or pending' },
        401: { description: 'Unauthorized' },
        500: { description: 'Failed to create Veriff session' }
      }
    }
  },
  '/api/kyc/webhook': {
    post: {
      tags: ['KYC Verification'],
      summary: 'Veriff webhook endpoint',
      description: `Webhook endpoint for receiving Veriff verification decisions.

**⚠️ Internal Use Only**

This endpoint is called by Veriff's servers when a verification decision is made.
The request is authenticated using HMAC signature verification.

**Decision Types:**
- \`approved\` - User is verified
- \`declined\` - Verification failed
- \`resubmission_requested\` - Additional documents needed
- \`expired\` - Session expired`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                verification: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string' },
                    code: { type: 'integer' },
                    reason: { type: 'string', nullable: true }
                  }
                },
                technicalData: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Webhook processed successfully' },
        400: { description: 'Invalid webhook payload' },
        401: { description: 'Invalid HMAC signature' }
      }
    }
  }
};
