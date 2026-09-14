/**
 * QR Code Generator with Currency Logo Overlay
 * 
 * Generates QR codes with a centered circular cryptocurrency logo.
 * Uses error correction level 'H' (30% recovery) to allow for center overlay.
 * 
 * Architecture:
 *   1. Generate QR as PNG buffer (qrcode lib, EC level H)
 *   2. Create SVG logo for the currency (colored circle + icon)
 *   3. Composite logo onto QR center (sharp)
 *   4. Return as base64 data URL
 */

import QR_Code from "qrcode";
import sharp from "sharp";
import { cronLogger } from "./loggers";

const { log } = cronLogger;

// ─── Currency Brand Colors ──────────────────────────────────────────────────
const CURRENCY_COLORS: Record<string, { bg: string; fg: string }> = {
  BTC:          { bg: "#F7931A", fg: "#FFFFFF" },
  ETH:          { bg: "#627EEA", fg: "#FFFFFF" },
  LTC:          { bg: "#345D9D", fg: "#FFFFFF" },
  DOGE:         { bg: "#C2A633", fg: "#FFFFFF" },
  TRX:          { bg: "#EF0027", fg: "#FFFFFF" },
  SOL:          { bg: "#9945FF", fg: "#FFFFFF" },
  XRP:          { bg: "#23292F", fg: "#FFFFFF" },
  RLUSD:        { bg: "#0085FF", fg: "#FFFFFF" },
  POLYGON:      { bg: "#8247E5", fg: "#FFFFFF" },
  BCH:          { bg: "#0AC18E", fg: "#FFFFFF" },
  "USDT-ERC20": { bg: "#26A17B", fg: "#FFFFFF" },
  "USDC-ERC20": { bg: "#2775CA", fg: "#FFFFFF" },
  "RLUSD-ERC20":{ bg: "#0085FF", fg: "#FFFFFF" },
  "USDT-POLYGON":{ bg: "#26A17B", fg: "#FFFFFF" },
  "USDT-TRC20": { bg: "#26A17B", fg: "#FFFFFF" },
};

// ─── Currency SVG Icon Paths (centered in 100x100 viewBox) ──────────────────
// Each returns an SVG fragment to place inside the circle
function getCurrencyIcon(currency: string): string {
  const normalized = currency.toUpperCase();

  // BTC - Bitcoin ₿ symbol
  if (normalized === "BTC") {
    return `
      <text x="50" y="68" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="52" fill="#FFFFFF">₿</text>`;
  }

  // ETH - Ethereum diamond
  if (normalized === "ETH") {
    return `
      <g transform="translate(50,50)">
        <polygon points="0,-30 18,0 0,10 -18,0" fill="#FFFFFF" opacity="0.9"/>
        <polygon points="0,10 18,0 0,30 -18,0" fill="#FFFFFF" opacity="0.7"/>
      </g>`;
  }

  // LTC - Litecoin Ł
  if (normalized === "LTC") {
    return `
      <text x="50" y="68" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="50" fill="#FFFFFF">Ł</text>`;
  }

  // DOGE - Dogecoin Ð
  if (normalized === "DOGE") {
    return `
      <text x="50" y="68" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="48" fill="#FFFFFF">Ð</text>`;
  }

  // TRX - Tron
  if (normalized === "TRX") {
    return `
      <g transform="translate(50,50)">
        <polygon points="0,-28 24,20 -24,20" fill="none" stroke="#FFFFFF" stroke-width="4"/>
        <polygon points="0,-16 14,12 -14,12" fill="#FFFFFF" opacity="0.6"/>
      </g>`;
  }

  // SOL - Solana
  if (normalized === "SOL") {
    return `
      <g transform="translate(26,30)" fill="#FFFFFF">
        <rect x="0" y="0" width="48" height="8" rx="2"/>
        <rect x="0" y="16" width="48" height="8" rx="2"/>
        <rect x="0" y="32" width="48" height="8" rx="2"/>
        <polygon points="40,0 48,4 40,8" fill="#FFFFFF"/>
        <polygon points="8,16 0,20 8,24" fill="#FFFFFF"/>
        <polygon points="40,32 48,36 40,40" fill="#FFFFFF"/>
      </g>`;
  }

  // XRP - Ripple X
  if (normalized === "XRP") {
    return `
      <g transform="translate(50,50)" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none">
        <line x1="-18" y1="-18" x2="-6" y2="-6"/>
        <line x1="18" y1="-18" x2="6" y2="-6"/>
        <circle cx="0" cy="0" r="8" fill="#FFFFFF" stroke="none"/>
        <line x1="-18" y1="18" x2="-6" y2="6"/>
        <line x1="18" y1="18" x2="6" y2="6"/>
      </g>`;
  }

  // POLYGON - Matic
  if (normalized === "POLYGON") {
    return `
      <g transform="translate(50,50)">
        <polygon points="0,-24 21,12 -21,12" fill="none" stroke="#FFFFFF" stroke-width="4"/>
        <polygon points="0,24 -21,-12 21,-12" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.6"/>
      </g>`;
  }

  // BCH - Bitcoin Cash
  if (normalized === "BCH") {
    return `
      <text x="50" y="68" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="48" fill="#FFFFFF">₿</text>`;
  }

  // RLUSD / RLUSD-ERC20 - Ripple USD stablecoin
  if (normalized === "RLUSD" || normalized === "RLUSD-ERC20") {
    return `
      <text x="50" y="62" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="32" fill="#FFFFFF">R$</text>`;
  }

  // USDT (all chains) - Tether
  if (normalized.startsWith("USDT")) {
    return `
      <g transform="translate(50,50)" fill="#FFFFFF">
        <rect x="-22" y="-26" width="44" height="7" rx="2"/>
        <rect x="-4" y="-26" width="8" height="50" rx="2"/>
        <ellipse cx="0" cy="18" rx="22" ry="8" fill="none" stroke="#FFFFFF" stroke-width="3"/>
      </g>`;
  }

  // USDC - USD Coin
  if (normalized.startsWith("USDC")) {
    return `
      <text x="50" y="66" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
            font-weight="bold" font-size="44" fill="#FFFFFF">$</text>`;
  }

  // Fallback: show first 3 chars of currency
  const label = normalized.substring(0, 3);
  return `
    <text x="50" y="64" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" 
          font-weight="bold" font-size="32" fill="#FFFFFF">${label}</text>`;
}

// ─── Generate Currency Logo SVG ─────────────────────────────────────────────
function generateLogoSvg(currency: string, size: number): Buffer {
  const colors = CURRENCY_COLORS[currency] || CURRENCY_COLORS[currency.toUpperCase()] || { bg: "#6B7280", fg: "#FFFFFF" };
  const icon = getCurrencyIcon(currency);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <clipPath id="circleClip">
      <circle cx="50" cy="50" r="46"/>
    </clipPath>
  </defs>
  <!-- White border ring -->
  <circle cx="50" cy="50" r="50" fill="#FFFFFF"/>
  <!-- Colored background -->
  <circle cx="50" cy="50" r="46" fill="${colors.bg}"/>
  <!-- Currency icon -->
  <g clip-path="url(#circleClip)">
    ${icon}
  </g>
</svg>`;

  return Buffer.from(svg);
}

// ─── Main: Generate QR Code with Currency Logo ─────────────────────────────
/**
 * Generates a QR code with a cryptocurrency logo in the center.
 * 
 * @param data - The data to encode (address, URI, etc.)
 * @param currency - Currency code (BTC, ETH, USDT-ERC20, etc.)
 * @param width - QR code width in pixels (default 400)
 * @returns Base64 data URL (image/png)
 */
export async function generateQRCodeWithLogo(
  data: string,
  currency: string,
  width: number = 400
): Promise<string> {
  try {
    // Step 1: Generate QR code as PNG buffer with high error correction
    const qrBuffer = await QR_Code.toBuffer(data, {
      errorCorrectionLevel: "H", // 30% recovery — allows center logo
      width,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Step 2: Generate the currency logo SVG
    // Logo should be ~22% of QR width (safe for H-level EC)
    const logoSize = Math.round(width * 0.22);
    const logoSvg = generateLogoSvg(currency, logoSize);

    // Step 3: Convert SVG to PNG buffer via sharp
    const logoPng = await sharp(logoSvg)
      .resize(logoSize, logoSize)
      .png()
      .toBuffer();

    // Step 4: Composite logo onto QR code center
    const offset = Math.round((width - logoSize) / 2);

    const composited = await sharp(qrBuffer)
      .composite([{
        input: logoPng,
        top: offset,
        left: offset,
      }])
      .png()
      .toBuffer();

    // Step 5: Return as data URL
    const base64 = composited.toString("base64");
    return `data:image/png;base64,${base64}`;

  } catch (err) {
    // Fallback: return QR without logo if overlay fails
    log(`[QR] Logo overlay failed for ${currency}, falling back to plain QR: ${(err as Error).message}`, "warn");
    const fallbackUrl = await QR_Code.toDataURL(data, { width, errorCorrectionLevel: "H" });
    return fallbackUrl;
  }
}

// ─── Standalone coin badge (PDF receipt, public receipt page) ───────────────
/**
 * Render the same circular currency badge used inside QR codes as a standalone
 * PNG (transparent outside the white ring). Never throws — returns null when
 * sharp can't rasterize, so callers fall back to text.
 *
 * @param currency - Currency code (BTC, ETH, USDT-TRC20, ...)
 * @param sizePx   - Output size in pixels (render at 2-4x the display size for crisp print)
 */
export async function renderCurrencyBadgePng(currency: string, sizePx: number = 96): Promise<Buffer | null> {
  try {
    const svg = generateLogoSvg(currency, sizePx);
    return await sharp(svg).resize(sizePx, sizePx).png().toBuffer();
  } catch (err) {
    log(`[QR] Coin badge render failed for ${currency}: ${(err as Error).message}`, "warn");
    return null;
  }
}

export default generateQRCodeWithLogo;
