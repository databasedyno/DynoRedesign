import React, { memo, useState } from 'react';
import { Box, Typography, useTheme, IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, FormatQuote, Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * TestimonialsV2 (item H) — richer testimonial cards with initials-avatar,
 * full name, role + company, quote, star row, and a subtle chain badge for
 * flavor. Because we don't have real customer photos yet, avatars are
 * initial-only in a colored circle (Notion / Linear / Cash App do this too).
 *
 * All quotes are marked as "customer" attribution but are placeholder-safe.
 * Swap in real quotes/logos by editing the QUOTES array — no schema change.
 */

interface Testimonial {
  name: string;
  role: string;
  company: string;
  industry: string;
  quoteKey: string;
  color: string;
  chain: string;
}

const QUOTES: Testimonial[] = [
  {
    name: 'Amelia Rodrigues',
    role: 'Founder',
    company: 'Bloomvue Studio',
    industry: 'E-commerce · Portugal',
    color: '#5865F2',
    chain: 'USDT-TRC20',
    quoteKey: 'testimonial1Quote',
  },
  {
    name: 'David Kimani',
    role: 'CTO',
    company: 'Payflex',
    industry: 'SaaS · Kenya',
    color: '#7C3AED',
    chain: 'USDT-ERC20',
    quoteKey: 'testimonial2Quote',
  },
  {
    name: 'Sofia Chen',
    role: 'Ops Lead',
    company: 'North Gate Marketplace',
    industry: 'Marketplace · Singapore',
    color: '#10B981',
    chain: 'USDC-Polygon',
    quoteKey: 'testimonial3Quote',
  },
];

const initials = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

const Card: React.FC<{ t: Testimonial; isDark: boolean; tr: (key: string) => string }> = ({ t, isDark, tr }) => {
  return (
    <Box
      sx={{
        position: 'relative',
        p: { xs: 3, md: 3.5 },
        borderRadius: '16px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
        boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.35)' : '0 6px 20px rgba(10,10,10,0.06)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.2,
      }}
    >
      <FormatQuote
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          fontSize: 40,
          color: t.color,
          opacity: 0.12,
          transform: 'scaleX(-1)',
        }}
      />
      <Box sx={{ display: 'flex', gap: 0.4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} sx={{ fontSize: 16, color: '#F59E0B' }} />
        ))}
      </Box>
      <Typography
        sx={{
          fontFamily: 'UrbanistMedium',
          fontSize: { xs: 14.5, md: 15 },
          lineHeight: 1.55,
          color: (theme) => theme.palette.text.primary,
          flex: 1,
        }}
      >
        {"\u201C"}{tr(t.quoteKey)}{"\u201D"}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'UrbanistBold',
            fontSize: 15,
            background: `linear-gradient(135deg, ${t.color}, ${t.color}CC)`,
            boxShadow: `0 6px 16px ${t.color}33`,
            flexShrink: 0,
          }}
        >
          {initials(t.name)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'UrbanistBold',
              fontSize: 14,
              color: (theme) => theme.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            {t.name}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: 12.5,
              color: (theme) => theme.palette.text.secondary,
              lineHeight: 1.3,
            }}
          >
            {t.role} · {t.company}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: 11,
              color: (theme) => theme.palette.text.disabled,
              lineHeight: 1.2,
              mt: 0.2,
            }}
          >
            {t.industry}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: '999px',
            border: `1px solid ${t.color}55`,
            fontFamily: 'UrbanistBold',
            fontSize: 10.5,
            color: t.color,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {t.chain}
        </Box>
      </Box>
    </Box>
  );
};

const TestimonialsV2: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('landing');
  const [active, setActive] = useState(0);

  const prev = () => setActive((a) => (a - 1 + QUOTES.length) % QUOTES.length);
  const next = () => setActive((a) => (a + 1) % QUOTES.length);

  return (
    <Box
      component="section"
      aria-label="Customer testimonials"
      sx={{
        py: { xs: 6, md: 10 },
        px: { xs: 2, md: 4 },
        maxWidth: 1200,
        mx: 'auto',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography
          sx={{
            fontFamily: 'UrbanistBold',
            fontSize: 12,
            letterSpacing: '1.5px',
            color: theme.palette.primary.main,
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          {t('testimonialsEyebrow')}
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: "'Unbounded', 'OutfitBold', system-ui, sans-serif",
            fontSize: { xs: 26, sm: 32, md: 38 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            letterSpacing: '-0.02em',
          }}
        >
          {t('testimonialsHeading')}
        </Typography>
      </Box>

      {/* Desktop: 3-up grid. Mobile: single carousel. */}
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        {QUOTES.map((q) => (
          <Card key={q.name} t={q} isDark={isDark} tr={t} />
        ))}
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Card t={QUOTES[active]} isDark={isDark} tr={t} />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 2 }}>
          <IconButton onClick={prev} aria-label="Previous testimonial">
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
          {QUOTES.map((_, i) => (
            <Box
              key={i}
              onClick={() => setActive(i)}
              sx={{
                width: i === active ? 22 : 8,
                height: 6,
                borderRadius: 999,
                bgcolor: i === active ? theme.palette.primary.main : theme.palette.text.disabled,
                opacity: i === active ? 1 : 0.4,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
          <IconButton onClick={next} aria-label="Next testimonial">
            <ArrowForward sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TestimonialsV2);
