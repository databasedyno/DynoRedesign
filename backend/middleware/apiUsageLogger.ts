import express from 'express';
import sequelize from '../utils/dbInstance';
import { apiModel } from '../models';
import { apiLogger } from '../utils/loggers';
import { hashApiKey, looksLikeApiKey } from '../helper/apiKeyToken';

/**
 * API Usage Logging Middleware
 * Logs all API requests to tbl_api_usage_log for analytics
 * Also updates last_used_at and request_count on the API key
 */
export const apiUsageLogger = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Extract API key from headers
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  // Only log if API key is present (merchant API calls)
  if (!looksLikeApiKey(apiKey)) {
    return next();
  }

  // Find the API record
  let apiId: number | null = null;
  let companyId: number | null = null;

  try {
    const api = await apiModel.findOne({
      where: { key_hash: hashApiKey(apiKey) },
      attributes: ['api_id', 'company_id', 'request_count', 'last_used_at'],
    });

    if (api) {
      apiId = api.dataValues.api_id;
      companyId = api.dataValues.company_id;

      // Update last_used_at and increment request_count
      await apiModel.update(
        {
          last_used_at: new Date(),
          request_count: (api.dataValues.request_count || 0) + 1,
        },
        { where: { api_id: apiId } }
      );
    }
  } catch (error) {
    apiLogger.error('Error finding API key:', error);
  }

  // Override res.send to capture response
  res.send = function (data: unknown) {
    res.send = originalSend; // Restore original send

    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log to database asynchronously (don't block response)
    if (apiId) {
      setImmediate(async () => {
        try {
          let errorMessage = null;

          // Parse response if it's an error
          if (statusCode >= 400) {
            try {
              const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
              errorMessage = parsedData.message || parsedData.error || 'Unknown error';
            } catch (e) {
              errorMessage = 'Failed to parse error response';
            }
          }

          // Truncate large responses
          const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
          let responseBody: string;
          if (dataStr && dataStr.length > 5000) {
            responseBody = dataStr.substring(0, 5000) + '... (truncated)';
          } else {
            responseBody = dataStr;
          }

          await sequelize.query(
            `INSERT INTO tbl_api_usage_log 
             (api_id, company_id, endpoint, method, status_code, ip_address, user_agent, 
              response_time_ms, error_message, request_time)
             VALUES (:api_id, :company_id, :endpoint, :method, :status_code, :ip_address, 
                     :user_agent, :response_time_ms, :error_message, NOW())`,
            {
              replacements: {
                api_id: apiId,
                company_id: companyId,
                endpoint: req.originalUrl || req.url,
                method: req.method,
                status_code: statusCode,
                ip_address: req.ip || req.socket.remoteAddress,
                user_agent: req.headers['user-agent'] || 'Unknown',
                response_time_ms: responseTime,
                error_message: errorMessage,
              },
            }
          );
        } catch (error) {
          apiLogger.error('Error logging API usage:', error);
        }
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

export default apiUsageLogger;
