/**
 * Email CTA button + small formatting helpers shared by every builder.
 * Kept separate from emailTemplate.ts (R2 500-line budget); re-exported there.
 */
/**
 * Main CTA — the ONLY gold element in an email. SOLID background (Gmail's dark mode
 * cannot recolour gradients) + dark label pinned with -webkit-text-fill-color and the
 * `.btn` dark-mode rule. Left-aligned to match the calm left-aligned body copy.
 */
export const ctaButton = (text: string, link: string, opts?: { padding?: string; bg?: string; color?: string }): string => {
  const padding = opts?.padding || '24px 0 8px 0';
  const bg = opts?.bg || '#FFD100';
  const color = opts?.color || '#0A0A0D';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="left" style="padding: ${padding};">
        <a href="${link}" class="btn" style="display: inline-block; background-color: ${bg}; color: ${color}; -webkit-text-fill-color: ${color}; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
          <!--[if mso]><i style="mso-font-width: 150%; mso-text-raise: 24pt;">&nbsp;</i><![endif]-->
          <span style="mso-text-raise: 12pt; color: ${color}; -webkit-text-fill-color: ${color};">${text}</span>
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
