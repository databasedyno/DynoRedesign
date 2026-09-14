// IP-based geolocation to language mapping
// Maps country codes to supported locales

const COUNTRY_TO_LOCALE: Record<string, string> = {
  // Spanish-speaking countries
  ES: 'es', // Spain
  MX: 'es', // Mexico
  AR: 'es', // Argentina
  CO: 'es', // Colombia
  CL: 'es', // Chile
  PE: 'es', // Peru
  VE: 'es', // Venezuela
  EC: 'es', // Ecuador
  GT: 'es', // Guatemala
  CU: 'es', // Cuba
  BO: 'es', // Bolivia
  DO: 'es', // Dominican Republic
  HN: 'es', // Honduras
  PY: 'es', // Paraguay
  SV: 'es', // El Salvador
  NI: 'es', // Nicaragua
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  UY: 'es', // Uruguay

  // Portuguese-speaking countries
  PT: 'pt', // Portugal
  BR: 'pt', // Brazil
  AO: 'pt', // Angola
  MZ: 'pt', // Mozambique

  // German-speaking countries
  DE: 'de', // Germany
  AT: 'de', // Austria
  CH: 'de', // Switzerland (German region)
  LI: 'de', // Liechtenstein
  LU: 'de', // Luxembourg

  // Dutch-speaking countries
  NL: 'nl', // Netherlands
  BE: 'nl', // Belgium (Dutch region)
  SR: 'nl', // Suriname

  // French-speaking countries
  FR: 'fr', // France
  CA: 'fr', // Canada (French region - simplified)
  SN: 'fr', // Senegal
  CI: 'fr', // Ivory Coast
  ML: 'fr', // Mali
  BF: 'fr', // Burkina Faso
  NE: 'fr', // Niger
  TD: 'fr', // Chad
  GN: 'fr', // Guinea
  RW: 'fr', // Rwanda
  BJ: 'fr', // Benin
  TG: 'fr', // Togo
  MG: 'fr', // Madagascar
  CM: 'fr', // Cameroon
  CG: 'fr', // Congo
  GA: 'fr', // Gabon
  DJ: 'fr', // Djibouti
  KM: 'fr', // Comoros
  MC: 'fr', // Monaco
  HT: 'fr', // Haiti

  // English-speaking countries (default)
  US: 'en',
  GB: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',
  ZA: 'en',
  NG: 'en',
  KE: 'en',
  GH: 'en',
  PH: 'en',
  IN: 'en',
  SG: 'en',
  MY: 'en',
};

const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'pt', 'de', 'nl'];

export interface GeoLocation {
  country: string;
  countryCode: string;
  locale: string;
}

/**
 * Get locale from country code
 */
export function getLocaleFromCountry(countryCode: string): string {
  const locale = COUNTRY_TO_LOCALE[countryCode.toUpperCase()];
  return locale && SUPPORTED_LOCALES.includes(locale) ? locale : 'en';
}

/**
 * Detect user's location from IP address using ip-api.com (free, no API key needed)
 * Falls back to 'en' locale on any error
 */
export async function detectGeoLocale(ip?: string): Promise<GeoLocation> {
  try {
    // Use ip-api.com - free for non-commercial use, 45 requests/minute
    const url = ip 
      ? `http://ip-api.com/json/${ip}?fields=status,country,countryCode`
      : 'http://ip-api.com/json/?fields=status,country,countryCode';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Geolocation API request failed');
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('Geolocation lookup failed');
    }

    const countryCode = data.countryCode || 'US';
    const locale = getLocaleFromCountry(countryCode);

    return {
      country: data.country || 'Unknown',
      countryCode,
      locale,
    };
  } catch (error) {
    console.error('Geolocation detection failed:', error);
    return {
      country: 'Unknown',
      countryCode: 'US',
      locale: 'en',
    };
  }
}

/**
 * Get client IP from request headers (works with proxies/load balancers)
 */
export function getClientIp(req: any): string | undefined {
  // Check various headers set by proxies
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // Fallback to socket remote address
  return req.socket?.remoteAddress || req.connection?.remoteAddress;
}
