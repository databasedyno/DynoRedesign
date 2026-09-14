/**
 * @deprecated This file is deprecated. OTP storage has been moved to Redis.
 * Use getRedisItem/setRedisItem from redisInstance.ts instead.
 * 
 * This file is kept for backward compatibility but should not be used.
 */

// Placeholder export to prevent import errors
import { apiLogger } from "./loggers";
const localStorage = {
  push: async (_key: string, _data: unknown) => {
    apiLogger.warn('[DEPRECATED] localStorage.push called - use Redis instead');
    throw new Error('localStorage is deprecated. Use Redis for OTP storage.');
  },
  getData: async (_key: string) => {
    apiLogger.warn('[DEPRECATED] localStorage.getData called - use Redis instead');
    throw new Error('localStorage is deprecated. Use Redis for OTP storage.');
  }
};

export default localStorage;
