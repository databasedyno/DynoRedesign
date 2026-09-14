/**
 * Email CTA button + small formatting helpers shared by every builder.
 * Kept separate from emailTemplate.ts (R2 500-line budget); re-exported there.
 */
/**
 * Inversion-proof CTA button. SOLID brand background (never a gradient — Gmail's
 * dark mode cannot recolour gradients, so it lightens the label and leaves the
 * box as-is → unreadable) + white label pinned with -webkit-text-fill-color and
 * the `.btn` dark-mode rule. Use this for ANY button inside an email body.
 */
export const ctaButton = (text: string, link: string, opts?: { padding?: string }): string => {
  const padding = opts?.padding || '24px 0 8px 0';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: ${padding};">
        <a href="${link}" class="btn" style="display: inline-block; background-color: #4338CA; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
          <!--[if mso]><i style="mso-font-width: 150%; mso-text-raise: 26pt;">&nbsp;</i><![endif]-->
          <span style="mso-text-raise: 13pt; color: #FFFFFF; -webkit-text-fill-color: #FFFFFF;">${text}</span>
          <!--[if mso]><i style="mso-font-width: 150%;">&nbsp;</i><![endif]-->
        </a>
      </td></tr></table>`;
};

/** "50.00" / 50 / "12.5" → "50" / "50" / "12.5" — percentages without DECIMAL noise. */
export const formatPercent = (value: number | string): string => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isFinite(n)) return String(value);
  return String(Math.round(n * 100) / 100);
};
