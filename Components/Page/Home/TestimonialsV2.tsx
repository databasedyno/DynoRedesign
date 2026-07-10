import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SwissSectionHead from './SwissSectionHead';
import { FONT_BODY, FONT_HERO, FONT_TECH, SwissTokens, useSwiss } from './swiss';

/**
 * TestimonialsV2 — editorial treatment (Swiss redesign). One commanding
 * featured quote plus two supporting quotes; no carousel.
 */

interface Testimonial {
  name: string;
  role: string;
  company: string;
  industry: string;
  quoteKey: string;
  chain: string;
  avatar: string;
}

const QUOTES: Testimonial[] = [
  {
    name: 'Amelia Rodrigues',
    role: 'Founder',
    company: 'Bloomvue Studio',
    industry: 'E-commerce · Portugal',
    chain: 'USDT-TRC20',
    quoteKey: 'testimonial1Quote',
    avatar: 'https://images.pexels.com/photos/26872232/pexels-photo-26872232.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop',
  },
  {
    name: 'David Kimani',
    role: 'CTO',
    company: 'Payflex',
    industry: 'SaaS · Kenya',
    chain: 'USDT-ERC20',
    quoteKey: 'testimonial2Quote',
    avatar: 'https://images.pexels.com/photos/12931653/pexels-photo-12931653.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop',
  },
  {
    name: 'Sofia Chen',
    role: 'Ops Lead',
    company: 'North Gate Marketplace',
    industry: 'Marketplace · Singapore',
    chain: 'USDC-Polygon',
    quoteKey: 'testimonial3Quote',
    avatar: 'https://images.pexels.com/photos/14589344/pexels-photo-14589344.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop',
  },
];

const Attribution: React.FC<{ t: Testimonial; s: SwissTokens; size?: number }> = ({ t, s, size = 44 }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Box
      component="img"
      src={t.avatar}
      alt={t.name}
      loading="lazy"
      sx={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${s.lineStrong}`, flexShrink: 0 }}
    />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.txt, lineHeight: 1.25 }}>{t.name}</Typography>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.sub, lineHeight: 1.5 }}>
        {t.role} · {t.company} · {t.industry}
      </Typography>
    </Box>
    <Typography component="span" sx={{ fontFamily: FONT_TECH, fontSize: 10, letterSpacing: '0.08em', px: 1, py: 0.35, borderRadius: '6px', border: `1px solid ${s.dark ? 'rgba(204,255,0,0.3)' : 'rgba(90,107,0,0.3)'}`, color: s.accentText, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {t.chain}
    </Typography>
  </Box>
);

const Stars: React.FC<{ s: SwissTokens }> = ({ s }) => (
  <Box sx={{ display: 'flex', gap: 0.4 }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} sx={{ fontSize: 15, color: s.accentText }} />
    ))}
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

const TestimonialsV2: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation('landing');
  const [featured, ...rest] = QUOTES;

  return (
    <Box component="section" aria-label="Customer testimonials" data-testid="testimonials-section" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: 'auto' }}>
      <SwissSectionHead num="04" eyebrow={t('testimonialsEyebrow')} title={t('testimonialsHeading')} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: { xs: 2, md: 2.5 }, alignItems: 'stretch' }}>
        {/* Featured — commanding editorial quote */}
        <Box data-testid="testimonial-featured" sx={cardBase(s)}>
          <Stars s={s} />
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 300, fontSize: { xs: 17, md: 21 }, lineHeight: 1.6, letterSpacing: '-0.01em', color: s.txt, flex: 1 }}>
            {'\u201C'}{t(featured.quoteKey)}{'\u201D'}
          </Typography>
          <Attribution t={featured} s={s} size={52} />
        </Box>

        {/* Supporting quotes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
          {rest.map((q, i) => (
            <Box key={q.name} data-testid={`testimonial-card-${i + 1}`} sx={{ ...cardBase(s), flex: 1 }}>
              <Stars s={s} />
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
