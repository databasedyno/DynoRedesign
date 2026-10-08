/**
 * Shared email layout + building blocks for Dynopay / SafeDeal (calm 2026-10 redesign).
 * White canvas, black logo, thin grey borders; gold is reserved for the main CTA button.
 * Used by services/emailService.ts and helper/sendEmail.ts.
 */

import { getCurrencySymbol as getCurrencySymbolShared } from "./currencyUtils";
import config from "./config";
import { EMAIL_TOKENS as T } from "./brandTokens";
import { t as tr, normalizeLang } from "./emailI18n";
import { ctaButton, formatPercent } from "./emailButton";
export { ctaButton, formatPercent };

// Versioned logo pair (scripts/brand/generate-logo.mjs). Light = black lockup baked on a
// white rounded chip (stays readable when Gmail force-darkens the page); dark = white lockup.
const EMAIL_LOGO_LIGHT = "dynopay-email-logo-light-v6.png";
const EMAIL_LOGO_DARK = "dynopay-email-logo-dark-v6.png";

// Last-resort absolute base used only if NO url env is configured (e.g. a worker booted
// without SERVER_URL). Points at OUR production domain, never a 3rd-party CDN.
const DYNOPAY_PROD_BASE = "https://dynopay.com";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
/** Neutral palette — ink text, grey hairlines. */
const C = { ink: "#0A0A0D", text: "#374151", muted: "#6B7280", border: "#E6E8EB", hair: "#EEF0F2", surface: "#F9FAFB" };

const assetBase = (): string =>
  (config.serverUrl || config.frontendUrl || config.publicBaseUrl || DYNOPAY_PROD_BASE).replace(/\/+$/, "");

/** Brand logo for emails, always served from our own /api/static. */
export const getDynopayLogoUrl = (variant: "light" | "dark" = "light"): string =>
  `${assetBase()}/api/static/${variant === "dark" ? EMAIL_LOGO_DARK : EMAIL_LOGO_LIGHT}`;

/**
 * Absolute URL for a grey footer social icon (PNG — SVG/data: URIs don't render in mail
 * clients). Returns null when no server URL is configured so the caller renders a text label.
 */
export const getEmailIconUrl = (name: string): string | null => {
  const serverUrl = config.serverUrl;
  return serverUrl ? `${serverUrl}/api/static/email/social/${name}.png` : null;
};

/**
 * Email-context currency symbol. Table now lives in utils/currencyUtils.ts
 * (variant 'email'); this thin wrapper keeps the existing import path + output.
 */
export const getCurrencySymbol = (currency: string): string =>
  getCurrencySymbolShared(currency, 'email');

/** Per-action hero name passed by callers; the calm layout no longer renders hero badges. */
export type EmailHero = string;

/**
 * Footer "why you received this" variant.
 *  merchant / buyer / admin — Dynopay chrome.
 *  For the SafeDeal chrome: 'buyer' (default) = party to a deal; 'account' = wallet /
 *  security emails (sign-in codes, cashouts, top-ups, payout addresses) that have nothing to
 *  do with a specific deal — the escrow sentence would be irrelevant there.
 */
export type EmailAudience = 'merchant' | 'buyer' | 'admin' | 'account';

/** Which product the email speaks for. SafeDeal reuses the Dynopay chrome with its own logo + copy. */
export type EmailBrand = 'dynopay' | 'safedeal';

export const safedealBaseUrl = (): string =>
  (config.raw('SAFEDEAL_URL') || 'https://safedeal.sh').trim().replace(/\/+$/, '');

/** Placeholder the transport layer swaps for the real recipient address (see mailTransporter). */
export const TO_EMAIL_TOKEN = '%%TO_EMAIL%%';

/** Legal footer line: entity from env (address optional, omitted when unset). */
export const legalEntity = (): { name: string; address: string } => ({
  name: (process.env.EMAIL_LEGAL_NAME || 'Dynopay').trim(),
  address: (process.env.EMAIL_LEGAL_ADDRESS || '').trim(),
});

/**
 * Operator name shown on SafeDeal surfaces (emails, PDFs, site footer, legal pages).
 * SAFEDEAL_LEGAL_NAME wins, then the platform legal entity when it is EXPLICITLY
 * configured, else "SafeDeal" — SafeDeal never falls back to the "Dynopay" default.
 */
export const safedealLegalName = (): string =>
  (process.env.SAFEDEAL_LEGAL_NAME || process.env.EMAIL_LEGAL_NAME || 'SafeDeal').trim();

const SOCIALS: Array<{ name: string; url: string; label: string }> = [
  { name: 'facebook', url: 'https://www.facebook.com/dynopay', label: 'Facebook' },
  { name: 'instagram', url: 'https://www.instagram.com/dynopay', label: 'Instagram' },
  { name: 'x', url: 'https://x.com/dynopaycom', label: 'X' },
  { name: 'linkedin', url: 'https://www.linkedin.com/company/dynopay/', label: 'LinkedIn' },
  { name: 'telegram', url: 'https://t.me/Dynopay_Announcements', label: 'Telegram' },
];

/** Black logo (light) / white logo (dark) — swapped by the dark-mode CSS below. */
const logoPair = (lightSrc: string, darkSrc: string, alt: string): string => {
  const img = (src: string) =>
    `<img src="${src}" alt="${alt}" width="132" height="44" style="display: block; width: 132px; height: 44px; border: 0;" />`;
  return `<span class="logo-light" style="display: block;">${img(lightSrc)}</span>` +
    `<!--[if !mso]><!--><span class="logo-dark" style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${img(darkSrc)}</span><!--<![endif]-->`;
};

const dynopayLogo = (): string => logoPair(getDynopayLogoUrl("light"), getDynopayLogoUrl("dark"), "Dynopay");

// SafeDeal pair (scripts/brand/safedeal-logo.mjs): gold-free, same light-chip / white-on-dark rules as Dynopay.
const safedealLogo = (): string =>
  logoPair(`${assetBase()}/api/static/safedeal-email-logo-light-v1.png`, `${assetBase()}/api/static/safedeal-email-logo-dark-v1.png`, "SafeDeal");

const footerRow = (html: string, pad = '0 8px 10px'): string =>
  `<tr><td align="center" class="ftr-text" style="color: ${C.muted}; font-size: 12px; line-height: 1.6; font-family: ${FONT}; padding: ${pad};">${html}</td></tr>`;

const footerLink = (href: string, label: string, underline = false): string =>
  `<a class="ftr-link" href="${href}" style="color: ${C.text}; text-decoration: ${underline ? 'underline' : 'none'}; font-size: 12px; font-family: ${FONT};">${label}</a>`;

const DARK_CSS = (btnBg: string, btnText: string): string => `
    @media (prefers-color-scheme: dark) {
      body, .bg { background-color: #0A0A0D !important; }
      .card { background-color: #121214 !important; border-color: #26262B !important; }
      .hdr { border-bottom-color: #26262B !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
      h1.hdg { color: #FAFAFA !important; }
      /* Main CTA: same gold + dark label in BOTH modes (inversion-proof) */
      .btn { background-color: ${btnBg} !important; color: ${btnText} !important; -webkit-text-fill-color: ${btnText} !important; }
      .btn span { color: ${btnText} !important; -webkit-text-fill-color: ${btnText} !important; }
      .btn-secondary { background-color: transparent !important; border-color: #3F3F46 !important; color: #FAFAFA !important; -webkit-text-fill-color: #FAFAFA !important; }
      .msg, .msg p, .msg li, .msg td, .msg div, .msg span { color: #D4D4D8 !important; }
      .msg strong, .msg b, .msg h2, .msg h3, .msg h4, .msg .accent { color: #FAFAFA !important; }
      .msg a:not(.btn) { color: #FAFAFA !important; }
      .msg table td, .msg table td span, .msg table th { color: #D4D4D8 !important; }
      .msg table td strong { color: #FAFAFA !important; }
      .info-box, .money-card, .neutral-box, .stat-card, .tbl-surface, .hl-box { background-color: #18181B !important; border-color: #2A2A2F !important; }
      .info-box strong, .money-card strong, .neutral-box strong, .hl-box strong, .stat-card .stat-value { color: #FAFAFA !important; }
      .msg .stat-card .stat-value-green { color: #4ADE80 !important; }
      .msg .status-success { background-color: #052E16 !important; color: #86EFAC !important; }
      .msg .status-pending { background-color: #3B2A06 !important; color: #FCD34D !important; }
      .msg .status-error { background-color: #3B0D0D !important; color: #FCA5A5 !important; }
      .msg .status-info { background-color: #27272A !important; color: #E4E4E7 !important; }
      .data-row, .fee-row td, .section-border { border-bottom-color: #26262B !important; }
      .fee-row td { color: #D4D4D8 !important; }
      .fee-total td, .msg .amt-hero-value { color: #FAFAFA !important; }
      .msg .amt-hero-sub, .sign { color: #A1A1AA !important; }
      .sign strong { color: #D4D4D8 !important; }
      .sep { border-top-color: #26262B !important; }
      .alert-box { background-color: #2B2108 !important; border-color: #4D3A0A !important; }
      .alert-box td, .alert-box p, .alert-box span { color: #FCD34D !important; }
      .alert-box strong { color: #FEF3C7 !important; }
      .error-box { background-color: #2C0F0F !important; border-color: #4C1818 !important; }
      .error-box td, .error-box p, .error-box span { color: #FCA5A5 !important; }
      .error-box strong { color: #FEE2E2 !important; }
      .success-box { background-color: ${T.greenSurfaceDark} !important; border-color: #14532D !important; }
      .success-box td, .success-box p, .success-box span { color: ${T.greenTextDark} !important; }
      .success-box strong { color: #DCFCE7 !important; }
      .msg .otp-code { background-color: #18181B !important; border-color: #2A2A2F !important; color: #FAFAFA !important; }
      .msg .warn-text, .msg p.warn-text, .msg strong.warn-text { color: #FCA5A5 !important; }
      .msg .warn-text strong { color: #FEE2E2 !important; }
      .msg .mono, .addr-box td { color: #D4D4D8 !important; }
      .addr-box { background-color: #18181B !important; }
      .msg .pill, .msg a.pill, .msg .chip { background-color: #26262C !important; color: #E4E4E7 !important; -webkit-text-fill-color: #E4E4E7 !important; border-color: #33333A !important; }
      .msg .chip-success, .msg .success-box .chip { background-color: #14532D !important; color: #DCFCE7 !important; }
      .tbl-head { background-color: #26262C !important; }
      .track { background-color: #3A3A42 !important; }
      .ftr-text { color: #9CA3AF !important; }
      .ftr-link { color: #D4D4D8 !important; }
      u + .body .bg { background-color: #0A0A0D !important; }
    }
    [data-ogsc] .logo-light { display: none !important; }
    [data-ogsc] .logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }`;

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
    /** Accepted for caller compatibility; not rendered in the calm layout. */
    hero?: EmailHero;
    /** Footer "why you received this" variant. Defaults to merchant. */
    audience?: EmailAudience;
    /** Product chrome — 'safedeal' swaps the wordmark, tagline, signature and "why" line. */
    brand?: EmailBrand;
  }
): string => {
  const year = new Date().getFullYear();
  const { showButton = false, buttonText = '', buttonLink = '', lang, audience = 'merchant', brand = 'dynopay' } = options || {};
  const isSafeDeal = brand === 'safedeal';
  // Gold appears ONLY on the main CTA button.
  const bc = isSafeDeal ? { btnBg: '#FFC61A', btnText: '#0A0A0B' } : { btnBg: '#FFD100', btnText: C.ink };
  // Preheader: never let the client fall back to "Hey Alex," — use the heading when none given.
  const preheader = (options?.preheader || '').trim() || heading.replace(/<[^>]+>/g, '').trim();
  const legal = legalEntity();
  const frontendUrl = (process.env.FRONTEND_URL || DYNOPAY_PROD_BASE).replace(/\/$/, '');
  // <html lang> follows the recipient language (screen readers / client hyphenation).
  const htmlLang = normalizeLang(lang);
  // Localized chrome strings (English when no lang passed; t() falls back to English).
  const chrome = {
    bestRegards: tr('chrome.bestRegards', lang),
    team: isSafeDeal ? 'The SafeDeal team' : tr('chrome.teamSignature', lang),
    tagline: isSafeDeal ? 'Escrow for online deals' : tr('chrome.tagline', lang),
    // SafeDeal footer is SafeDeal-branded; the operator is named only when explicitly configured.
    rights: isSafeDeal
      ? `© SafeDeal ${year}. All rights reserved.${safedealLegalName() !== 'SafeDeal' ? ` Operated by ${safedealLegalName()}.` : ''}`
      : tr('chrome.rights', lang, { year }),
    privacy: tr('chrome.privacy', lang),
    terms: tr('chrome.terms', lang),
    support: tr('chrome.support', lang),
    why: isSafeDeal
      ? (audience === 'account'
          ? `You're receiving this because you have a SafeDeal account (${TO_EMAIL_TOKEN}). Security and wallet notices can't be switched off.`
          : `You're receiving this because ${TO_EMAIL_TOKEN} is a party to a deal on SafeDeal. Funds are held securely in escrow until both sides complete the deal.`)
      : audience === 'buyer'
      ? tr('chrome.whyBuyer', lang)
      : audience === 'admin'
        ? tr('chrome.whyAdmin', lang)
        : tr('chrome.whyMerchant', lang, { email: TO_EMAIL_TOKEN }),
    managePrefs: tr('chrome.managePrefs', lang),
    noReply: tr('chrome.noReply', lang),
    noReplyHelp: tr('chrome.noReplyHelp', lang),
  };
  const brandHome = isSafeDeal ? safedealBaseUrl() : 'https://dynopay.com';
  // Footer legal/help links follow the brand (SafeDeal has its own /privacy, /terms and /help).
  const links = isSafeDeal
    ? { privacy: `${brandHome}/privacy`, terms: `${brandHome}/terms`, help: `${brandHome}/help` }
    : { privacy: `${frontendUrl}/privacy-policy`, terms: `${frontendUrl}/terms-conditions`, help: `${frontendUrl}/help-support` };
  const brandTitle = isSafeDeal ? 'SafeDeal' : 'Dynopay';
  const headerMark = isSafeDeal ? safedealLogo() : dynopayLogo();

  const buttonBlock = showButton && buttonText && buttonLink
    ? ctaButton(buttonText, buttonLink, { padding: '26px 0 6px 0', bg: bc.btnBg, color: bc.btnText })
    : '';

  // Social row: grey PNGs; hidden platform-wide via SHOW_SOCIAL_LINKS=false (or NEXT_PUBLIC_SHOW_SOCIAL_LINKS=false).
  const showSocialLinks =
    !isSafeDeal &&
    (process.env.SHOW_SOCIAL_LINKS ?? 'true').toLowerCase() !== 'false' &&
    (process.env.NEXT_PUBLIC_SHOW_SOCIAL_LINKS ?? 'true').toLowerCase() !== 'false';
  const socialCells = SOCIALS.map((s) => {
    const icon = getEmailIconUrl(s.name);
    const inner = icon
      ? `<img src="${icon}" alt="${s.label}" width="20" height="20" style="display: block; border: 0; outline: none; text-decoration: none;" />`
      : `<span class="ftr-text" style="color: ${C.muted}; font-size: 12px; font-family: ${FONT};">${s.label}</span>`;
    return `<td style="padding: 0 7px;"><a href="${s.url}" target="_blank" style="display: inline-block; text-decoration: none;">${inner}</a></td>`;
  }).join('');
  const socialIconsBlock = showSocialLinks
    ? `<tr><td align="center" style="padding: 0 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${socialCells}</tr></table></td></tr>`
    : '';
  const prefsLink = audience === 'merchant' && !isSafeDeal ? ` ${footerLink(`${frontendUrl}/settings?section=notifications`, chrome.managePrefs, true)}` : '';
  const sep = `<span class="ftr-text" style="color: #C4C8CE; padding: 0 8px;">·</span>`;

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
  <title>${brandTitle}</title>
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
      .inner { padding: 28px 22px 32px !important; }
      .hdr { padding: 22px 22px 18px !important; }
    }${DARK_CSS(bc.btnBg, bc.btnText)}
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; background-color: #FFFFFF;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 16px 32px;">
        <table role="presentation" class="outer" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td>
              <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid ${C.border}; border-radius: 12px; border-collapse: separate;">
                <!-- Header: black logo on white (white logo in dark mode) -->
                <tr>
                  <td class="hdr" align="left" style="padding: 26px 40px 22px; border-bottom: 1px solid ${C.hair};">
                    <a href="${brandHome}" style="text-decoration: none; display: inline-block;">${headerMark}</a>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td class="inner msg" style="padding: 34px 40px 36px; font-family: ${FONT}; color: ${C.text}; font-size: 15px; line-height: 1.65;">
                    <h1 class="hdg" style="font-size: 22px; font-weight: 700; color: ${C.ink}; margin: 0 0 16px 0; line-height: 1.3; letter-spacing: -0.3px;">${heading}</h1>
                    ${bodyContent}
                    ${buttonBlock}
                    <table role="presentation" class="sep" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid ${C.hair};">
                      <tr>
                        <td class="sign" style="padding-top: 20px; font-size: 14px; color: ${C.muted}; font-family: ${FONT}; line-height: 1.5;">
                          ${chrome.bestRegards}<br /><strong style="color: ${C.text};">${chrome.team}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 28px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${socialIconsBlock}
                ${footerRow(`<strong class="ftr-link" style="color: ${C.text}; font-weight: 600;">${brandTitle}</strong> · ${chrome.tagline}`)}
                ${footerRow(`${chrome.why}${prefsLink}`)}
                ${footerRow(`${chrome.noReply} ${footerLink(links.help, chrome.noReplyHelp, true)}`)}
                ${footerRow(`${chrome.rights}${legal.address ? `<br />${legal.address}` : ''}`, '0 8px 14px')}
                ${footerRow(`${footerLink(links.privacy, chrome.privacy)}${sep}${footerLink(links.terms, chrome.terms)}${sep}${footerLink(links.help, chrome.support)}`, '0')}
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

/** Details card: white surface, thin grey border. */
export const infoBox = (content: string): string => {
  return `<table role="presentation" class="info-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid ${C.border}; border-radius: 10px; border-collapse: separate; margin: 22px 0;">
    <tr><td style="padding: 6px 20px;">${content}</td></tr>
  </table>`;
};

/** Label / value row inside an infoBox table. */
export const dataRow = (label: string, value: string, isLast: boolean = false): string => {
  const border = isLast ? '' : `border-bottom: 1px solid ${C.hair};`;
  return `<tr class="data-row" style="${border}">
    <td style="padding: 11px 0; color: ${C.muted}; font-size: 14px; font-family: ${FONT};">${label}</td>
    <td style="padding: 11px 0; color: ${C.ink}; font-size: 14px; font-weight: 500; font-family: ${FONT}; text-align: right;">${value}</td>
  </tr>`;
};

/** Small status badge (sentence case, soft tint). */
export const statusBadge = (label: string, type: 'success' | 'pending' | 'error' | 'info' = 'info'): string => {
  const styles: Record<string, { bg: string; color: string; cls: string }> = {
    success: { bg: '#ECFDF3', color: '#067647', cls: 'status-success' },
    pending: { bg: '#FFFAEB', color: '#B54708', cls: 'status-pending' },
    error: { bg: '#FEF3F2', color: '#B42318', cls: 'status-error' },
    info: { bg: '#F2F4F7', color: '#344054', cls: 'status-info' },
  };
  const s = styles[type];
  return `<span class="${s.cls}" style="display: inline-block; background: ${s.bg}; color: ${s.color}; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; font-family: ${FONT};">${label}</span>`;
};

/** Standard paragraph style. */
export const p = (text: string, extra: string = ''): string => {
  return `<p style="font-size: 15px; color: ${C.text}; line-height: 1.65; margin: 0 0 14px 0; font-family: ${FONT}; ${extra}">${text}</p>`;
};

/** One-time code box — neutral surface, monospace digits. */
export const otpBlock = (code: string): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr><td align="left">
      <div class="otp-code" style="display: inline-block; background-color: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 16px 32px; font-size: 30px; font-weight: 700; color: ${C.ink}; letter-spacing: 8px; font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;">${code}</div>
    </td></tr>
  </table>`;
};

/** Warning/security text paragraph (red text with dark mode support). */
export const warnText = (text: string): string => {
  return `<p class="warn-text" style="font-size: 14px; color: #991B1B; line-height: 1.65; margin: 0 0 14px 0; font-family: ${FONT};">${text}</p>`;
};

const tintBox = (cls: string, bg: string, border: string, content: string): string =>
  `<table role="presentation" class="${cls}" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${bg}; border: 1px solid ${border}; border-radius: 10px; border-collapse: separate; margin: 20px 0;">
    <tr><td style="padding: 16px 20px;">${content}</td></tr>
  </table>`;

/** Amber notice. */
export const alertBox = (content: string): string => tintBox('alert-box', '#FFFBEB', '#FDE68A', content);

/** Red notice. */
export const errorBox = (content: string): string => tintBox('error-box', '#FEF2F2', '#FECACA', content);

/** Green notice. */
export const successBox = (content: string): string => tintBox('success-box', T.greenSurface, T.greenBorder, content);

/** Neutral grey box (address blocks, wallet info, etc.). */
export const neutralBox = (content: string): string => {
  return `<table role="presentation" class="neutral-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${C.surface}; border: 1px solid ${C.hair}; border-radius: 8px; border-collapse: separate; margin: 16px 0;">
    <tr><td style="padding: 12px 16px;">${content}</td></tr>
  </table>`;
};

/** Stat card — two-column highlight blocks (Received / Payout). */
export const statCard = (label: string, value: string, subtitle: string, variant: 'blue' | 'green' = 'blue'): string => {
  const green = variant === 'green';
  return `<table role="presentation" class="stat-card" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${green ? T.greenSurface : '#FFFFFF'}; border: 1px solid ${green ? T.greenBorder : C.border}; border-radius: 10px; border-collapse: separate;">
    <tr><td style="padding: 16px; text-align: center;">
      <p style="font-size: 12px; font-weight: 600; color: ${C.muted}; margin: 0 0 4px 0; font-family: ${FONT};">${label}</p>
      <p class="${green ? 'stat-value-green' : 'stat-value'}" style="font-size: 22px; font-weight: 700; color: ${green ? T.greenDeep : C.ink}; margin: 0; font-family: ${FONT};">${value}</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 4px 0 0 0; font-family: ${FONT};">${subtitle}</p>
    </td></tr>
  </table>`;
};

/** Two-column stat cards side by side. */
export const twoColumnStats = (leftHtml: string, rightHtml: string): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr>
      <td style="padding: 0 4px 0 0; width: 50%;">${leftHtml}</td>
      <td style="padding: 0 0 0 4px; width: 50%;">${rightHtml}</td>
    </tr>
  </table>`;
};

/** Fee breakdown table row. */
export const feeRow = (label: string, value: string, isNegative: boolean = false): string => {
  const cell = `padding: 10px 0; font-size: 14px; font-family: ${FONT}; border-bottom: 1px solid ${C.hair};`;
  return `<tr class="fee-row">
    <td style="${cell} color: ${C.muted};">${label}</td>
    <td style="${cell} text-align: right; color: ${isNegative ? '#DC2626' : C.ink}; font-weight: 500;">${value}</td>
  </tr>`;
};

/** Fee breakdown total row (bold, no border). */
export const feeTotalRow = (label: string, value: string): string => {
  return `<tr class="fee-total">
    <td style="padding: 13px 0 2px; font-weight: 700; color: ${C.ink}; font-size: 15px; font-family: ${FONT};">${label}</td>
    <td style="padding: 13px 0 2px; text-align: right; font-weight: 700; color: #067647; font-size: 16px; font-family: ${FONT};">${value}</td>
  </tr>`;
};

/** Fee breakdown table wrapper. */
export const feeTable = (rows: string, title: string = "Fee Breakdown"): string => {
  return `<table role="presentation" class="money-card" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid ${C.border}; border-radius: 10px; border-collapse: separate; margin: 22px 0;">
    <tr><td style="padding: 18px 20px 14px;">
      <p style="font-size: 12px; font-weight: 600; color: ${C.muted}; margin: 0 0 6px; font-family: ${FONT};">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>
  </table>`;
};

/** Monospace text for addresses, IDs, hashes (with dark mode class). */
export const mono = (text: string): string => {
  return `<span class="mono" style="font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif; font-size: 13px; word-break: break-all; color: ${C.text};">${text}</span>`;
};

/**
 * Amount hero — the "one glance" focal block for money emails: optional status pill,
 * a large amount and an optional sub-label, directly under the H1.
 */
export const amountHero = (
  amount: string,
  options?: { pill?: string; pillType?: 'success' | 'pending' | 'error' | 'info'; sublabel?: string }
): string => {
  const { pill, pillType = 'success', sublabel } = options || {};
  const pillHtml = pill ? `<div style="margin: 0 0 12px;">${statusBadge(pill, pillType)}</div>` : '';
  const subHtml = sublabel
    ? `<div class="amt-hero-sub" style="font-size: 14px; color: ${C.muted}; margin-top: 8px; line-height: 1.4; font-family: ${FONT};">${sublabel}</div>`
    : '';
  return `<table role="presentation" class="amt-hero" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 22px;">
    <tr><td>
      ${pillHtml}
      <div class="amt-hero-value" style="font-size: 34px; font-weight: 700; color: ${C.ink}; letter-spacing: -0.8px; line-height: 1.1; font-family: ${FONT};">${amount}</div>
      ${subHtml}
    </td></tr>
  </table>`;
};
