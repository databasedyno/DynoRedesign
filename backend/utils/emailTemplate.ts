/**
 * Shared professional email base template for Dynopay
 * Used by both services/emailService.ts and helper/sendEmail.ts
 */

import { getCurrencySymbol as getCurrencySymbolShared } from "./currencyUtils";
import config from "./config";
import { EMAIL_TOKENS as T } from "./brandTokens";
import { t as tr, normalizeLang } from "./emailI18n";
import { ctaButton, formatPercent } from "./emailButton";
export { ctaButton, formatPercent };

// Cache-busted email logo filename. Regenerated from the CURRENT landing white
// wordmark (assets/Icons/home/dynopay-whiteLogo.svg) baked onto the dark #050505
// email chip, so it is pixel-identical to the site header. The version suffix is
// REQUIRED: Gmail/Outlook proxy-cache remote images by URL, so reusing the old
// filename kept serving the stale logo even after the image bytes changed.
const EMAIL_LOGO_FILE = "dynopay-email-logo-v5.png";

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
export const getEmailHeroUrl = (icon: string, safeDeal = false): string => {
  const base = config.serverUrl || config.frontendUrl || config.publicBaseUrl || DYNOPAY_PROD_BASE;
  const dir = safeDeal ? "email/hero/safedeal" : "email/hero";
  return `${base.replace(/\/+$/, "")}/api/static/${dir}/${icon}.png`;
};

/**
 * Professional base email template
 * Renders the outer shell: header, content area, footer
 */
/** Who the email is for — drives the footer "why you received this" line. */
/**
 * Footer "why you received this" variant.
 *  merchant / buyer / admin — Dynopay chrome.
 *  For the SafeDeal chrome: 'buyer' (default) = party to a deal; 'account' = wallet /
 *  security emails (sign-in codes, cashouts, top-ups, payout addresses) that have nothing to
 *  do with a specific deal — the escrow sentence would be irrelevant there.
 */
export type EmailAudience = 'merchant' | 'buyer' | 'admin' | 'account';

/** Which product the email speaks for. SafeDeal reuses the Dynopay chrome with its own wordmark + copy. */
export type EmailBrand = 'dynopay' | 'safedeal';

export const safedealBaseUrl = (): string =>
  (config.raw('SAFEDEAL_URL') || 'https://safedeal.sh').trim().replace(/\/+$/, '');

/** Inline text wordmark (SVG/data URIs don't render in mail clients). */
const safedealWordmark = (size: number, opacity = 1): string =>
  `<span style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: ${size}px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; opacity: ${opacity}; line-height: 1;">Safe<span style="color: #FFC61A;">Deal</span></span>`;

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
    /** Footer "why you received this" variant. Defaults to merchant. */
    audience?: EmailAudience;
    /** Product chrome — 'safedeal' swaps the wordmark, tagline, signature and "why" line. */
    brand?: EmailBrand;
  }
): string => {
  const LOGO_URL = getDynopayLogoUrl();
  const year = new Date().getFullYear();
  const { showButton = false, buttonText = '', buttonLink = '', lang, hero, audience = 'merchant', brand = 'dynopay' } = options || {};
  const isSafeDeal = brand === 'safedeal';
  // Brand accent palette — SafeDeal reskins the shared chrome to gold-on-ink;
  // Dynopay is signal yellow on Bybit black (btnText is Bybit black on yellow).
  const bc = isSafeDeal
    ? { bar: '#FFC61A', btnBg: '#FFC61A', btnText: '#0A0A0B', accentDark: '#F5C451', linkDark: '#F5C451', taglineLight: '#B77E00', taglineDark: '#F5C451', otpDark: '#FFD874', pillBgDark: '#3A2E08', pillTextDark: '#FCE7A6' }
    : { bar: '#FFD100', btnBg: '#FFD100', btnText: '#121214', accentDark: '#FFD100', linkDark: '#FFD100', taglineLight: '#FFD100', taglineDark: '#FFD100', otpDark: '#FFD100', pillBgDark: '#222227', pillTextDark: '#FFE680' };
  // Preheader: never let the client fall back to "Hey Alex," — use the heading when none given.
  const preheader = (options?.preheader || '').trim() || heading.replace(/<[^>]+>/g, '').trim();
  const legal = legalEntity();
  const frontendUrl = (process.env.FRONTEND_URL || DYNOPAY_PROD_BASE).replace(/\/$/, '');
  // <html lang> follows the recipient language (screen readers / client hyphenation).
  const htmlLang = normalizeLang(lang);
  // Localized chrome strings (English when no lang passed → unchanged for all
  // existing callers; t() falls back to English for any missing key).
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
  // Footer legal/help links follow the brand: SafeDeal has its own /privacy, /terms and /help
  // pages — pointing its users at dynopay.com pages was wrong (2026-09 email audit).
  const links = isSafeDeal
    ? { privacy: `${brandHome}/privacy`, terms: `${brandHome}/terms`, help: `${brandHome}/help` }
    : { privacy: `${frontendUrl}/privacy-policy`, terms: `${frontendUrl}/terms-conditions`, help: `${frontendUrl}/help-support` };
  const brandTitle = isSafeDeal ? 'SafeDeal' : 'Dynopay';
  const headerMark = isSafeDeal
    ? safedealWordmark(24)
    : `<img src="${LOGO_URL}" alt="Dynopay" width="120" height="40" style="display: inline-block; max-width: 120px; height: auto;" />`;
  const footerMark = isSafeDeal
    ? safedealWordmark(18, 0.85)
    : `<img src="${LOGO_URL}" alt="Dynopay" width="90" height="30" style="display: inline-block; max-width: 90px; height: auto; opacity: 0.8;" />`;
  const ftrFont = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;";
  const whyBlock = `<tr>
                  <td align="center" class="ftr-text" style="color: #C9B9A6; font-size: 11px; line-height: 1.6; ${ftrFont} padding: 0 8px 12px;">
                    ${chrome.why}${audience === 'merchant' && !isSafeDeal ? ` <a class="ftr-link" href="${frontendUrl}/settings?section=notifications" style="color: #EFE4D2; text-decoration: underline; font-size: 11px;">${chrome.managePrefs}</a>` : ''}
                  </td>
                </tr>`;
  // The From mailbox is send-only (no inbox) — say so, and point at the help centre instead.
  const noReplyBlock = `<tr>
                  <td align="center" class="ftr-text" style="color: #C9B9A6; font-size: 11px; line-height: 1.6; ${ftrFont} padding: 0 8px 12px;">
                    ${chrome.noReply} <a class="ftr-link" href="${links.help}" style="color: #EFE4D2; text-decoration: underline; font-size: 11px;">${chrome.noReplyHelp}</a>
                  </td>
                </tr>`;
  const legalBlock = `<tr>
                  <td align="center" class="ftr-text" style="color: #C9B9A6; font-size: 11px; ${ftrFont} padding-bottom: 12px; line-height: 1.6;">
                    ${chrome.rights}${legal.address ? `<br />${legal.address}` : ''}
                  </td>
                </tr>`;

  const buttonBlock = showButton && buttonText && buttonLink
    ? ctaButton(buttonText, buttonLink, { padding: '28px 0 8px 0', bg: bc.btnBg, color: bc.btnText })
    : '';

  // Social icons: real PNGs over HTTPS (SVG/data: URIs don't render in email).
  // Falls back to a text label if no server URL is configured — never a broken image.
  // Can be hidden platform-wide via env: set SHOW_SOCIAL_LINKS=false (or the landing's
  // NEXT_PUBLIC_SHOW_SOCIAL_LINKS=false). Either name turns social off everywhere. Default = shown.
  const showSocialLinks =
    !isSafeDeal &&
    (process.env.SHOW_SOCIAL_LINKS ?? 'true').toLowerCase() !== 'false' &&
    (process.env.NEXT_PUBLIC_SHOW_SOCIAL_LINKS ?? 'true').toLowerCase() !== 'false';
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
      : `<span style="color: #FFD100; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${s.label}</span>`;
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
        <img src="${getEmailHeroUrl(hero, isSafeDeal)}" alt="" width="72" height="72" style="display: block; width: 72px; height: 72px; border: 0;" />
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
      .inner { padding: 28px 20px !important; }
      .hdr { padding: 20px !important; }
      .ftr { padding: 24px 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .bg { background-color: #0A0A0D !important; }
      .card { background-color: #101014 !important; }
      .hdr-bar { background-color: #121214 !important; }
      h1.hdg { color: #fafafa !important; }
      /* CTA button: same brand bg + dark label in BOTH modes (inversion-proof) */
      .btn { background-color: ${bc.btnBg} !important; color: ${bc.btnText} !important; -webkit-text-fill-color: ${bc.btnText} !important; }
      .btn span { color: ${bc.btnText} !important; -webkit-text-fill-color: ${bc.btnText} !important; }
      /* Content area: override ALL child elements */
      .msg, .msg p, .msg li, .msg td, .msg div, .msg span { color: #d4d4d8 !important; }
      .msg strong, .msg b { color: #fafafa !important; }
      .msg h2, .msg h3, .msg h4 { color: #fafafa !important; }
      .msg .accent { color: ${bc.accentDark} !important; }
      .msg a:not(.btn) { color: ${bc.linkDark} !important; }
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
      .ftr-bg { background-color: #121214 !important; }
      .ftr-text { color: #C9B9A6 !important; }
      .ftr-tagline { color: ${bc.taglineDark} !important; }
      .ftr-link { color: #EFE4D2 !important; }
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
      .otp-code { background-color: #121214 !important; border-color: ${bc.otpDark} !important; color: ${bc.otpDark} !important; }
      /* Warning/security text */
      .warn-text, .warn-text p, .msg strong.warn-text { color: #fca5a5 !important; }
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
      /* --- Dark-mode surface sweep: light callouts/chips/tables/pills --- */
      .msg table th { color: #d4d4d8 !important; }
      .pill, .msg a.pill { background-color: ${bc.pillBgDark} !important; color: ${bc.pillTextDark} !important; -webkit-text-fill-color: ${bc.pillTextDark} !important; }
      .hl-box { background-color: #1c1c22 !important; } .hl-box td, .hl-box p, .hl-box span, .hl-box div { color: #d4d4d8 !important; } .hl-box strong { color: #fafafa !important; }
      .chip { background-color: #26262c !important; color: #e4e4e7 !important; border-color: #33333a !important; } .chip-success, .success-box .chip { background-color: #14532d !important; color: #DCFCE7 !important; }
      .tbl-surface { background-color: #18181b !important; border-color: #33333a !important; } .tbl-head { background-color: #26262c !important; } .track { background-color: #3a3a42 !important; }
      /* Crisp money card + amount hero (2026 email redesign) */
      .money-card { background-color: #18181b !important; border-color: #33333a !important; }
      .money-card td, .money-card p, .money-card span { color: #d4d4d8 !important; }
      .money-card strong { color: #fafafa !important; }
      .money-card .fee-total td { color: #fafafa !important; }
      .amt-hero-value { color: #fafafa !important; }
      .amt-hero-sub { color: #a1a1aa !important; }
      /* Gmail workaround */
      u + .body .bg { background-color: #0A0A0D !important; }
    }
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; background-color: #F5F7FA;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#F5F7FA;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F7FA; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="outer card" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E1E5EA; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,24,40,0.04);">
          <!-- Neon accent bar -->
          <tr>
            <td style="background-color: ${bc.bar}; height: 5px; line-height: 5px; font-size: 5px;">&nbsp;</td>
          </tr>
          <!-- Logo Header -->
          <tr>
            <td class="hdr hdr-bar" style="background-color: #121214; padding: 26px 32px; text-align: center;">
              <a href="${brandHome}" style="text-decoration: none;">
                ${headerMark}
              </a>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="inner msg" style="padding: 36px 40px 40px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              ${heroBlock}
              <h1 class="hdg" style="font-size: 23px; font-weight: 800; color: #0a0a0a; margin: 0 0 14px 0; line-height: 1.25; letter-spacing: -0.5px;">${heading}</h1>
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
            <td class="ftr ftr-bg" style="background-color: #121214; padding: 28px 32px; text-align: center; border-radius: 0 0 16px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    ${footerMark}
                  </td>
                </tr>
                <tr>
                  <td align="center" class="ftr-tagline" style="color: ${bc.taglineLight}; font-size: 12px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 16px; line-height: 1.5;">
                    ${chrome.tagline}
                  </td>
                </tr>
                ${socialIconsBlock}
                ${whyBlock}
                ${noReplyBlock}
                ${legalBlock}
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="${links.privacy}" style="color: #EFE4D2; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.privacy}</a></td>
                        <td class="ftr-text" style="color: #7A6656; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="${links.terms}" style="color: #EFE4D2; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.terms}</a></td>
                        <td class="ftr-text" style="color: #7A6656; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="${links.help}" style="color: #EFE4D2; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${chrome.support}</a></td>
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
export const infoBox = (content: string, borderColor: string = '#8B5E00'): string => {
  return `<table role="presentation" class="info-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fbfbfb; border: 1px solid #ececee; border-radius: 14px; border-left: 3px solid ${borderColor}; margin: 22px 0;">
    <tr><td style="padding: 8px 20px;">${content}</td></tr>
  </table>`;
};

/**
 * Reusable email component: Data row for tables
 */
export const dataRow = (label: string, value: string, isLast: boolean = false): string => {
  const border = isLast ? '' : 'border-bottom: 1px solid #f1f1f3;';
  return `<tr class="data-row" style="${border}">
    <td style="padding: 9px 0; color: #71717a; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</td>
    <td style="padding: 9px 0; color: #111827; font-size: 14px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right;">${value}</td>
  </tr>`;
};

/**
 * Reusable email component: Status badge
 */
export const statusBadge = (label: string, type: 'success' | 'pending' | 'error' | 'info' = 'info'): string => {
  const styles: Record<string, { bg: string; color: string; cls: string }> = {
    success: { bg: '#e7f8ef', color: '#067647', cls: 'status-success' },
    pending: { bg: '#fef6e7', color: '#b25e09', cls: 'status-pending' },
    error: { bg: '#feecec', color: '#b42318', cls: 'status-error' },
    info: { bg: '#FFF6CC', color: '#6B4800', cls: 'status-success' },
  };
  const s = styles[type];
  return `<span class="${s.cls}" style="display: inline-block; background: ${s.bg}; color: ${s.color}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</span>`;
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
export const otpBlock = (code: string, accent: string = '#FFD100'): string => {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr><td align="center">
      <div class="otp-code" style="display: inline-block; background-color: #121214; border: 1px solid #121214; border-radius: 14px; padding: 18px 44px; font-size: 32px; font-weight: 700; color: ${accent}; letter-spacing: 10px; font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;">${code}</div>
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
  const valueColor = isNegative ? '#dc2626' : '#111827';
  return `<tr class="fee-row">
    <td style="padding: 9px 0; color: #71717a; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f1f1f3;">${label}</td>
    <td style="padding: 9px 0; text-align: right; color: ${valueColor}; font-size: 14px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f1f1f3;">${value}</td>
  </tr>`;
};

/**
 * Fee breakdown total row (bold, no border)
 */
export const feeTotalRow = (label: string, value: string): string => {
  return `<tr class="fee-total">
    <td style="padding: 13px 0 2px; font-weight: 700; color: #0a0a0a; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${label}</td>
    <td style="padding: 13px 0 2px; text-align: right; font-weight: 800; color: #067647; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${value}</td>
  </tr>`;
};

/**
 * Fee breakdown table wrapper
 */
export const feeTable = (rows: string, title: string = "Fee Breakdown"): string => {
  return `<table role="presentation" class="money-card" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #ececee; border-radius: 14px; margin: 22px 0;">
    <tr><td style="padding: 18px 20px 14px;">
      <p style="font-size: 11px; font-weight: 700; color: #8a8a94; margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.6px;">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>
  </table>`;
};

/**
 * Monospace text for addresses, IDs, hashes (with dark mode class)
 */
export const mono = (text: string): string => {
  return `<span class="mono" style="font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif; font-size: 13px; word-break: break-all; color: #374151;">${text}</span>`;
};

/**
 * Amount hero — the crisp "one glance" focal block for money emails.
 * Renders a small status pill, a large amount, and an optional sub-label.
 * Sits directly under the H1 so the reader sees WHAT and HOW MUCH instantly.
 */
export const amountHero = (
  amount: string,
  options?: { pill?: string; pillType?: 'success' | 'pending' | 'error' | 'info'; sublabel?: string }
): string => {
  const { pill, pillType = 'success', sublabel } = options || {};
  const pillHtml = pill
    ? `<div style="margin: 0 0 12px;">${statusBadge(pill, pillType)}</div>`
    : '';
  const subHtml = sublabel
    ? `<div class="amt-hero-sub" style="font-size: 14px; color: #6b7280; margin-top: 8px; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${sublabel}</div>`
    : '';
  return `<table role="presentation" class="amt-hero" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 22px;">
    <tr><td>
      ${pillHtml}
      <div class="amt-hero-value" style="font-size: 36px; font-weight: 800; color: #0a0a0a; letter-spacing: -1px; line-height: 1.05; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${amount}</div>
      ${subHtml}
    </td></tr>
  </table>`;
};
