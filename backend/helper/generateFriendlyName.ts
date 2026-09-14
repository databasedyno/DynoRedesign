/**
 * Generates short, friendly random names for API keys and wallets
 * Format: "Word-123" (e.g., "Swift-42", "Nova-7")
 */

const words = [
  'Swift', 'Bold', 'Nova', 'Apex', 'Pulse', 'Spark', 'Echo', 'Flux',
  'Prime', 'Core', 'Wave', 'Blaze', 'Edge', 'Volt', 'Zoom', 'Dash',
  'Snap', 'Beam', 'Glow', 'Rush', 'Mint', 'Jade', 'Onyx', 'Ruby',
  'Sage', 'Lynx', 'Hawk', 'Wolf', 'Fox', 'Zap', 'Arc', 'Ion'
];

/**
 * Generates a short random name like "Swift-42"
 */
export const generateFriendlyName = (): string => {
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 100);
  return `${word}-${num}`;
};

/**
 * Generates a short name for API keys
 * @returns A name like "Swift-42"
 */
export const generateApiKeyName = (): string => {
  return generateFriendlyName();
};

/**
 * Generates a short name for wallets
 * @returns A name like "Nova-7"
 */
export const generateWalletName = (): string => {
  return generateFriendlyName();
};

export default generateFriendlyName;
