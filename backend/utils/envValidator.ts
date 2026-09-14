/**
 * Environment Variable Validator
 * Validates that all required environment variables are set on application startup
 * Prevents runtime errors due to missing configuration
 */

import { log } from './loggers';

interface EnvValidationError {
  variable: string;
  message: string;
}

/**
 * Required environment variables for application startup
 */
const REQUIRED_ENV_VARS = [
  // Database
  'DB_NAME',
  'USER_NAME',
  'PASSWORD',
  'HOST',
  'DB_PORT',
  
  // Redis
  'REDIS_PUBLIC_URL',
  
  // Authentication
  'ACCESS_TOKEN_SECRET',
  'API_SECRET',
  
  // Tatum Blockchain API
  'TATUM_KEY',
  
  // Server Configuration
  'SERVER_URL',
  'FRONTEND_URL',
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = [
  'ADMIN_EMAIL',
  'BREVO_API_KEY',
  'TATUM_WEBHOOK_SECRET',
  'BINANCE_API_KEY',
  'BINANCE_SECRET_KEY',
];

/**
 * Validate that required environment variables are set
 * @throws Error if any required variable is missing
 */
export const validateRequiredEnvVars = (): void => {
  const errors: EnvValidationError[] = [];
  
  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      errors.push({
        variable: varName,
        message: `Missing required environment variable: ${varName}`
      });
    }
  });
  
  if (errors.length > 0) {
    log('Environment Validation Failed', 'error');
    errors.forEach(err => log(`  - ${err.message}`, 'error'));
    throw new Error(`Missing ${errors.length} required environment variable(s). Application cannot start.`);
  }
  
  log('All required environment variables validated');
};

/**
 * Check for recommended environment variables and warn if missing
 */
export const checkRecommendedEnvVars = (): void => {
  const warnings: string[] = [];
  
  RECOMMENDED_ENV_VARS.forEach(varName => {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      warnings.push(varName);
    }
  });
  
  if (warnings.length > 0) {
    log('Missing recommended environment variables:', 'warn');
    warnings.forEach(varName => log(`  - ${varName}`, 'warn'));
    log('Some features may not work correctly without these variables', 'warn');
  }
};

/**
 * Validate sensitive data format (prevent accidental placeholder values)
 */
export const validateSensitiveDataFormat = (): void => {
  const warnings: string[] = [];
  
  // Check for placeholder/default values that shouldn't be in production
  const placeholderPatterns = [
    { key: 'ACCESS_TOKEN_SECRET', pattern: /^(secret|changeme|test|default)/i },
    { key: 'API_SECRET', pattern: /^(secret|changeme|test|default)/i },
    { key: 'PASSWORD', pattern: /^(password|admin|root|test)/i },
  ];
  
  placeholderPatterns.forEach(({ key, pattern }) => {
    const value = process.env[key];
    if (value && pattern.test(value)) {
      warnings.push(`${key} appears to use a placeholder value. Use a strong secret in production.`);
    }
  });
  
  // Check minimum length for secrets
  const minLengths = [
    { key: 'ACCESS_TOKEN_SECRET', minLength: 32 },
    { key: 'API_SECRET', minLength: 32 },
  ];
  
  minLengths.forEach(({ key, minLength }) => {
    const value = process.env[key];
    if (value && value.length < minLength) {
      warnings.push(`${key} is too short (${value.length} chars). Minimum recommended: ${minLength} chars.`);
    }
  });
  
  if (warnings.length > 0) {
    log('Security warnings for environment variables:', 'warn');
    warnings.forEach(warning => log(`  - ${warning}`, 'warn'));
  }
};

/**
 * Validate URL format for endpoint configuration
 */
export const validateUrlFormats = (): void => {
  const urlVars = ['SERVER_URL', 'FRONTEND_URL', 'CHECKOUT_URL'];
  const errors: string[] = [];
  
  urlVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      try {
        new URL(value);
        // Only check for localhost in production if explicitly set
        // Skip check for Railway/development environments
        const isProduction = process.env.NODE_ENV === 'production';
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
        
        if (isProduction && !isRailway && 
            (value.includes('localhost') || value.includes('127.0.0.1'))) {
          log(`${varName} uses localhost in production: ${value}`, 'warn');
          // Don't throw error, just warn
        }
      } catch (err) {
        errors.push(`${varName} is not a valid URL: ${value}`);
      }
    }
  });
  
  if (errors.length > 0) {
    log('URL validation errors:', 'error');
    errors.forEach(error => log(`  - ${error}`, 'error'));
    throw new Error('Invalid URL configuration detected');
  }
};

/**
 * Complete environment validation (call on startup)
 */
export const validateEnvironment = (): void => {
  log('Validating environment configuration...');
  
  validateRequiredEnvVars();
  checkRecommendedEnvVars();
  validateSensitiveDataFormat();
  validateUrlFormats();
  
  log('Environment validation complete');
};

export default {
  validateEnvironment,
  validateRequiredEnvVars,
  checkRecommendedEnvVars,
  validateSensitiveDataFormat,
  validateUrlFormats,
};
