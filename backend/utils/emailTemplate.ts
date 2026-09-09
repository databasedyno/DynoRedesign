/**
 * Shared professional email base template for Dynopay
 * Used by both services/emailService.ts and helper/sendEmail.ts
 */

import { getCurrencySymbol as getCurrencySymbolShared } from "./currencyUtils";
import config from "./config";
import { EMAIL_TOKENS as T } from "./brandTokens";
import { t as tr, normalizeLang } from "./emailI18n";

// Cache-busted email logo filename. Regenerated from the CURRENT landing white
// wordmark (assets/Icons/home/dynopay-whiteLogo.svg) baked onto the dark #050505
// email chip, so it is pixel-identical to the site header. The version suffix is
// REQUIRED: Gmail/Outlook proxy-cache remote images by URL, so reusing the old
// filename kept serving the stale logo even after the image bytes changed.
const EMAIL_LOGO_FILE = "dynopay-email-logo-v2.png";

// Last-resort absolute base used only if NO url env is configured (e.g. a worker
// booted without SERVER_URL — the exact case that made admin emails fall back to
// a stale external image host). Points at OUR production domain serving the NEW
// logo, never a 3rd-party CDN.
const DYNOPAY_PROD_BASE = "https://dynopay.com";

/**
 * Brand logo for emails. Uses an "inversion-proof" PNG: the white wordmark is
 * baked onto a solid #050505 chip (matching the always-dark header/footer) so
 * it stays visible even when a mail client force-adapts the dark footer into a
 * white card. Always served from our own /api/static (never a 3rd-party CDN),
 * with a resilient base-URL fallback chain so admin/background-job emails resolve
 * the SAME up-to-date logo as merchant emails.
 */
export const getDynopayLogoUrl = (): string => {
  const base =
    config.serverUrl ||
    config.frontendUrl ||
    config.publicBaseUrl ||
    DYNOPAY_PROD_BASE;
  return `${base.replace(/\/+$/, "")}/api/static/${EMAIL_LOGO_FILE}`;
};

/**
 * Absolute URL for an email social icon (PNG). SVG images and `data:` URIs do
 * NOT render in Gmail/Outlook/Yahoo/most mobile mail clients, so we serve real
 * PNGs over HTTPS. Returns null when no server URL is configured, in which case
 * the caller renders a text label instead (never a broken image).
 */
export const getEmailIconUrl = (name: string): string | null => {
  const serverUrl = config.serverUrl;
  return serverUrl ? `${serverUrl}/api/static/email/${name}.png` : null;
};

/**
 * Email-context currency symbol. Table now lives in utils/currencyUtils.ts
 * (variant 'email'); this thin wrapper keeps the existing import path + output.
 */
export const getCurrencySymbol = (currency: string): string =>
  getCurrencySymbolShared(currency, 'email');

/** Per-action hero icon name — PNG served from /api/static/email/hero/<name>.png (see scripts/generate_email_hero_icons.mjs). */
export type EmailHero = string;

/**
 * Absolute URL for a hero icon PNG. Same fallback chain as the logo so
 * background-job emails resolve the same asset as merchant emails.
 */
export const getEmailHeroUrl = (icon: string): string => {
  const base = config.serverUrl || config.frontendUrl || config.publicBaseUrl || DYNOPAY_PROD_BASE;
  return `${base.replace(/\/+$/, "")}/api/static/email/hero/${icon}.png`;
};

/**
 * Professional base email template
 * Renders the outer shell: header, content area, footer
 */
export const baseEmailTemplate = (
  heading: string,
  bodyContent: string,
  options?: {
    showButton?: boolean;
    buttonText?: string;
    buttonLink?: string;
    preheader?: string;
    /** Optional language for the shared chrome (sign-off + footer). Defaults to English. */
    lang?: string;
    /** Optional per-action hero icon above the heading. */
    hero?: EmailHero;
  }
): string => {
  const LOGO_URL = getDynopayLogoUrl();
  const year = new Date().getFullYear();
  const { showButton = false, buttonText = '', buttonLink = '', preheader = '', lang, hero } = options || {};
  // <html lang> follows the recipient language (screen readers / client hyphenation).
  const htmlLang = normalizeLang(lang);
  // Localized chrome strings (English when no lang passed → unchanged for all
  // existing callers; t() falls back to English for any missing key).
  const chrome = {
    bestRegards: tr('chrome.bestRegards', lang),
    team: tr('chrome.teamSignature', lang),
    tagline: tr('chrome.tagline', lang),
    rights: tr('chrome.rights', lang, { year }),
    privacy: tr('chrome.privacy', lang),
    terms: tr('chrome.terms', lang),
    support: tr('chrome.support', lang),
  };

  const buttonBlock = showButton && buttonText && buttonLink
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 28px 0 8px 0;">
        <a href="${buttonLink}" class="btn" style="display: inline-block; background-color: #4338CA; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
          <!--[if mso]><i style="mso-font-width: 150%; mso-text-raise: 26pt;">&nbsp;</i><![endif]-->
          <span style="mso-text-raise: 13pt; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF;">${buttonText}</span>
          <!--[if mso]><i style="mso-font-width: 150%;">&nbsp;</i><![endif]-->
        </a>
      </td></tr></table>`
    : '';

  // Social icons: real PNGs over HTTPS (SVG/data: URIs don't render in email).
  // Falls back to a text label if no server URL is configured — never a broken image.
  // Can be hidden platform-wide via env: set SHOW_SOCIAL_LINKS=false. Default = shown.
  const showSocialLinks = (process.env.SHOW_SOCIAL_LINKS ?? 'true').toLowerCase() !== 'false';
  const socials: Array<{ name: string; url: string; label: string }> = [
    { name: 'facebook', url: 'https://www.facebook.com/dynopay', label: 'Facebook' },
    { name: 'instagram', url: 'https://www.instagram.com/dynopay', label: 'Instagram' },
    { name: 'x', url: 'https://x.com/dynopaycom', label: 'X' },
    { name: 'linkedin', url: 'https://www.linkedin.com/company/dynopay/', label: 'LinkedIn' },
    { name: 'telegram', url: 'https://t.me/Dynopay_Announcements', label: 'Telegram' },
  ];
  const socialCells = socials.map((s) => {
    const icon = getEmailIconUrl(s.name);
    const inner = icon
      ? `<img src="${icon}" alt="${s.label}" width="24" height="24" style="display: block; border: 0; outline: none; text-decoration: none; opacity: 0.75;" />`
      : `<span style="color: #818CF8; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${s.label}</span>`;
    return `<td style="padding: 0 8px;"><a href="${s.url}" target="_blank" style="display: inline-block; text-decoration: none;">${inner}</a></td>`;
  }).join('');
  const socialIconsBlock = showSocialLinks ? `<tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>${socialCells}</tr></table>
                  </td>
                </tr>` : '';

  // Hero: 72px badge PNG (144px source for retina) above the H1 — the one
  // visual cue that tells the reader what kind of email this is at a glance.
  const heroBlock = hero
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 18px 0;"><tr><td>
        <img src="${getEmailHeroUrl(hero)}" alt="" width="72" height="72" style="display: block; width: 72px; height: 72px; border: 0;" />
      </td></tr></table>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta content="width=device-width, initial-scale=1" name="viewport" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta content="telephone=no" name="format-detection" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Dynopay</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .outer { width: 100% !important; }
      .inner { padding: 28px 20px !important; }
      .hdr { padding: 20px !important; }
      .ftr { padding: 24px 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .bg { background-color: #0a0a0a !important; }
      .card { background-color: #18181b !important; }
      .hdr-bar { background-color: #050505 !important; }
      h1.hdg { color: #fafafa !important; }
      /* CTA button: same indigo bg + white text in BOTH modes (inversion-proof) */
      .btn { background-color: #4338CA !important; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; }
      .btn span { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; }
      /* Content area: override ALL child elements */
      .msg, .msg p, .msg li, .msg td, .msg div, .msg span { color: #d4d4d8 !important; }
      .msg strong, .msg b { color: #fafafa !important; }
      .msg a:not(.btn) { color: #818CF8 !important; }
      /* Tables inside content */
      .msg table td { color: #d4d4d8 !important; }
      .msg table td strong { color: #fafafa !important; }
      .msg table td span { color: #d4d4d8 !important; }
      /* Info box */
      .info-box { background-color: #212124 !important; border-color: #33333a !important; }
      .info-box td, .info-box p, .info-box span { color: #d4d4d8 !important; }
      .info-box strong { color: #fafafa !important; }
      /* Status badges */
      .status-success { background-color: #052e16 !important; color: #86EFAC !important; }
      .status-pending { background-color: #78350f !important; color: #fcd34d !important; }
      .status-error { background-color: #7f1d1d !important; color: #fca5a5 !important; }
      /* Data rows */
      .data-row { border-bottom-color: #33333a !important; }
      /* Sign-off */
      .sign { color: #a1a1aa !important; }
      .sign strong { color: #d4d4d8 !important; }
      .sep { border-top-color: #33333a !important; }
      /* Footer */
      .ftr-bg { background-color: #050505 !important; }
      .ftr-text { color: #71717a !important; }
      .ftr-link { color: #71717a !important; }
      /* Colored accent boxes */
      .alert-box { background-color: #2b2108 !important; border-left-color: #f59e0b !important; }
      .alert-box td, .alert-box p, .alert-box span { color: #fcd34d !important; }
      .alert-box strong { color: #fef3c7 !important; }
      .error-box { background-color: #2c0f0f !important; border-left-color: #ef4444 !important; }
      .error-box td, .error-box p, .error-box span { color: #fca5a5 !important; }
      .error-box strong { color: #fee2e2 !important; }
      .success-box { background-color: ${T.greenSurfaceDark} !important; border-left-color: ${T.green} !important; }
      .success-box td, .success-box p, .success-box span { color: ${T.greenTextDark} !important; }
      .success-box strong { color: #DCFCE7 !important; }
      .neutral-box { background-color: #212124 !important; border-color: #33333a !important; }
      .neutral-box td, .neutral-box p, .neutral-box span { color: #d4d4d8 !important; }
      .neutral-box strong { color: #fafafa !important; }
      /* Stat cards (two-column highlight blocks) */
      .stat-card { background-color: #212124 !important; }
      .stat-card td, .stat-card p, .stat-card span { color: #d4d4d8 !important; }
      .stat-card .stat-value { color: #fafafa !important; }
      .stat-card .stat-value-green { color: #4ADE80 !important; }
      /* OTP code block (already dark by design — brighten the frame) */
      .otp-code { background-color: #0a0a0a !important; border-color: #818CF8 !important; color: #818CF8 !important; }
      /* Warning/security text */
      .warn-text, .warn-text p { color: #fca5a5 !important; }
      .warn-text strong { color: #fee2e2 !important; }
      /* Monospace text (addresses, tx IDs) */
      .mono { color: #d4d4d8 !important; }
      /* Wallet address box */
      .addr-box { background-color: #212124 !important; }
      .addr-box td { color: #d4d4d8 !important; }
      /* Fee table rows */
      .fee-row td { color: #d4d4d8 !important; border-bottom-color: #33333a !important; }
      .fee-total td { color: #fafafa !important; }
      /* Section dividers */
      .section-border { border-bottom-color: #33333a !important; }
      /* Gmail workaround */
      u + .body .bg { background-color: #0a0a0a !important; }
    }
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; background-color: #f5f5f4;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f5f5f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="outer card" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <!-- Neon accent bar -->
          <tr>
            <td style="background-color: #4338CA; height: 5px; line-height: 5px; font-size: 5px;">&nbsp;</td>
          </tr>
          <!-- Logo Header -->
          <tr>
            <td class="hdr hdr-bar" style="background-color: #050505; padding: 26px 32px; text-align: center;">
              <a href="https://dynopay.com" style="text-decoration: none;">
                <img src="${LOGO_URL}" alt="Dynopay" width="120" height="40" style="display: inline-block; max-width: 120px; height: auto;" />
              </a>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="inner msg" style="padding: 36px 40px 40px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              ${heroBlock}
              <h1 class="hdg" style="font-size: 24px; font-weight: 800; color: #0a0a0a; margin: 0 0 20px 0; line-height: 1.3; letter-spacing: -0.3px;">${heading}</h1>
              ${bodyContent}
              ${buttonBlock}
              <!-- Sign-off -->
              <table role="presentation" class="sep" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td class="sign" style="padding-top: 20px; font-size: 14px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5;">
                    ${chrome.bestRegards}<br /><strong style="color: #374151;">${chrome.team}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="ftr ftr-bg" style="background-color: #050505; padding: 28px 32px; text-align: center; border-radius: 0 0 16px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <img src="${LOGO_URL}" alt="Dynopay" width="90" height="30" style="display: inline-block; max-width: 90px; height: auto; opacity: 0.8;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" class="ftr-text" style="color: #818CF8; font-size: 12px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 16px; line-height: 1.5;">
                    ${chrome.tagline}
                  </td>
                </tr>
                ${socialIconsBlock}
                <tr>
                  <td align="center" class="ftr-text" style="color: #4b5563; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 12px;">
                    ${chrome.rights}
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/privacy-policy" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.privacy}</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/terms-conditions" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.terms}</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/help-support" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.support}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Reusable email component: Info/data box
 * Used for payment details, transaction info, etc.
 */
export const infoBox = (content: string, borderColor: string = '#4338CA'): string => {
  return `<table role="presentation" class="info-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; border-left: 4px solid ${borderColor}; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Reusable email component: Data row for tables
 */
export const dataRow = (label: string, value: string, isLast: boolean = false): string => {
  const border = isLast ? '' : 'border-bottom: 1px solid #f1f5f9;';
  return `<tr class="data-row" style="${border}">
    <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</td>
    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right;">${value}</td>
  </tr>`;
};

/**
 * Reusable email component: Status badge
 */
export const statusBadge = (label: string, type: 'success' | 'pending' | 'error' | 'info' = 'info'): string => {
  const styles: Record<string, { bg: string; color: string; cls: string }> = {
    success: { bg: '#dcfce7', color: '#166534', cls: 'status-success' },
    pending: { bg: '#fef3c7', color: '#92400e', cls: 'status-pending' },
    error: { bg: '#fee2e2', color: '#991b1b', cls: 'status-error' },
    info: { bg: '#dbeafe', color: '#1e40af', cls: 'status-success' },
  };
  const s = styles[type];
  return `<span class="${s.cls}" style="display: inline-block; background: ${s.bg}; color: ${s.color}; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</span>`;
};

/**
 * Standard paragraph style
 */
export const p = (text: string, extra: string = ''): string => {
  return `<p style="font-size: 15px; color: #374151; line-height: 1.65; margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; ${extra}">${text}</p>`;
};

/**
 * OTP code display
 */
export const otpBlock = (code: string): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr><td align="center">
      <div class="otp-code" style="display: inline-block; background-color: #050505; border: 1px solid #050505; border-radius: 14px; padding: 18px 44px; font-size: 32px; font-weight: 700; color: #818CF8; letter-spacing: 10px; font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;">${code}</div>
    </td></tr>
  </table>`;
};


/**
 * Warning/security text paragraph (red text with dark mode support)
 */
export const warnText = (text: string): string => {
  return `<p class="warn-text" style="font-size: 14px; color: #991b1b; line-height: 1.65; margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${text}</p>`;
};

/**
 * Alert box (amber/warning variant of infoBox)
 */
export const alertBox = (content: string): string => {
  return `<table role="presentation" class="alert-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border-left: 3px solid #f59e0b; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Error box (red variant of infoBox)
 */
export const errorBox = (content: string): string => {
  return `<table role="presentation" class="error-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; border-left: 3px solid #ef4444; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Success box (green variant of infoBox)
 */
export const successBox = (content: string): string => {
  return `<table role="presentation" class="success-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${T.greenSurface}; border-radius: 8px; border-left: 3px solid ${T.green}; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Neutral box (gray, for address blocks, wallet info, etc.)
 */
export const neutralBox = (content: string): string => {
  return `<table role="presentation" class="neutral-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; border-radius: 6px; margin: 16px 0;">
    <tr><td style="padding: 12px 16px;">${content}</td></tr>
  </table>`;
};

/**
 * Stat card — for two-column highlight blocks (Received / Payout)
 */
export const statCard = (label: string, value: string, subtitle: string, variant: 'blue' | 'green' = 'blue'): string => {
  const valueClass = variant === 'green' ? 'stat-value-green' : 'stat-value';
  const valueFallbackColor = variant === 'green' ? T.greenDeep : '#0a0a0a';
  return `<table role="presentation" class="stat-card" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${variant === 'green' ? T.greenSurface : '#fafaf9'}; border: 1px solid ${variant === 'green' ? T.greenBorder : '#e7e5e4'}; border-radius: 12px;">
    <tr><td style="padding: 16px; text-align: center;">
      <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
      <p class="${valueClass}" style="font-size: 22px; font-weight: 700; color: ${valueFallbackColor}; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${value}</p>
      <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${subtitle}</p>
    </td></tr>
  </table>`;
};

/**
 * Two-column stat cards side by side
 */
export const twoColumnStats = (leftHtml: string, rightHtml: string): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr>
      <td style="padding: 0 4px 0 0; width: 50%;">${leftHtml}</td>
      <td style="padding: 0 0 0 4px; width: 50%;">${rightHtml}</td>
    </tr>
  </table>`;
};

/**
 * Fee breakdown table row
 */
export const feeRow = (label: string, value: string, isNegative: boolean = false): string => {
  const valueColor = isNegative ? '#dc2626' : '#1f2937';
  return `<tr class="fee-row">
    <td style="padding: 6px 0; color: #6b7280; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f1f5f9;">${label}</td>
    <td style="padding: 6px 0; text-align: right; color: ${valueColor}; font-size: 13px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f1f5f9;">${value}</td>
  </tr>`;
};

/**
 * Fee breakdown total row (bold, no border)
 */
export const feeTotalRow = (label: string, value: string): string => {
  return `<tr class="fee-total">
    <td style="padding: 10px 0 0; font-weight: 700; color: #1f2937; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</td>
    <td style="padding: 10px 0 0; text-align: right; font-weight: 700; color: #15803d; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${value}</td>
  </tr>`;
};

/**
 * Fee breakdown table wrapper
 */
export const feeTable = (rows: string): string => {
  return alertBox(`
    <p style="font-size: 13px; font-weight: 600; color: #78716c; margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Fee Breakdown</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  `);
};

/**
 * Monospace text for addresses, IDs, hashes (with dark mode class)
 */
export const mono = (text: string): string => {
  return `<span class="mono" style="font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif; font-size: 13px; word-break: break-all; color: #374151;">${text}</span>`;
};
