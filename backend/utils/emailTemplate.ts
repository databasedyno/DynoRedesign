/**
 * Shared professional email base template for Dynopay
 * Used by both services/emailService.ts and helper/sendEmail.ts
 */

import { getCurrencySymbol as getCurrencySymbolShared } from "./currencyUtils";
import config from "./config";

// Public CDN-hosted PNG logo for maximum email client compatibility
const DYNOPAY_LOGO_CDN = "https://files.catbox.moe/9wq2et.png";

export const getDynopayLogoUrl = (): string => {
  const serverUrl = config.serverUrl;
  if (serverUrl) {
    return `${serverUrl}/api/static/dynopay-white-logo.png`;
  }
  return DYNOPAY_LOGO_CDN;
};

/**
 * Email-context currency symbol. Table now lives in utils/currencyUtils.ts
 * (variant 'email'); this thin wrapper keeps the existing import path + output.
 */
export const getCurrencySymbol = (currency: string): string =>
  getCurrencySymbolShared(currency, 'email');

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
  }
): string => {
  const LOGO_URL = getDynopayLogoUrl();
  const year = new Date().getFullYear();
  const { showButton = false, buttonText = '', buttonLink = '', preheader = '' } = options || {};

  const buttonBlock = showButton && buttonText && buttonLink
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 28px 0 8px 0;">
        <a href="${buttonLink}" class="btn" style="display: inline-block; background-color: #4F46E5; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
          <!--[if mso]><i style="mso-font-width: 150%; mso-text-raise: 26pt;">&nbsp;</i><![endif]-->
          <span style="mso-text-raise: 13pt; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF;">${buttonText}</span>
          <!--[if mso]><i style="mso-font-width: 150%;">&nbsp;</i><![endif]-->
        </a>
      </td></tr></table>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
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
      .btn { background-color: #4F46E5 !important; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; }
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
      .success-box { background-color: #052e16 !important; border-left-color: #22C55E !important; }
      .success-box td, .success-box p, .success-box span { color: #d9f99d !important; }
      .success-box strong { color: #f7fee7 !important; }
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
            <td style="background-color: #4F46E5; height: 5px; line-height: 5px; font-size: 5px;">&nbsp;</td>
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
              <h1 class="hdg" style="font-size: 24px; font-weight: 800; color: #0a0a0a; margin: 0 0 20px 0; line-height: 1.3; letter-spacing: -0.3px;">${heading}</h1>
              ${bodyContent}
              ${buttonBlock}
              <!-- Sign-off -->
              <table role="presentation" class="sep" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td class="sign" style="padding-top: 20px; font-size: 14px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5;">
                    Best regards,<br /><strong style="color: #374151;">The Dynopay Team</strong>
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
                    Secure Crypto Payment Gateway
                  </td>
                </tr>
                <!-- Social icons (inline SVG data URIs — no external CDN dependency) -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 6px;"><a href="https://www.facebook.com/dynopay" target="_blank" style="display: inline-block; width: 24px; height: 24px;"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOWNhM2FmIj48cGF0aCBkPSJNMjQgMTIuMDczYzAtNi42MjctNS4zNzMtMTItMTItMTJzLTEyIDUuMzczLTEyIDEyYzAgNS45OSA0LjM4OCAxMC45NTQgMTAuMTI1IDExLjg1NHYtOC4zODVINy4wNzh2LTMuNDdoMy4wNDdWOS40M2MwLTMuMDA3IDEuNzkyLTQuNjY5IDQuNTMzLTQuNjY5IDEuMzEyIDAgMi42ODYuMjM1IDIuNjg2LjIzNXYyLjk1M0gxNS44M2MtMS40OTEgMC0xLjk1Ni45MjYtMS45NTYgMS44NzR2Mi4yNWgzLjMyOGwtLjUzMiAzLjQ3aC0yLjc5NnY4LjM4NUMxOS42MTIgMjMuMDI3IDI0IDE4LjA2MiAyNCAxMi4wNzN6Ii8+PC9zdmc+" alt="Facebook" width="24" height="24" style="display: block; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 6px;"><a href="https://www.instagram.com/dynopay" target="_blank" style="display: inline-block; width: 24px; height: 24px;"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOWNhM2FmIj48cGF0aCBkPSJNMTIgMi4xNjNjMy4yMDQgMCAzLjU4NC4wMTIgNC44NS4wNyAzLjI1Mi4xNDggNC43NzEgMS42OTEgNC45MTkgNC45MTkuMDU4IDEuMjY1LjA2OSAxLjY0NS4wNjkgNC44NDkgMCAzLjIwNS0uMDEyIDMuNTg0LS4wNjkgNC44NDktLjE0OSAzLjIyNS0xLjY2NCA0Ljc3MS00LjkxOSA0LjkxOS0xLjI2Ni4wNTgtMS42NDQuMDctNC44NS4wNy0zLjIwNCAwLTMuNTg0LS4wMTItNC44NDktLjA3LTMuMjYtLjE0OS00Ljc3MS0xLjY5OS00LjkxOS00LjkyLS4wNTgtMS4yNjUtLjA3LTEuNjQ0LS4wNy00Ljg0OSAwLTMuMjA0LjAxMy0zLjU4My4wNy00Ljg0OS4xNDktMy4yMjcgMS42NjQtNC43NzEgNC45MTktNC45MTkgMS4yNjYtLjA1NyAxLjY0NS0uMDY5IDQuODQ5LS4wNjl6TTEyIDBoLTMuNTk0Yy0xLjMgMC0yLjEyLjA1OC0yLjg2LjEyQzMuMjUyLjMyNyAxLjUwMiAxLjg2LjMyMiA0LjE2LjEyIDUuMzcyLjA1OCA2LjA5NCAwIDEyIDAgMTcuOTA2LjA1OCAxOC42MjcuMTIgMTkuODQuMzI3IDIyLjUwOCAxLjg2IDIzLjY3MyA0LjE2IDIzLjg4IDUuMzcyIDI0IDE3LjkwNiAyNGMtNS45MDYgMC02LjYyNy0uMDU4LTcuODQtLjEyLTIuNTQ4LS4yMDctNC43NzEtMS42OTctNC45MTktNC45MTktLjA1OC0xLjI2NS0uMDctMS42NDQtLjA3LTQuODQ5IDAtMy4yMDQuMDEyLTMuNTg0LjA3LTQuODQ5LjE0OS0zLjIyNyAxLjY2NC00Ljc3MSA0LjkxOS00LjkxOUMxLjM2Mi4wNjEgMi4xNC4wMDkgNS4zNzMgMEgxMnptMCA1LjgzOGEtNi4xNjIgNi4xNjIgMCAxIDAgMCAxMi4zMjQgNi4xNjIgNi4xNjIgMCAwIDAgMC0xMi4zMjR6TTEyIDE2YTQgNCAwIDEgMSAwLTggNCA0IDAgMCAxIDAgOHptNi40MDYtMTEuODQ1YTEuNDQgMS40NCAwIDEgMCAwIDIuODggMS40NCAxLjQ0IDAgMCAwIDAtMi44OHoiLz48L3N2Zz4=" alt="Instagram" width="24" height="24" style="display: block; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 6px;"><a href="https://x.com/dynopaycom" target="_blank" style="display: inline-block; width: 24px; height: 24px;"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOWNhM2FmIj48cGF0aCBkPSJNMTguMjQ0IDIuMjVoMy4zMDhsLTcuMjI3IDguMjYgOC41MDIgMTEuMjRIMTYuMTdsLTUuMjE0LTYuODE3TDQuOTkgMjEuNzVIMS42OGw3LjczLTguODM1TDEuMjU0IDIuMjVINy44bDQuNzEzIDYuMjMxem0tMS4xNjEgMTcuNTJoMS44MzNMNy4wODQgNC4xMjZINS4xMTd6Ii8+PC9zdmc+" alt="X" width="24" height="24" style="display: block; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 6px;"><a href="https://www.linkedin.com/company/dynopay/" target="_blank" style="display: inline-block; width: 24px; height: 24px;"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOWNhM2FmIj48cGF0aCBkPSJNMjAuNDQ3IDIwLjQ1MmgtMy41NTR2LTUuNTY5YzAtMS4zMjgtLjAyNy0zLjAzNy0xLjg1Mi0zLjAzNy0xLjg1MyAwLTIuMTM2IDEuNDQ1LTIuMTM2IDIuOTM5djUuNjY3SDkuMzUxVjloMy40MTR2MS41NjFoLjA0NmMuNDc3LS45IDEuNjM3LTEuODUgMy4zNy0xLjg1IDMuNjAxIDAgNC4yNjcgMi4zNyA0LjI2NyA1LjQ1NXY2LjI4NnpNNS4zMzcgNy40MzNhMi4wNjIgMi4wNjIgMCAwIDEtMi4wNjMtMi4wNjUgMi4wNjQgMi4wNjQgMCAxIDEgMi4wNjMgMi4wNjV6bTEuNzgyIDEzLjAxOUgzLjU1NVY5aDMuNTY0djExLjQ1MnpNMjIuMjI1IDBIMS43NzFDLjc5MiAwIDAgLjc3NCAwIDEuNzI5djIwLjU0MkMwIDIzLjIyNy43OTIgMjQgMS43NzEgMjRoMjAuNDUxQzIzLjIgMjQgMjQgMjMuMjI3IDI0IDIyLjI3MVYxLjcyOUMyNCAgLjc3NCAyMy4yIDAgMjIuMjIyIDBoLjAwM3oiLz48L3N2Zz4=" alt="LinkedIn" width="24" height="24" style="display: block; opacity: 0.7;" /></a></td>
                        <td style="padding: 0 6px;"><a href="https://t.me/Dynopay_Announcements" target="_blank" style="display: inline-block; width: 24px; height: 24px;"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOWNhM2FmIj48cGF0aCBkPSJNMTEuOTQ0IDBBMTIgMTIgMCAwIDAgMCAxMmExMiAxMiAwIDAgMCAxMiAxMiAxMiAxMiAwIDAgMCAxMi0xMkExMiAxMiAwIDAgMCAxMi4wNTYgMGgtLjExMnpNMTcuMTIgOC4xMjFsLTEuOTYgOS4yMTdjLS4xNDUuNjU4LS41MzcuODE4LTEuMDkyLjUwOWwtMy4wMTUtMi4yMjItMS40NTYgMS40Yy0uMTYuMTU4LS4yOTIuMjktLjU5OS4yOWwtLjIxNy0zLjA0OCA1LjYxLTUuMDcyYy4yNDQtLjIxMy0uMDU0LS4zMzMtLjM3My0uMTIxbC02LjkzNSA0LjM2OC0yLjk4OC0uOTMzYy0uNjQ5LS4yMDMtLjY2Mi0uNjQ5LjEzNi0uOTYybDExLjY5LTQuNTAyYy41NC0uMTk2IDEuMDE1LjEzLjgzOC45NjJ6Ii8+PC9zdmc+" alt="Telegram" width="24" height="24" style="display: block; opacity: 0.7;" /></a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" class="ftr-text" style="color: #4b5563; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding-bottom: 12px;">
                    &copy; ${year} Dynotech Innovations, LDA. All rights reserved.
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/privacy" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Privacy</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/terms" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Terms</a></td>
                        <td class="ftr-text" style="color: #4b5563; font-size: 11px;">|</td>
                        <td style="padding: 0 10px;"><a class="ftr-link" href="https://dynopay.com/support" style="color: #6b7280; text-decoration: none; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Support</a></td>
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
export const infoBox = (content: string, borderColor: string = '#4F46E5'): string => {
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
  return `<table role="presentation" class="success-box" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border-left: 3px solid #22c55e; margin: 20px 0;">
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
  const valueFallbackColor = variant === 'green' ? '#3f6212' : '#0a0a0a';
  return `<table role="presentation" class="stat-card" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${variant === 'green' ? '#f7fee7' : '#fafaf9'}; border: 1px solid ${variant === 'green' ? '#d9f99d' : '#e7e5e4'}; border-radius: 12px;">
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
