export const userPaths = {
  '/api/user/registerUser': {
    post: {
      tags: ['Authentication'],
      summary: 'Register with email',
      description: `Create a new user account using email and password.
      
**Features:**
- Creates user profile with default avatar
- Generates unique referral code for the user
- Creates default fiat and crypto wallets
- Sends **email verification OTP** (6-digit code, valid 10 minutes)
- Sends welcome email
- If referral_code is provided, links accounts for rewards

**⚠️ Important:** After registration, the user must verify their email via \`POST /api/user/verify-email\` before accessing company, wallet, and dashboard features.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { 
                  type: 'string', 
                  description: '✅ REQUIRED: Full name',
                  example: 'John Doe' 
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Email address',
                  example: 'john@example.com' 
                },
                password: { 
                  type: 'string', 
                  minLength: 6,
                  description: '✅ REQUIRED: Password (min 6 characters)',
                  example: 'SecurePass123@' 
                },
                referral_code: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Referral code from another user',
                  example: 'DYNO2025USR8A2B3C4D5'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Registration successful — email verification OTP sent',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Registered Successful! Please verify your email.' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string', description: 'JWT access token (7 days expiry)' },
                      email_verified: { type: 'boolean', description: 'Always false on registration — verify via POST /api/user/verify-email', example: false },
                      referral_code: { type: 'string', description: 'User\'s unique referral code' },
                      referred_by: { type: 'string', nullable: true, description: 'Referral code used during signup' }
                    }
                  }
                }
              }
            }
          }
        },
        503: { description: 'Account already exists with this email' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/login': {
    post: {
      tags: ['Authentication'],
      summary: 'Login with email and password',
      description: `Authenticate user with email and password credentials.
      
**Returns:**
- User profile data (includes \`email_verified\` status)
- JWT access token (valid for 7 days)
- Company and wallet information

**Note:** If \`email_verified\` is \`false\`, the user should be prompted to verify their email via \`POST /api/user/verify-email\` before accessing gated features.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Registered email address',
                  example: 'john@example.com' 
                },
                password: { 
                  type: 'string',
                  description: '✅ REQUIRED: Account password',
                  example: 'SecurePass123@' 
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Login Successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string', description: 'JWT access token' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Email and password are required' },
        401: { description: 'Invalid email or password' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/forgot-password': {
    post: {
      tags: ['User Management'],
      summary: 'Request password reset',
      description: `Send password reset email with secure token link.
      
**Security Notes:**
- Response is always success (doesn't reveal if email exists)
- Reset token valid for 1 hour
- Link sent to registered email address`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Registered email address',
                  example: 'john@example.com' 
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Reset email sent (if email exists)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'If the email exists, a reset link has been sent' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        400: { description: 'Email is required' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/reset-password': {
    post: {
      tags: ['User Management'],
      summary: 'Reset password with token',
      description: `Reset password using the token received via email.
      
**Requirements:**
- Valid reset token (from email link)
- Token not expired (1 hour validity)
- New password minimum 6 characters`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'email', 'newPassword'],
              properties: {
                token: { 
                  type: 'string',
                  description: '✅ REQUIRED: Reset token from email link',
                  example: 'a1b2c3d4e5f6...'
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Email address',
                  example: 'john@example.com' 
                },
                newPassword: { 
                  type: 'string',
                  minLength: 6,
                  description: '✅ REQUIRED: New password (min 6 characters)',
                  example: 'NewSecurePass123@' 
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Password reset successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Password has been reset successfully' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired reset token' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/google-signin': {
    post: {
      tags: ['User Management'],
      summary: 'Google OAuth login',
      description: `Authenticate or register using Google OAuth.
      
**Accepts either:**
- \`idToken\` - Google ID token from Sign-In
- \`accessToken\` - Google OAuth access token

**Behavior:**
- If user exists: Returns existing user data
- If new user: Creates account and wallets automatically`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                idToken: { 
                  type: 'string',
                  description: '📝 Google ID token (preferred)',
                  example: 'eyJhbGciOiJS...'
                },
                accessToken: { 
                  type: 'string',
                  description: '📝 Google OAuth access token (alternative)',
                  example: 'ya29.a0AfH6SM...'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login/Registration successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Login Successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Google ID token or access token is required' },
        401: { description: 'Invalid Google token' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/registerPhone': {
    post: {
      tags: ['User Management'],
      summary: 'Register with phone number (Step 1)',
      description: 'Initiate phone-based registration by sending SMS OTP',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'password'],
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479', description: '10-15 digits, no symbols' },
                password: { type: 'string', example: 'SecurePass123@' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP sent successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'OTP sent to your phone. Please verify to complete registration.' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid phone format or phone already registered' }
      }
    }
  },
  '/api/user/registerPhone/verify': {
    post: {
      tags: ['User Management'],
      summary: 'Complete phone registration (Step 2)',
      description: 'Verify OTP and create user account',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'password', 'otp'],
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479' },
                password: { type: 'string', example: 'SecurePass123@' },
                otp: { type: 'string', example: '12345', description: '5-digit OTP code' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Registration successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Registration successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' }
      }
    }
  },
  '/api/user/checkEmail': {
    get: {
      tags: ['User Management'],
      summary: 'Check email availability',
      description: 'Check if email is already registered',
      parameters: [{
        in: 'query',
        name: 'email',
        required: true,
        schema: { type: 'string' },
        example: 'user@example.com'
      }],
      responses: {
        200: {
          description: 'Email availability status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  available: { type: 'boolean' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/user/generateOTP': {
    post: {
      tags: ['User Management'],
      summary: 'Generate SMS OTP for login',
      description: 'Send OTP to registered phone number',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile'],
              properties: {
                mobile: { type: 'string', example: '18022100479' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'OTP sent successfully' },
        400: { description: 'Mobile number not registered' }
      }
    }
  },
  '/api/user/confirmOTP': {
    post: {
      tags: ['User Management'],
      summary: 'Verify OTP and login',
      description: 'Confirm OTP code and authenticate user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile', 'otp'],
              properties: {
                mobile: { type: 'string', example: '18022100479' },
                otp: { type: 'string', example: '12345' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' }
      }
    }
  },
  '/api/user/connectSocial': {
    post: {
      tags: ['User Management'],
      summary: 'Social login (Telegram/Generic)',
      description: 'Authenticate with social providers',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['provider', 'id'],
              properties: {
                provider: { type: 'string', example: 'telegram', enum: ['telegram', 'twitter', 'linkedin'] },
                id: { type: 'string', example: '123456789' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'john@example.com' },
                photo: { type: 'string', example: 'https://...' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
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
  '/api/user/facebook-signin': {
    post: {
      tags: ['User Management'],
      summary: 'Facebook OAuth login',
      description: 'Authenticate with Facebook access token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['accessToken'],
              properties: {
                accessToken: { type: 'string', description: 'Facebook access token' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Invalid Facebook token' }
      }
    }
  },
  '/api/user/profile': {
    get: {
      tags: ['User Management'],
      summary: 'Get user profile',
      description: 'Retrieve authenticated user profile',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Profile retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    },
    put: {
      tags: ['User Management'],
      summary: 'Update profile',
      description: 'Update user profile fields (name, mobile, username)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479' },
                username: { type: 'string', example: 'johndoe' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/user/email': {
    put: {
      tags: ['User Management'],
      summary: 'Change email address',
      description: 'Update email with password verification',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newEmail', 'password'],
              properties: {
                newEmail: { type: 'string', format: 'email', example: 'newemail@example.com' },
                password: { type: 'string', example: 'currentPassword' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Email updated successfully' },
        400: { description: 'Email already in use' },
        401: { description: 'Invalid password' }
      }
    },
    delete: {
      tags: ['User Management'],
      summary: 'Remove email from account',
      description: 'Remove email (requires alternative login method)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Email removed successfully' },
        400: { description: 'Cannot remove - no alternative login method' },
        401: { description: 'Invalid password' }
      }
    }
  },
  '/api/user/phone': {
    put: {
      tags: ['User Management'],
      summary: 'Change phone number',
      description: 'Update phone with password verification and SMS confirmation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newPhone', 'password'],
              properties: {
                newPhone: { type: 'string', example: '18022100479' },
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Phone updated successfully' },
        400: { description: 'Phone already in use or invalid format' },
        401: { description: 'Invalid password' }
      }
    },
    delete: {
      tags: ['User Management'],
      summary: 'Remove phone from account',
      description: 'Remove phone (requires alternative login method)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Phone removed successfully' },
        400: { description: 'Cannot remove - no alternative login method' },
        401: { description: 'Invalid password' }
      }
    }
  },
  '/api/user/updateUser': {
    put: {
      tags: ['User Management'],
      summary: 'Update user profile',
      description: `Update user profile with optional image upload.
        
**💡 Swagger UI Usage:**
1. Click "Try it out"
2. Fill in the fields you want to update
3. Optionally upload a profile image
4. Click "Execute"`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  description: 'User full name (required)',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address (required)',
                  example: 'john@example.com'
                },
                image: {
                  type: 'string',
                  format: 'binary',
                  description: 'Profile picture (optional, PNG/JPG)'
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'User updated successfully' },
        400: { description: 'Invalid input' },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/api/user/changePassword': {
    put: {
      tags: ['User Management'],
      summary: 'Change password',
      description: 'Update password with old password verification',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['oldPassword', 'newPassword'],
              properties: {
                oldPassword: { type: 'string' },
                newPassword: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Password updated successfully' },
        500: { description: 'Old password incorrect' }
      }
    }
  },
  '/api/user/account': {
    delete: {
      tags: ['User Management'],
      summary: 'Delete user account',
      description: 'Permanently delete user account with password confirmation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Account deleted successfully' },
        401: { description: 'Invalid password' }
      }
    }
  },
  // ============================================
  // UNSUBSCRIBE ENDPOINTS (No Auth Required)
  // ============================================
  '/api/user/unsubscribe-reminders/{token}': {
    get: {
      tags: ['Email Unsubscribe'],
      summary: 'Unsubscribe from referee code reminders (GET)',
      description: `Unsubscribe from referee code reminder emails using the token from the email link.
      
**No authentication required** - uses the unsubscribe token from the email.

This endpoint is typically accessed by clicking the unsubscribe link in reminder emails.`,
      parameters: [
        {
          in: 'path',
          name: 'token',
          required: true,
          schema: { type: 'string' },
          description: 'Unsubscribe token from the email link'
        }
      ],
      responses: {
        200: {
          description: 'Successfully unsubscribed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully unsubscribed from reminder emails' },
                  data: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', example: 'customer@example.com' },
                      unsubscribed_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'Invalid unsubscribe token' }
      }
    }
  },
  '/api/user/unsubscribe-reminders': {
    post: {
      tags: ['Email Unsubscribe'],
      summary: 'Unsubscribe from referee code reminders (POST)',
      description: `Unsubscribe from referee code reminder emails using a POST request.
      
**No authentication required** - uses the unsubscribe token.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: {
                token: { 
                  type: 'string', 
                  description: 'Unsubscribe token from the email',
                  example: 'abc123def456...'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Successfully unsubscribed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully unsubscribed from reminder emails' },
                  data: {
                    type: 'object',
                    properties: {
                      email: { type: 'string' },
                      unsubscribed_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Token is required' },
        404: { description: 'Invalid unsubscribe token' }
      }
    }
  },
  '/api/user/unsubscribe-payment-reminders/{token}': {
    get: {
      tags: ['Email Unsubscribe'],
      summary: 'Unsubscribe from payment link reminders (GET)',
      description: `Unsubscribe from payment link reminder emails using the token from the email link.
      
**No authentication required** - uses the unsubscribe token from the email.

This endpoint is typically accessed by clicking the unsubscribe link in payment reminder emails.`,
      parameters: [
        {
          in: 'path',
          name: 'token',
          required: true,
          schema: { type: 'string' },
          description: 'Unsubscribe token from the email link'
        }
      ],
      responses: {
        200: {
          description: 'Successfully unsubscribed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully unsubscribed from payment reminder emails' },
                  data: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', example: 'customer@example.com' },
                      unsubscribed_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        404: { description: 'Invalid unsubscribe token' }
      }
    }
  },
  '/api/user/unsubscribe-payment-reminders': {
    post: {
      tags: ['Email Unsubscribe'],
      summary: 'Unsubscribe from payment link reminders (POST)',
      description: `Unsubscribe from payment link reminder emails using a POST request.
      
**No authentication required** - uses the unsubscribe token.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: {
                token: { 
                  type: 'string', 
                  description: 'Unsubscribe token from the email',
                  example: 'abc123def456...'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Successfully unsubscribed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully unsubscribed from payment reminder emails' },
                  data: {
                    type: 'object',
                    properties: {
                      email: { type: 'string' },
                      unsubscribed_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Token is required' },
        404: { description: 'Invalid unsubscribe token' }
      }
    }
  },

  '/api/user/onboarding-status': {
    get: {
      tags: ['User Management'],
      summary: 'Get onboarding status',
      description: `Get comprehensive onboarding/setup status for the authenticated user.

**Use this endpoint to determine:**
- Whether the user has verified their email
- Whether the user has completed wallet setup
- KYC verification status and requirements
- API key configuration status
- Company setup status
- What actions the user needs to take next

**Perfect for frontend apps to:**
- Show/hide setup wizards
- Display progress indicators
- Show relevant CTAs (e.g., "Verify Email", "Add Wallet", "Complete KYC")
- Gate features based on setup completion`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Onboarding status retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Onboarding status retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      email_verification: {
                        type: 'object',
                        description: 'Email verification status',
                        properties: {
                          is_verified: { type: 'boolean', description: 'Whether the user has verified their email', example: false },
                          required_action: { type: 'string', nullable: true, description: 'Action needed if not verified', example: 'Verify your email address' }
                        }
                      },
                      wallet_setup: {
                        type: 'object',
                        description: 'Wallet configuration status',
                        properties: {
                          has_wallet: { type: 'boolean', description: 'Whether user has any wallets', example: true },
                          has_wallet_address: { type: 'boolean', description: 'Whether user has wallet addresses configured', example: false },
                          wallet_count: { type: 'integer', description: 'Number of wallets', example: 2 },
                          address_count: { type: 'integer', description: 'Number of wallet addresses', example: 0 },
                          required_action: { type: 'string', nullable: true, description: 'Action needed if setup incomplete', example: 'Add at least one wallet address to receive payments' }
                        }
                      },
                      kyc_status: {
                        type: 'object',
                        description: 'KYC verification status',
                        properties: {
                          status: { type: 'string', enum: ['not_started', 'pending', 'approved', 'rejected'], example: 'not_started' },
                          requires_kyc: { type: 'boolean', description: 'Whether KYC is required based on volume', example: false },
                          is_approved: { type: 'boolean', description: 'Whether KYC is approved', example: false },
                          total_volume: { type: 'number', description: 'Total transaction volume in USD', example: 1500.00 },
                          threshold: { type: 'number', description: 'Volume threshold that triggers KYC requirement', example: 5000 },
                          required_action: { type: 'string', nullable: true, description: 'Action needed if KYC required', example: null }
                        }
                      },
                      api_key_status: {
                        type: 'object',
                        description: 'API key configuration status',
                        properties: {
                          has_production_key: { type: 'boolean', description: 'Whether user has active production API key', example: false },
                          has_development_key: { type: 'boolean', description: 'Whether user has active development API key', example: true },
                          total_keys: { type: 'integer', description: 'Total number of API keys', example: 1 },
                          required_action: { type: 'string', nullable: true, description: 'Action needed', example: 'Create a production API key for live payments' }
                        }
                      },
                      company_setup: {
                        type: 'object',
                        description: 'Company/business setup status',
                        properties: {
                          has_company: { type: 'boolean', description: 'Whether user has created a company', example: true },
                          company_count: { type: 'integer', description: 'Number of companies', example: 1 },
                          required_action: { type: 'string', nullable: true, description: 'Action needed if no company', example: null }
                        }
                      },
                      onboarding_complete: { 
                        type: 'boolean', 
                        description: 'Whether all essential setup is complete (email verified + company + wallet + KYC if required)',
                        example: false 
                      },
                      next_steps: {
                        type: 'array',
                        description: 'List of actions user should take to complete setup',
                        items: { type: 'string' },
                        example: ['Verify your email address to unlock all features', 'Add a wallet address to receive crypto payments', 'Create a production API key for live payments']
                      }
                    }
                  }
                }
              },
              examples: {
                'New User': {
                  summary: 'New user - needs email verification and setup',
                  value: {
                    message: 'Onboarding status retrieved successfully',
                    data: {
                      email_verification: {
                        is_verified: false,
                        required_action: 'Verify your email address'
                      },
                      wallet_setup: {
                        has_wallet: false,
                        has_wallet_address: false,
                        wallet_count: 0,
                        address_count: 0,
                        required_action: 'Add at least one wallet address to receive payments'
                      },
                      kyc_status: {
                        status: 'not_started',
                        requires_kyc: false,
                        is_approved: false,
                        total_volume: 0,
                        threshold: 5000,
                        required_action: null
                      },
                      api_key_status: {
                        has_production_key: false,
                        has_development_key: false,
                        total_keys: 0,
                        required_action: 'Create a production API key for live payments'
                      },
                      company_setup: {
                        has_company: false,
                        company_count: 0,
                        required_action: 'Create a company to start accepting payments'
                      },
                      onboarding_complete: false,
                      next_steps: [
                        'Verify your email address to unlock all features',
                        'Create a company to start accepting payments',
                        'Add a wallet address to receive crypto payments',
                        'Create a production API key for live payments'
                      ]
                    }
                  }
                },
                'Ready for Payments': {
                  summary: 'Fully setup user',
                  value: {
                    message: 'Onboarding status retrieved successfully',
                    data: {
                      email_verification: {
                        is_verified: true,
                        required_action: null
                      },
                      wallet_setup: {
                        has_wallet: true,
                        has_wallet_address: true,
                        wallet_count: 3,
                        address_count: 5,
                        required_action: null
                      },
                      kyc_status: {
                        status: 'approved',
                        requires_kyc: true,
                        is_approved: true,
                        total_volume: 7500.00,
                        threshold: 5000,
                        required_action: null
                      },
                      api_key_status: {
                        has_production_key: true,
                        has_development_key: true,
                        total_keys: 2,
                        required_action: null
                      },
                      company_setup: {
                        has_company: true,
                        company_count: 1,
                        required_action: null
                      },
                      onboarding_complete: true,
                      next_steps: []
                    }
                  }
                },
                'KYC Required': {
                  summary: 'User needs KYC verification',
                  value: {
                    message: 'Onboarding status retrieved successfully',
                    data: {
                      email_verification: {
                        is_verified: true,
                        required_action: null
                      },
                      wallet_setup: {
                        has_wallet: true,
                        has_wallet_address: true,
                        wallet_count: 2,
                        address_count: 3,
                        required_action: null
                      },
                      kyc_status: {
                        status: 'pending',
                        requires_kyc: true,
                        is_approved: false,
                        total_volume: 5500.00,
                        threshold: 5000,
                        required_action: 'Complete KYC verification'
                      },
                      api_key_status: {
                        has_production_key: true,
                        has_development_key: true,
                        total_keys: 2,
                        required_action: null
                      },
                      company_setup: {
                        has_company: true,
                        company_count: 1,
                        required_action: null
                      },
                      onboarding_complete: false,
                      next_steps: ['Complete KYC verification to continue processing payments']
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Authentication required' },
        500: { description: 'Server error' }
      }
    }
  },

  // ============================================
  // EMAIL VERIFICATION ENDPOINTS
  // ============================================
  '/api/user/verify-email': {
    post: {
      tags: ['Authentication'],
      summary: 'Verify email with OTP',
      description: `Verify the user's email address using the 6-digit OTP code sent during registration.

**Flow:**
1. User registers → receives 6-digit OTP via email
2. User submits the OTP to this endpoint
3. If valid: \`email_verified\` is set to \`true\`, unlocking company/wallet/dashboard features

**Notes:**
- OTP is valid for **10 minutes** after registration or last resend
- After verification, gated features (company, wallet, dashboard) become accessible
- Calling this endpoint when already verified returns success with no side effects`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['otp'],
              properties: {
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit verification code sent to email',
                  example: '482917'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Email verified successfully (or already verified)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Email verified successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      email_verified: { type: 'boolean', example: true }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid or expired OTP',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Verification code has expired. Please request a new one.' }
                }
              }
            }
          }
        },
        401: { description: 'Authentication required' },
        404: { description: 'User not found' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/resend-verification': {
    post: {
      tags: ['Authentication'],
      summary: 'Resend email verification OTP',
      description: `Resend a new 6-digit email verification OTP to the authenticated user's email address.

**Rate limiting:**
- **1 request per 60 seconds** — returns 429 if called too soon
- New OTP replaces the previous one (old code becomes invalid)
- New OTP is valid for **10 minutes**

**Notes:**
- Returns success immediately if the email is already verified
- Uses the existing \`sendEmailVerificationOTPEmail\` email template`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Verification code sent (or email already verified)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Verification code sent to your email.' }
                }
              }
            }
          }
        },
        401: { description: 'Authentication required' },
        404: { description: 'User not found' },
        429: {
          description: 'Rate limited — wait 60 seconds',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Please wait 60 seconds before requesting a new code.' }
                }
              }
            }
          }
        },
        500: { description: 'Server error' }
      }
    }
  }
};
