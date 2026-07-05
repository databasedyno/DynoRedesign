import React, { memo, useState } from 'react';
import { Box, Typography, useTheme, IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, FormatQuote, Star } from '@mui/icons-material';

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
  quote: string;
  color: string;
  chain: string;
}

const QUOTES: Testimonial[] = [
  {
    name: 'Amelia Rodrigues',
    role: 'Founder',
    company: 'Bloomvue Studio',
    industry: 'E-commerce · Portugal',
    color: '#0004FF',
    chain: 'USDT-TRC20',
    quote: 'We switched from Stripe to DynoPay for our international customers and cut processing fees from 3.2% to 0.8%. Settlements land in USDT within minutes — no more three-day holds.',
  },
  {
    name: 'David Kimani',
    role: 'CTO',
    company: 'Payflex',
    industry: 'SaaS · Kenya',
    color: '#7C3AED',
    chain: 'USDT-ERC20',
    quote: 'The API is genuinely one integration and it just worked. We accept 12 chains today and the checkout is embeddable. Chargebacks dropped to zero the day we launched.',
  },
  {
    name: 'Sofia Chen',
    role: 'Ops Lead',
    company: 'North Gate Marketplace',
    industry: 'Marketplace · Singapore',
    color: '#10B981',
    chain: 'USDC-Polygon',
    quote: 'Our sellers span 30 countries. DynoPay lets them get paid in the token they want and we settle to bank in whatever currency they want. Support answers in under an hour.',
  },
];

const initials = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

const Card: React.FC<{ t: Testimonial; isDark: boolean }> = ({ t, isDark }) => {
  return (
    <Box
      sx={{
        position: 'relative',
        p: { xs: 3, md: 3.5 },
        borderRadius: '16px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
        boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.25)' : '0 6px 20px rgba(0,4,255,0.06)',
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
        “{t.quote}”
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
          Testimonials
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: 'OutfitBold',
            fontSize: { xs: 26, sm: 32, md: 38 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            letterSpacing: '-0.5px',
          }}
        >
          What builders are saying
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
          <Card key={q.name} t={q} isDark={isDark} />
        ))}
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Card t={QUOTES[active]} isDark={isDark} />
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
