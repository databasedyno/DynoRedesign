import axios from 'axios';
import { apiLogger } from "../utils/loggers";
import express from 'express';
import { IncomingHttpHeaders } from 'http';

interface GeoLocationResult {
  country_code: string;
  country_name: string;
  city?: string;
  region?: string;
  ip: string;
  source: 'ip-api' | 'cloudflare' | 'fallback';
}

// Type alias for headers that works with both Record<string, string> and IncomingHttpHeaders
type HeadersType = Record<string, string | string[] | undefined> | IncomingHttpHeaders;

// Country names mapping for fallback
const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand", IN: "India", JP: "Japan",
  CN: "China", BR: "Brazil", MX: "Mexico", AR: "Argentina", CH: "Switzerland",
  NO: "Norway", SG: "Singapore", HK: "Hong Kong", KR: "South Korea", ZA: "South Africa",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", TR: "Turkey",
  RU: "Russia", UA: "Ukraine", TH: "Thailand", MY: "Malaysia", ID: "Indonesia",
  PH: "Philippines", VN: "Vietnam", NG: "Nigeria", EG: "Egypt", KE: "Kenya",
  GH: "Ghana", MA: "Morocco", PK: "Pakistan", BD: "Bangladesh", CL: "Chile",
  CO: "Colombia", PE: "Peru", VE: "Venezuela", EC: "Ecuador",
};

// Helper to safely get string value from headers
const getHeaderValue = (headers: HeadersType | undefined, key: string): string | undefined => {
  if (!headers) return undefined;
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return value as string | undefined;
};

/**
 * Extract client IP from request
 * Handles proxies, load balancers, Cloudflare, etc.
 */
export const getClientIP = (req: express.Request): string => {
  // Priority order for IP detection
  const cfIp = getHeaderValue(req.headers, 'cf-connecting-ip');
  const realIp = getHeaderValue(req.headers, 'x-real-ip');
  const forwardedFor = getHeaderValue(req.headers, 'x-forwarded-for');
  
  const ip = 
    cfIp ||                                        // Cloudflare
    realIp ||                                      // Nginx proxy
    forwardedFor?.split(',')[0]?.trim() ||         // Standard proxy
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';
  
  // Remove IPv6 prefix if present
  return String(ip).replace('::ffff:', '');
};

/**
 * Detect customer country from IP address
 * Uses free ip-api.com service (no API key required, 45 req/min limit)
 * Falls back to Cloudflare headers if available
 */
export const getCountryFromIP = async (ip: string, headers?: HeadersType): Promise<GeoLocationResult | null> => {
  try {
    // First, try Cloudflare header (most reliable if using CF)
    const cfCountry = getHeaderValue(headers, 'cf-ipcountry');
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      apiLogger.info(`[Geolocation] Country from Cloudflare header: ${cfCountry}`);
      return {
        country_code: cfCountry,
        country_name: COUNTRY_NAMES[cfCountry] || cfCountry,
        ip,
        source: 'cloudflare'
      };
    }

    // Skip API call for localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      apiLogger.info('[Geolocation] Private/localhost IP detected, cannot determine country');
      return null;
    }

    // Use ip-api.com (free, no key required, 45 requests/minute)
    apiLogger.info(`[Geolocation] Fetching country for IP: ${ip}`);
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000,
      params: {
        fields: 'status,countryCode,country,city,regionName,message'
      }
    });

    if (response.data.status === 'success') {
      apiLogger.info(`[Geolocation] Detected country: ${response.data.country} (${response.data.countryCode})`);
      return {
        country_code: response.data.countryCode,
        country_name: response.data.country,
        city: response.data.city,
        region: response.data.regionName,
        ip,
        source: 'ip-api'
      };
    }

    apiLogger.info(`[Geolocation] ip-api.com failed: ${response.data.message}`);
    return null;
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    apiLogger.error('[Geolocation] Failed to detect country:', errMsg);
    return null;
  }
};

// Timezone to country mapping (most common timezones)
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Europe
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Lisbon': 'PT',
  'Europe/Madrid': 'ES', 'Europe/Paris': 'FR', 'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL', 'Europe/Berlin': 'DE', 'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT', 'Europe/Rome': 'IT', 'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG', 'Europe/Athens': 'GR', 'Europe/Helsinki': 'FI',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  // Americas
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Toronto': 'CA',
  'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
  'America/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Lima': 'PE',
  'America/Bogota': 'CO',
  // Asia/Pacific
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kolkata': 'IN',
  'Asia/Dubai': 'AE', 'Asia/Tel_Aviv': 'IL', 'Asia/Istanbul': 'TR',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  // Africa
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA',
};

/**
 * Get country from timezone string
 */
export const getCountryFromTimezone = (timezone: string): GeoLocationResult | null => {
  const countryCode = TIMEZONE_TO_COUNTRY[timezone];
  if (countryCode) {
    apiLogger.info(`[Geolocation] Country from timezone ${timezone}: ${countryCode}`);
    return {
      country_code: countryCode,
      country_name: COUNTRY_NAMES[countryCode] || countryCode,
      ip: 'timezone-based',
      source: 'fallback'
    };
  }
  
  // Try to extract from timezone (e.g., "Europe/Lisbon" -> check Europe)
  if (timezone.startsWith('Europe/')) {
    // Default to GB for unknown European timezones
    apiLogger.info(`[Geolocation] Unknown European timezone ${timezone}, defaulting to GB`);
    return {
      country_code: 'GB',
      country_name: 'United Kingdom',
      ip: 'timezone-based',
      source: 'fallback'
    };
  }
  
  return null;
};

/**
 * Get country from request (combines IP extraction and geolocation)
 */
export const getCountryFromRequest = async (req: express.Request): Promise<GeoLocationResult | null> => {
  const ip = getClientIP(req);
  return getCountryFromIP(ip, req.headers);
};

export default {
  getClientIP,
  getCountryFromIP,
  getCountryFromRequest,
  getCountryFromTimezone,
};
