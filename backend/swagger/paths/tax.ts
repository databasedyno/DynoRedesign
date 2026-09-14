export const taxPaths = {
  // ==================== TAX API ====================
  '/api/tax/rate/{countryCode}': {
    get: {
      tags: ['Tax'],
      summary: 'Get tax rate by country code',
      description: `Retrieve the VAT/GST/Sales tax rate for a specific country.

**Caching:**
- Rates are cached for 24 hours to reduce API calls
- Cache is automatically refreshed when expired

**Supported Countries:**
All EU countries, UK, US, Canada, Australia, Japan, Singapore, and many more.

**Note:** This endpoint is used internally by the checkout when \`apply_tax: true\` is set on a payment link.`,
      parameters: [{
        in: 'path',
        name: 'countryCode',
        required: true,
        schema: { 
          type: 'string',
          minLength: 2,
          maxLength: 2
        },
        description: 'ISO 3166-1 alpha-2 country code',
        examples: {
          'Portugal': { value: 'PT', summary: 'Portugal (23% VAT)' },
          'Germany': { value: 'DE', summary: 'Germany (19% VAT)' },
          'United States': { value: 'US', summary: 'United States (varies by state)' },
          'United Kingdom': { value: 'GB', summary: 'United Kingdom (20% VAT)' }
        }
      }],
      responses: {
        200: {
          description: 'Tax rate retrieved successfully',
          content: {
            'application/json': {
              examples: {
                'Portugal': {
                  summary: 'Portuguese VAT (IVA)',
                  value: {
                    message: 'Tax rate retrieved successfully',
                    data: {
                      country_code: 'PT',
                      country_name: 'Portugal',
                      standard_rate: 23,
                      reduced_rates: [13, 6],
                      tax_acronym: 'IVA',
                      currency: 'EUR',
                      last_updated: '2026-01-31T10:00:00Z'
                    }
                  }
                },
                'Germany': {
                  summary: 'German VAT (MwSt)',
                  value: {
                    message: 'Tax rate retrieved successfully',
                    data: {
                      country_code: 'DE',
                      country_name: 'Germany',
                      standard_rate: 19,
                      reduced_rates: [7],
                      tax_acronym: 'VAT',
                      currency: 'EUR',
                      last_updated: '2026-01-31T10:00:00Z'
                    }
                  }
                },
                'United States': {
                  summary: 'US (No federal VAT)',
                  value: {
                    message: 'Tax rate retrieved successfully',
                    data: {
                      country_code: 'US',
                      country_name: 'United States',
                      standard_rate: 0,
                      reduced_rates: [],
                      tax_acronym: 'Tax',
                      currency: 'USD',
                      note: 'Sales tax varies by state',
                      last_updated: '2026-01-31T10:00:00Z'
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid country code',
          content: {
            'application/json': {
              example: { message: 'Invalid country code format', error: true }
            }
          }
        },
        404: {
          description: 'Country not found',
          content: {
            'application/json': {
              example: { message: 'Tax rate not found for country: XX', error: true }
            }
          }
        }
      }
    }
  },

  '/api/tax/validate': {
    post: {
      tags: ['Tax'],
      summary: 'Validate Tax ID / VAT number',
      description: `Validate a business Tax ID or VAT number.

**Supported Formats:**
- EU VAT numbers (e.g., PT123456789, DE123456789)
- UK VAT numbers
- Other country tax IDs

**Use Cases:**
- B2B transactions (reverse charge mechanism)
- Invoice validation
- Customer verification`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['tax_id', 'country_code'],
              properties: {
                tax_id: { 
                  type: 'string',
                  description: 'Tax ID or VAT number to validate',
                  example: 'PT123456789'
                },
                country_code: { 
                  type: 'string',
                  description: 'ISO 3166-1 alpha-2 country code',
                  example: 'PT'
                }
              }
            },
            examples: {
              'Portuguese VAT': {
                value: { tax_id: 'PT123456789', country_code: 'PT' }
              },
              'German VAT': {
                value: { tax_id: 'DE123456789', country_code: 'DE' }
              },
              'UK VAT': {
                value: { tax_id: 'GB123456789', country_code: 'GB' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Validation result',
          content: {
            'application/json': {
              examples: {
                'Valid VAT': {
                  summary: 'VAT number is valid',
                  value: {
                    message: 'Tax ID validated successfully',
                    data: {
                      valid: true,
                      tax_id: 'PT123456789',
                      country_code: 'PT',
                      company_name: 'Example Company Lda',
                      company_address: 'Lisbon, Portugal',
                      validated_at: '2026-01-31T10:00:00Z'
                    }
                  }
                },
                'Invalid VAT': {
                  summary: 'VAT number is invalid',
                  value: {
                    message: 'Tax ID validation failed',
                    data: {
                      valid: false,
                      tax_id: 'PT000000000',
                      country_code: 'PT',
                      reason: 'VAT number not found in registry'
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request',
          content: {
            'application/json': {
              example: { message: 'Invalid Tax ID format', error: true }
            }
          }
        }
      }
    }
  },

  '/api/tax/acronyms': {
    get: {
      tags: ['Tax'],
      summary: 'Get tax acronyms by country',
      description: `Retrieve the local tax acronym used in each country.

**Examples:**
- Portugal: IVA (Imposto sobre o Valor Acrescentado)
- Germany: MwSt (Mehrwertsteuer)
- France: TVA (Taxe sur la Valeur Ajoutée)
- UK: VAT (Value Added Tax)
- Australia: GST (Goods and Services Tax)`,
      responses: {
        200: {
          description: 'Tax acronyms retrieved',
          content: {
            'application/json': {
              example: {
                message: 'Tax acronyms retrieved successfully',
                data: {
                  acronyms: {
                    PT: { acronym: 'IVA', full_name: 'Imposto sobre o Valor Acrescentado' },
                    DE: { acronym: 'MwSt', full_name: 'Mehrwertsteuer' },
                    FR: { acronym: 'TVA', full_name: 'Taxe sur la Valeur Ajoutée' },
                    ES: { acronym: 'IVA', full_name: 'Impuesto sobre el Valor Añadido' },
                    IT: { acronym: 'IVA', full_name: 'Imposta sul Valore Aggiunto' },
                    GB: { acronym: 'VAT', full_name: 'Value Added Tax' },
                    US: { acronym: 'Tax', full_name: 'Sales Tax' },
                    CA: { acronym: 'GST', full_name: 'Goods and Services Tax' },
                    AU: { acronym: 'GST', full_name: 'Goods and Services Tax' },
                    NZ: { acronym: 'GST', full_name: 'Goods and Services Tax' },
                    JP: { acronym: 'Tax', full_name: 'Consumption Tax' },
                    SG: { acronym: 'GST', full_name: 'Goods and Services Tax' },
                    IN: { acronym: 'GST', full_name: 'Goods and Services Tax' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/tax/lookup': {
    get: {
      tags: ['Tax'],
      summary: 'Lookup tax rate by country name',
      description: 'Search for tax rate using country name instead of code.',
      parameters: [{
        in: 'query',
        name: 'country',
        required: true,
        schema: { type: 'string' },
        description: 'Country name (partial match supported)',
        examples: {
          'Portugal': { value: 'Portugal' },
          'Germany': { value: 'Germany' },
          'United Kingdom': { value: 'United Kingdom' }
        }
      }],
      responses: {
        200: {
          description: 'Tax rate found',
          content: {
            'application/json': {
              example: {
                message: 'Tax rate found',
                data: {
                  country_code: 'PT',
                  country_name: 'Portugal',
                  standard_rate: 23,
                  tax_acronym: 'IVA'
                }
              }
            }
          }
        },
        404: {
          description: 'Country not found',
          content: {
            'application/json': {
              example: { message: 'No tax rate found for country: Unknown', error: true }
            }
          }
        }
      }
    }
  }
};
