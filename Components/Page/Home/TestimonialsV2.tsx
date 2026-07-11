import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SwissSectionHead from './SwissSectionHead';
import { FONT_BODY, FONT_HERO, FONT_TECH, SwissTokens, useSwiss } from './swiss';

/**
 * TestimonialsV2 — metric-led editorial proof (Swiss redesign, 2026-07).
 * No star rows, no stock-photo avatars. Each card leads with a hard outcome
 * number (monospace) tied to the quote, with a monogram attribution.
 */

interface Testimonial {
  name: string;
  role: string;
  company: string;
  industry: string;
  quoteKey: string;
  chain: string;
  metric: string;
  metricLabelKey: string;
}

const QUOTES: Testimonial[] = [
  {
    name: 'Amelia Rodrigues',
    role: 'Founder',
    company: 'Bloomvue Studio',
    industry: 'E-commerce · Portugal',
    chain: 'USDT-TRC20',
    quoteKey: 'testimonial1Quote',
    metric: '0.8%',
    metricLabelKey: 'testimonial1MetricLabel',
  },
  {
    name: 'David Kimani',
    role: 'CTO',
    company: 'Payflex',
    industry: 'SaaS · Kenya',
    chain: 'USDT-ERC20',
    quoteKey: 'testimonial2Quote',
    metric: '0',
    metricLabelKey: 'testimonial2MetricLabel',
  },
  {
    name: 'Sofia Chen',
    role: 'Ops Lead',
    company: 'North Gate Marketplace',
    industry: 'Marketplace · Singapore',
    chain: 'USDC-Polygon',
    quoteKey: 'testimonial3Quote',
    metric: '30',
    metricLabelKey: 'testimonial3MetricLabel',
  },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const Monogram: React.FC<{ name: string; s: SwissTokens; size?: number }> = ({ name, s, size = 40 }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: s.accentSoft,
      color: s.accentText,
      border: `1.5px solid ${s.accent}`,
      fontFamily: FONT_HERO,
      fontWeight: 600,
      fontSize: Math.round(size * 0.34),
      letterSpacing: '0.02em',
    }}
  >
    {initials(name)}
  </Box>
);

const Metric: React.FC<{ value: string; label: string; s: SwissTokens; big?: boolean }> = ({ value, label, s, big }) => (
  <Box>
    <Typography
      sx={{
        fontFamily: FONT_TECH,
        fontWeight: 600,
        fontSize: big ? { xs: 38, md: 52 } : { xs: 30, md: 34 },
        lineHeight: 1,
        letterSpacing: '-0.03em',
        color: s.accentText,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontFamily: FONT_TECH,
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: s.sub,
        mt: 1,
      }}
    >
      {label}
    </Typography>
  </Box>
);

const Attribution: React.FC<{ t: Testimonial; s: SwissTokens; size?: number }> = ({ t, s, size = 40 }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Monogram name={t.name} s={s} size={size} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.txt, lineHeight: 1.25 }}>{t.name}</Typography>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.sub, lineHeight: 1.5 }}>
        {t.role} · {t.company} · {t.industry}
      </Typography>
    </Box>
    <Typography
      component="span"
      sx={{
        fontFamily: FONT_TECH,
        fontSize: 10,
        letterSpacing: '0.08em',
        px: 1,
        py: 0.35,
        borderRadius: '6px',
        border: `1px solid ${s.dark ? 'rgba(204,255,0,0.3)' : 'rgba(90,107,0,0.3)'}`,
        color: s.accentText,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {t.chain}
    </Typography>
  </Box>
);

const cardBase = (s: SwissTokens) => ({
  borderRadius: '16px',
  border: `1px solid ${s.line}`,
  backgroundColor: s.surface,
  p: { xs: 3, md: 3.5 },
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2.5,
  transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease',
  '&:hover': { transform: 'translateY(-3px)', borderColor: s.dark ? 'rgba(204,255,0,0.3)' : 'rgba(10,10,10,0.22)' },
});

const Divider: React.FC<{ s: SwissTokens }> = ({ s }) => (
  <Box sx={{ height: '1px', width: '100%', backgroundColor: s.line }} />
);

const TestimonialsV2: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation('landing');
  const [featured, ...rest] = QUOTES;

  return (
    <Box component="section" aria-label="Customer testimonials" data-testid="testimonials-section" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: 'auto' }}>
      <SwissSectionHead num="04" eyebrow={t('testimonialsEyebrow')} title={t('testimonialsHeading')} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: { xs: 2, md: 2.5 }, alignItems: 'stretch' }}>
        {/* Featured — outcome number leads */}
        <Box data-testid="testimonial-featured" sx={cardBase(s)}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2.5 }}>
            <Metric value={featured.metric} label={t(featured.metricLabelKey)} s={s} big />
            <Divider s={s} />
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 300, fontSize: { xs: 17, md: 21 }, lineHeight: 1.6, letterSpacing: '-0.01em', color: s.txt }}>
              {'\u201C'}{t(featured.quoteKey)}{'\u201D'}
            </Typography>
          </Box>
          <Attribution t={featured} s={s} size={48} />
        </Box>

        {/* Supporting quotes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
          {rest.map((q, i) => (
            <Box key={q.name} data-testid={`testimonial-card-${i + 1}`} sx={{ ...cardBase(s), flex: 1 }}>
              <Metric value={q.metric} label={t(q.metricLabelKey)} s={s} />
              <Divider s={s} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.65, color: s.txt, flex: 1 }}>
                {'\u201C'}{t(q.quoteKey)}{'\u201D'}
              </Typography>
              <Attribution t={q} s={s} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TestimonialsV2);
