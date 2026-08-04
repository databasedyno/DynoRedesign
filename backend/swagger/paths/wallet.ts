export const walletPaths = {
  // ============================================
  // WALLET ADDRESS MANAGEMENT
  // For merchant payment forwarding wallets
  // Table: tbl_user_wallet
  // ============================================

  // READ - Get wallet addresses (No OTP required) - PRIMARY ENDPOINT
  '/api/wallet/getWallet': {
    get: {
      tags: ['Wallet Address Management'],
      summary: '📖 Get Wallet Addresses - Grouped by Company',
      description: `✅ **RECOMMENDED ENDPOINT** - Retrieve all cryptocurrency wallet addresses grouped by company.

**This is the main wallet system** that integrates with payment forwarding.

## Features:
- ✅ Returns **CRYPTO wallets only** (FIAT excluded)
- ✅ **Grouped by company** with company_name included
- ✅ Includes balance information & current crypto transfer rates
- ✅ Integrated with payment forwarding system

**No OTP Required** - This is a read-only operation.

## Response Format:
Wallets are grouped by company for easy organization:
\`\`\`json
{
  "data": [
    {
      "company_id": 38,
      "company_name": "Bozzmail",
      "wallets": [{ wallet_id, wallet_type, wallet_address, ... }]
    },
    {
      "company_id": 39,
      "company_name": "Nameword",
      "wallets": [{ ... }]
    }
  ]
}
\`\`\`

**Multi-tenancy:** 
- Omit company_id → Returns all companies' wallets (grouped)
- Provide company_id → Returns only that company's wallets

**Table:** tbl_user_wallet`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'query',
        name: 'company_id',
        schema: { type: 'integer' },
        description: '(Optional) Filter by company ID. If omitted, returns wallets for ALL companies grouped.',
        example: 38
      }],
      responses: {
        200: {
          description: 'Wallet addresses retrieved successfully (grouped by company)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Successfully retrieved 14 wallets from 2 companies' },
                  data: {
                    type: 'array',
                    description: 'Array of companies with their wallets',
                    items: {
                      type: 'object',
                      properties: {
                        company_id: { type: 'integer', example: 38 },
                        company_name: { type: 'string', example: 'Bozzmail' },
                        wallets: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              wallet_id: { type: 'integer', example: 431, description: '⚠️ REQUIRED for update/delete operations' },
                              user_id: { type: 'integer', example: 28 },
                              company_id: { type: 'integer', example: 38 },
                              wallet_type: { type: 'string', example: 'ETH', enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'] },
                              wallet_address: { type: 'string', example: '0x9a7221b5e32d5f99e8da95585835442e29afb38f' },
                              wallet_name: { type: 'string', example: 'ETH Main Wallet', nullable: true },
                              amount: { type: 'number', example: 0 },
                              amount_in_usd: { type: 'string', example: '0.00' },
                              transfer_rate: { type: 'number', example: 0.00043604, description: 'Current crypto-to-USD rate' },
                              currency_type: { type: 'string', example: 'CRYPTO' },
                              createdAt: { type: 'string', example: '2026-01-25T18:17:48.857Z' },
                              updatedAt: { type: 'string', example: '2026-02-02T18:34:43.844Z' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              examples: {
                'all_companies': {
                  summary: 'All companies (no filter)',
                  value: {
                    "message": "Successfully retrieved 14 wallets from 2 companies",
                    "data": [
                      {
                        "company_id": 38,
                        "company_name": "Bozzmail",
                        "wallets": [
                          {
                            "wallet_id": 431,
                            "wallet_type": "ETH",
                            "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
                            "wallet_name": null,
                            "amount": 0.027,
                            "amount_in_usd": "63.49",
                            "transfer_rate": 0.00043604,
                            "currency_type": "CRYPTO"
                          },
                          {
                            "wallet_id": 430,
                            "wallet_type": "BTC",
                            "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
                            "wallet_name": null,
                            "amount": 0,
                            "amount_in_usd": "0.00",
                            "transfer_rate": 0.00001278,
                            "currency_type": "CRYPTO"
                          }
                        ]
                      },
                      {
                        "company_id": 39,
                        "company_name": "Nameword",
                        "wallets": [
                          {
                            "wallet_id": 490,
                            "wallet_type": "ETH",
                            "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
                            "wallet_name": null,
                            "amount": 0,
                            "amount_in_usd": "0.00",
                            "transfer_rate": 0.00043604,
                            "currency_type": "CRYPTO"
                          }
                        ]
                      }
                    ]
                  }
                },
                'single_company': {
                  summary: 'Single company (with filter)',
                  value: {
                    "message": "Successfully retrieved 7 wallets from 1 company",
                    "data": [
                      {
                        "company_id": 38,
                        "company_name": "Bozzmail",
                        "wallets": [
                          { "wallet_id": 430, "wallet_type": "BTC", "wallet_address": "1JH5TnZ..." },
                          { "wallet_id": 431, "wallet_type": "ETH", "wallet_address": "0x9a722..." },
                          { "wallet_id": 432, "wallet_type": "LTC", "wallet_address": "LbTjMGN..." }
                        ]
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },

  // UPDATE - Edit wallet name (NO OTP) or address (OTP required)
  '/api/wallet/address/{id}': {
    put: {
      tags: ['Wallet Address Management'],
      summary: '✏️ Update Wallet Name or Address',
      description: `**Update wallet name (no OTP) or wallet address (OTP required)**

## OTP Requirements:
| Update Type | OTP Required |
|-------------|--------------|
| **wallet_name only** | ❌ No OTP needed |
| **wallet_address** | ✅ OTP required |
| **Both** | ✅ OTP required |

## To update wallet_name only:
Simply send the request with \`wallet_name\` - no OTP needed.

## To update wallet_address:
1. First call \`POST /api/wallet/address/{id}/send-otp\` to receive OTP
2. Then call this endpoint with \`wallet_address\` and \`otp\`

**Table:** tbl_user_addresses`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Wallet address ID (user_address_id)',
        example: 123
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                wallet_name: {
                  type: 'string',
                  description: 'New wallet name (NO OTP required)',
                  example: 'My Primary BTC Wallet'
                },
                wallet_address: {
                  type: 'string',
                  description: 'New wallet address (OTP REQUIRED)',
                  example: '1NewBTCAddress...'
                },
                otp: {
                  type: 'string',
                  description: 'Required ONLY when changing wallet_address',
                  example: '123456',
                  pattern: '^[0-9]{6}$'
                }
              }
            },
            examples: {
              'update_name_only': {
                summary: 'Update wallet name (no OTP)',
                value: {
                  "wallet_name": "My Primary BTC Wallet"
                }
              },
              'update_address': {
                summary: 'Update wallet address (OTP required)',
                value: {
                  "wallet_address": "1NewBTCAddressHere...",
                  "otp": "123456"
                }
              },
              'update_both': {
                summary: 'Update both (OTP required)',
                value: {
                  "wallet_name": "Updated Wallet",
                  "wallet_address": "1NewBTCAddressHere...",
                  "otp": "123456"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet updated successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      user_address_id: { type: 'integer', example: 123 },
                      wallet_name: { type: 'string', example: 'My Primary BTC Wallet' },
                      wallet_address: { type: 'string', example: '1JH5TnZzjYTf1yYwBDLjWoHgk...' },
                      currency: { type: 'string', example: 'BTC' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'OTP is required to update wallet address / Invalid OTP' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet address not found' }
      }
    }
  },

  // CREATE - Step 1: Validate address and send OTP
  '/api/wallet/validateWalletAddress': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '➕ Create Wallet Address - Step 1: Validate & Send OTP',
      description: `**Add a new cryptocurrency wallet address (requires OTP verification)**

## 2-Step Process:
1. **This endpoint** - Validates the wallet address and sends OTP to your email
2. **Then call** \`POST /api/wallet/verifyOtp\` - Enter OTP to complete creation

## Important:
- ✅ Saves to main payment system (tbl_user_wallet)
- ✅ Wallet will appear in \`GET /api/wallet/getWallet\`
- ✅ Integrated with payment forwarding
- ✅ Enforces one-wallet-per-blockchain rule
- 🔒 OTP is tied to specific currency (cannot swap currencies during verification)

## Why OTP?
Security measure to ensure only authorized users can add wallet addresses and prevent cross-currency corruption.

## Next Step:
Check your email for a 6-digit OTP code and call \`/api/wallet/verifyOtp\` with the **SAME currency**`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_address', 'currency', 'company_id'],
              properties: {
                wallet_address: {
                  type: 'string',
                  description: '✅ REQUIRED: Cryptocurrency wallet address',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'SOL', 'POLYGON', 'USDT-POLYGON'],
                  description: '✅ REQUIRED: Cryptocurrency type',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID (multi-tenancy)',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for this wallet',
                  example: 'Main BTC Payment Address',
                  maxLength: 100
                },
                destination_tag: {
                  type: 'integer',
                  description: '📝 OPTIONAL: XRP/RLUSD destination tag for exchange wallets. Required if your XRP/RLUSD wallet is on an exchange.',
                  example: 12345678,
                  nullable: true
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ OTP sent to your email - Proceed to Step 2',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Address validated! OTP sent to your email' },
                  data: {
                    type: 'object',
                    properties: {
                      wallet_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                      wallet_type: { type: 'string', example: 'BTC' },
                      company_id: { type: 'integer', example: 1 },
                      wallet_name: { type: 'string', example: 'Main BTC Payment Address', nullable: true },
                      destination_tag: { type: 'integer', example: 12345678, nullable: true, description: 'XRP/RLUSD destination tag (if provided)' },
                      email: { type: 'string', example: 'jo***@example.com', description: 'Masked email where OTP was sent' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid address format or duplicate address' },
        401: { description: 'Unauthorized' },
        403: { description: 'No access to this company' }
      }
    }
  },

  // CREATE - Step 2: Verify OTP and complete creation
  '/api/wallet/verifyOtp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '➕ Create Wallet Address - Step 2: Verify OTP & Complete',
      description: `**Complete wallet address creation by verifying OTP**

## Prerequisites:
1. Must call \`POST /api/wallet/validateWalletAddress\` first
2. Check your email for the 6-digit OTP code

## After Success:
Wallet address is saved and ready to receive payments!`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['otp', 'wallet_address', 'currency', 'company_id'],
              properties: {
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP from your email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6
                },
                wallet_address: {
                  type: 'string',
                  description: '✅ REQUIRED: Same address from Step 1',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'SOL', 'POLYGON', 'USDT-POLYGON'],
                  description: '✅ REQUIRED: Same currency from Step 1',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Same company_id from Step 1',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Same wallet_name from Step 1',
                  example: 'Main BTC Payment Address'
                },
                destination_tag: {
                  type: 'integer',
                  description: '📝 OPTIONAL: XRP/RLUSD destination tag (same as Step 1)',
                  example: 12345678,
                  nullable: true
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ Wallet address created successfully!',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP verified! Wallet address saved successfully.' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  // UPDATE - Step 1: Send OTP for Update
  '/api/wallet/wallet/update/send-otp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '✏️ Update Wallet - Step 1: Send OTP',
      description: `**Request OTP to update a payment forwarding wallet address**

## 2-Step Process:
1. **This endpoint** - Sends OTP to your email
2. **Then call** \`POST /api/wallet/wallet/update\` - Verify OTP and update

## What Can Be Updated:
- Wallet address (to new crypto address)
- Wallet name (custom display name)
- Currency type (blockchain)

## Multi-Tenant:
✅ Uses company_id for security

**Table:** tbl_user_wallet`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_id'],
              properties: {
                wallet_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Wallet ID to update (from getWallet response)',
                  example: 431
                },
                company_id: {
                  type: 'integer',
                  description: '✅ RECOMMENDED: Company ID for multi-tenant security',
                  example: 38
                }
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
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email' },
                  data: {
                    type: 'object',
                    properties: {
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      current_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                      email: { type: 'string', example: 'jo***@example.com' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'wallet_id is required' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet not found' }
      }
    }
  },

  // UPDATE - Step 2: Verify OTP and Update
  '/api/wallet/wallet/update': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '✏️ Update Wallet - Step 2: Verify OTP & Update',
      description: `**Complete wallet update by verifying OTP**

## Prerequisites:
1. Must call \`POST /api/wallet/wallet/update/send-otp\` first
2. Check your email for 6-digit OTP

## What Can Be Updated:
- \`wallet_address\` - New cryptocurrency address
- \`wallet_name\` - Custom display name
- \`currency\` - Blockchain type (if changing)

## Security:
- ✅ OTP validation
- ✅ Address format validation
- ✅ Currency matching check
- ✅ Multi-tenant security

**Table:** tbl_user_wallet`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_id', 'otp'],
              properties: {
                wallet_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Wallet ID to update',
                  example: 431
                },
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP from email',
                  example: '123456',
                  pattern: '^[0-9]{6}$'
                },
                wallet_address: {
                  type: 'string',
                  description: 'New wallet address (optional)',
                  example: '1NewBTCAddress...'
                },
                wallet_name: {
                  type: 'string',
                  description: 'New wallet name (optional)',
                  example: 'Updated BTC Wallet'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'SOL', 'POLYGON', 'USDT-POLYGON'],
                  description: 'New currency type (optional)',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: 'Company ID for multi-tenant security (optional)',
                  example: 38
                },
                destination_tag: {
                  type: 'integer',
                  description: 'XRP/RLUSD destination tag (optional, set to null to remove)',
                  example: 12345678,
                  nullable: true
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address updated successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      wallet_address: { type: 'string', example: '1NewBTCAddress...' },
                      wallet_name: { type: 'string', example: 'Updated BTC Wallet' },
                      destination_tag: { type: 'integer', example: 12345678, nullable: true },
                      company_id: { type: 'integer', example: 38 }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP / Invalid wallet address' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet not found' }
      }
    }
  },

  // DELETE WITH OTP - Step 1: Send OTP for Delete
  '/api/wallet/wallet/delete/send-otp': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Wallet - Step 1: Send OTP',
      description: `**Request OTP to delete a payment forwarding wallet (SECURE)**

## 2-Step Process:
1. **This endpoint** - Sends OTP to your email
2. **Then call** \`POST /api/wallet/wallet/delete/verify\` - Verify OTP and delete

## Security Features:
- ✅ OTP required (prevents accidental deletion)
- ✅ Multi-tenant security with company_id
- ✅ Warning message in email

**⚠️ Warning:** This action is permanent and cannot be undone!

**Table:** tbl_user_wallet`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_id'],
              properties: {
                wallet_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Wallet ID to delete (from getWallet response)',
                  example: 431
                },
                company_id: {
                  type: 'integer',
                  description: '✅ RECOMMENDED: Company ID for multi-tenant security',
                  example: 38
                }
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
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email' },
                  data: {
                    type: 'object',
                    properties: {
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      wallet_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                      email: { type: 'string', example: 'jo***@example.com' },
                      warning: { type: 'string', example: 'This action is permanent and cannot be undone' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'wallet_id is required' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet not found' }
      }
    }
  },

  // DELETE WITH OTP - Step 2: Verify OTP and Delete
  '/api/wallet/wallet/delete/verify': {
    post: {
      tags: ['Wallet Address Management'],
      summary: '🗑️ Delete Wallet - Step 2: Verify OTP & Delete',
      description: `**Complete wallet deletion by verifying OTP (SECURE)**

## Prerequisites:
1. Must call \`POST /api/wallet/wallet/delete/send-otp\` first
2. Check your email for 6-digit OTP

## Security Features:
- ✅ OTP validation
- ✅ Currency matching check
- ✅ Multi-tenant security
- ✅ Soft delete (clears address, preserves record)

**⚠️ Warning:** This action is permanent and cannot be undone!

**Table:** tbl_user_wallet`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_id', 'otp'],
              properties: {
                wallet_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Wallet ID to delete',
                  example: 431
                },
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP from email',
                  example: '123456',
                  pattern: '^[0-9]{6}$'
                },
                company_id: {
                  type: 'integer',
                  description: 'Company ID for multi-tenant security (optional)',
                  example: 38
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Wallet address removed successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      removed: { type: 'boolean', example: true },
                      wallet_id: { type: 'integer', example: 431 },
                      wallet_type: { type: 'string', example: 'BTC' },
                      company_id: { type: 'integer', example: 38 }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP / Currency mismatch' },
        401: { description: 'Unauthorized' },
        404: { description: 'Wallet not found' }
      }
    }
  },

  // ============================================
  // TRANSACTIONS
  // ============================================

  '/api/wallet/getWalletTransactions/{id}': {
    post: {
      tags: ['Transactions'],
      summary: '📖 Get Wallet Transactions',
      description: `Retrieve transactions for a specific wallet with pagination and filters.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'Wallet ID'
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', default: 1 },
                rowsPerPage: { type: 'integer', default: 10 },
                filters: {
                  type: 'object',
                  properties: {
                    column: { type: 'string', default: 'createdAt' },
                    asc: { type: 'boolean', default: false }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Transactions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
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
    }
  },

  '/api/wallet/getAllTransactions': {
    post: {
      tags: ['Transactions'],
      summary: '📖 Get All Transactions',
      description: `Retrieve all transactions across wallets with pagination and filters.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', default: 1 },
                rowsPerPage: { type: 'integer', default: 10 },
                status: { type: 'string', enum: ['pending', 'done', 'failed', 'expired'] },
                currency: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                company_id: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Transactions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
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
    }
  },

  '/api/wallet/transaction/{id}': {
    get: {
      tags: ['Transactions'],
      summary: '📖 Get Transaction Details',
      description: `Retrieve detailed information about a specific transaction.`,
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'Transaction ID'
      }],
      responses: {
        200: {
          description: 'Transaction details retrieved',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Transaction' }
            }
          }
        },
        404: { description: 'Transaction not found' }
      }
    }
  },

  '/api/wallet/transactions/export': {
    post: {
      tags: ['Transactions'],
      summary: '📥 Export Transactions to CSV',
      description: `Export transactions to CSV file with optional date and status filters.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                status: { type: 'string' },
                company_id: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'CSV file',
          content: {
            'text/csv': {
              schema: { type: 'string' }
            }
          }
        }
      }
    }
  },

  // ============================================
  // CURRENCY & FEES
  // ============================================

  '/api/wallet/getCurrencyRates': {
    post: {
      tags: ['Currency & Fees'],
      summary: '💱 Get Currency Conversion Rates',
      description: `Get current cryptocurrency to fiat conversion rates.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['BTC', 'ETH', 'USDT-TRC20']
                },
                baseCurrency: { type: 'string', default: 'USD', example: 'USD' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Currency rates retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        currency: { type: 'string' },
                        rate: { type: 'number' },
                        usdValue: { type: 'number' }
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

  '/api/wallet/estimateFees': {
    post: {
      tags: ['Currency & Fees'],
      summary: '💰 Estimate Transaction Fees',
      description: `Calculate estimated fees for a transaction before execution.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', example: 100 },
                currency: { type: 'string', example: 'BTC' },
                type: { type: 'string', enum: ['send', 'receive', 'exchange'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fee estimate',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      networkFee: { type: 'number' },
                      platformFee: { type: 'number' },
                      totalFee: { type: 'number' },
                      finalAmount: { type: 'number' }
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

  '/api/wallet/network-fees': {
    get: {
      tags: ['Currency & Fees'],
      summary: '⛽ Get Network Fees',
      description: `Get current blockchain network fees for all supported currencies.`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Network fees retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        currency: { type: 'string' },
                        fast: { type: 'number' },
                        medium: { type: 'number' },
                        slow: { type: 'number' },
                        unit: { type: 'string' }
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

  '/api/wallet/calculate-payment': {
    post: {
      tags: ['Currency & Fees'],
      summary: '🧮 Calculate Payment Amount',
      description: `Calculate the exact payment amount including fees for a customer.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: { type: 'number', description: 'Amount in base currency', example: 100 },
                currency: { type: 'string', description: 'Payment currency', example: 'BTC' },
                baseCurrency: { type: 'string', default: 'USD' },
                feePayer: { type: 'string', enum: ['customer', 'merchant'], default: 'customer' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment calculation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      baseAmount: { type: 'number' },
                      cryptoAmount: { type: 'number' },
                      networkFee: { type: 'number' },
                      platformFee: { type: 'number' },
                      totalAmount: { type: 'number' },
                      rate: { type: 'number' }
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

  '/api/wallet/configured-currencies': {
    get: {
      tags: ['Currency & Fees'],
      summary: '📋 Get Configured Currencies',
      description: `Get list of currencies configured for the merchant.`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Configured currencies',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        currency: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['CRYPTO', 'FIAT'] },
                        enabled: { type: 'boolean' }
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

  // ============================================
  // PAYMENTS & VERIFICATION
  // ============================================

  '/api/wallet/addFunds': {
    post: {
      tags: ['Payments'],
      summary: '💵 Add Funds to Wallet',
      description: `Initiate adding funds to a fiat wallet via card or bank transfer.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'payment_method'],
              properties: {
                amount: { type: 'number', example: 100 },
                currency: { type: 'string', enum: ['USD', 'EUR', 'NGN', 'GBP'] },
                payment_method: { type: 'string', enum: ['card', 'bank_transfer'] },
                card_details: {
                  type: 'object',
                  properties: {
                    number: { type: 'string' },
                    expiry: { type: 'string' },
                    cvv: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment initiated' },
        400: { description: 'Invalid payment details' }
      }
    }
  },

  '/api/wallet/authStep': {
    post: {
      tags: ['Payments'],
      summary: '🔐 3D Secure Authentication Step',
      description: `Handle 3D Secure authentication for card payments.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_ref', 'otp'],
              properties: {
                transaction_ref: { type: 'string' },
                otp: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' },
        400: { description: 'Authentication failed' }
      }
    }
  },

  '/api/wallet/verifyPayment': {
    post: {
      tags: ['Payments'],
      summary: '✅ Verify Payment',
      description: `Verify payment status after completion.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_ref'],
              properties: {
                transaction_ref: { type: 'string' },
                payment_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'success', 'failed'] },
                  data: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/wallet/confirmPayment': {
    post: {
      tags: ['Payments'],
      summary: '✅ Confirm Payment',
      description: `Confirm and finalize a pending payment.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['payment_id'],
              properties: {
                payment_id: { type: 'string' },
                confirmation_code: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment confirmed' },
        400: { description: 'Confirmation failed' }
      }
    }
  },

  '/api/wallet/verifyCryptoPayment': {
    post: {
      tags: ['Payments'],
      summary: '₿ Verify Crypto Payment',
      description: `Verify cryptocurrency payment on blockchain.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['payment_id'],
              properties: {
                payment_id: { type: 'string' },
                tx_hash: { type: 'string', description: 'Blockchain transaction hash' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  confirmations: { type: 'integer' },
                  required_confirmations: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },

  // ============================================
  // ANALYTICS
  // ============================================

  '/api/wallet/getUserAnalytics': {
    post: {
      tags: ['Analytics'],
      summary: '📊 Get User Analytics',
      description: `Get analytics and statistics for the user's wallet activity.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                period: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' },
                company_id: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Analytics data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      total_transactions: { type: 'integer' },
                      total_volume: { type: 'number' },
                      total_fees_paid: { type: 'number' },
                      currency_breakdown: { type: 'object' },
                      daily_stats: { type: 'array', items: { type: 'object' } }
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
  '/api/wallet/getWalletAddresses': {
    get: {
      tags: ['Wallet Address Management'],
      summary: 'Get all wallet addresses',
      description: 'Get all configured wallet addresses for the authenticated user.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'List of wallet addresses', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/WalletAddress' } } } } } } },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/addWalletAddress': {
    post: {
      tags: ['Wallet Address Management'],
      summary: 'Add a new wallet address',
      description: 'Add a new cryptocurrency wallet address for receiving payments. Requires OTP verification.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AddWalletAddressRequest' },
          },
        },
      },
      responses: {
        200: { description: 'Wallet address added', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/WalletAddress' } } } } } },
        400: { description: 'Invalid wallet address or currency' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/sendConfirmationOTP': {
    post: {
      tags: ['Transactions'],
      summary: 'Send confirmation OTP',
      description: 'Send OTP for transaction confirmation.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'OTP sent' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/withdrawAssets': {
    post: {
      tags: ['Transactions'],
      summary: 'Withdraw crypto assets',
      description: 'Withdraw cryptocurrency from wallet to an external address.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currency', 'amount', 'to_address'],
              properties: {
                currency: { type: 'string', example: 'BTC' },
                amount: { type: 'number', example: 0.01 },
                to_address: { type: 'string', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
                otp: { type: 'string', example: '123456' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Withdrawal initiated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { tx_hash: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' } } } } } } } },
        400: { description: 'Insufficient balance or invalid params' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/exchangeCreate': {
    post: {
      tags: ['Transactions'],
      summary: 'Create currency exchange',
      description: 'Create a new currency exchange request between two cryptocurrencies.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['from_currency', 'to_currency', 'amount'],
              properties: {
                from_currency: { type: 'string', example: 'BTC' },
                to_currency: { type: 'string', example: 'USDT' },
                amount: { type: 'number', example: 0.1 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Exchange quote created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { exchange_id: { type: 'string' }, from_currency: { type: 'string' }, to_currency: { type: 'string' }, from_amount: { type: 'number' }, to_amount: { type: 'number' }, rate: { type: 'number' }, expires_at: { type: 'string', format: 'date-time' } } } } } } } },
        400: { description: 'Invalid exchange parameters' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/confirmExchange': {
    post: {
      tags: ['Transactions'],
      summary: 'Confirm currency exchange',
      description: 'Confirm and execute a previously created exchange quote.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['exchange_id'], properties: { exchange_id: { type: 'string' } } } } },
      },
      responses: {
        200: { description: 'Exchange executed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { from_amount: { type: 'number' }, to_amount: { type: 'number' }, tx_hash: { type: 'string' } } } } } } } },
        400: { description: 'Exchange expired or invalid' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/wallet/getExchange': {
    get: {
      tags: ['Transactions'],
      summary: 'Get exchange information',
      description: 'Get available exchange pairs and current rates.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Exchange information' },
        401: { description: 'Unauthorized' },
      },
    },
  },
};
