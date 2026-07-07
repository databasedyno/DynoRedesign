import React, { memo, useCallback, useState } from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { ArrowForward, PlayArrow } from '@mui/icons-material';
import { useRouter } from 'next/router';
import useCountry from '@/hooks/useCountry';
import DemoVideoModal from '@/Components/Modals/DemoVideoModal';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// Staggered entrance for the hero — a calm fade + rise, cascading top-to-bottom.
const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * HeroClean — a Stripe/Linear-style minimal hero that replaces HeroV2 on the
 * landing page (2026-07-05).
 *
 * What we DROPPED from HeroV2 to make it feel calmer:
 *   • Audience switcher pills (For merchants / For developers)
 *   • Right-hand tabbed product preview (Checkout iframe / Dashboard / API)
 *   • Mesh-gradient / drifting radial background
 *   • Blue→purple gradient text on the second h1 line
 *   • Trust-badges row ("🔒 Non-custodial · ⚡ Under 2-minute payouts")
 *   • Star-rating pill above the h1
 *
 * What we KEPT (still useful):
 *   • Country-personalized trust line via useCountry() ("Trusted in X")
 *   • "Watch 90s demo" video modal (secondary CTA)
 *   • Primary → /auth/register CTA
 *
 * The hero is roughly single-column and centered — same as most B2B SaaS
 * landings that read as "clean" (Stripe, Linear, Mercury, Ramp).
 */

const HeroClean: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { country } = useCountry();
  const { t } = useTranslation('landing');
  const [videoOpen, setVideoOpen] = useState(false);

  const goPrimary = useCallback(() => {
    router.push('/auth/register?ref=hero_clean');
  }, [router]);

  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  // Country flag from IP geo — falls back gracefully if lookup is still in-flight.
  const trustLine =
    country?.country && country?.flag
      ? `${country.flag} ${t('heroTrustCountry', { country: country.country })}`
      : t('heroTrustGeneric');

  return (
    <Box
      component={motion.section}
      id="hero"
      aria-labelledby="hero-heading"
      initial="hidden"
      animate="show"
      variants={heroContainer}
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 3, md: 4 },
        pt: { xs: 8, md: 14 },
        pb: { xs: 6, md: 10 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Small uppercase eyebrow — subtle, replaces the "For merchants" tab pills */}
      <Typography
        component="p"
        sx={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '1.6px',
          textTransform: 'uppercase',
          color: theme.palette.text.secondary,
          mb: 2,
        }}
      >
        {t('heroCleanEyebrow')}
      </Typography>

      {/* H1 — single color, no gradient. Two short lines instead of one long one. */}
      <Typography
        id="hero-heading"
        component={motion.h1}
        variants={heroItem}
        sx={{
          fontFamily: "'Unbounded', 'OutfitMedium', system-ui, sans-serif",
          fontWeight: 600,
          color: theme.palette.text.primary,
          fontSize: { xs: 38, sm: 50, md: 66 },
          lineHeight: 1.06,
          letterSpacing: '-0.03em',
          maxWidth: 860,
          mb: { xs: 2.5, md: 3 },
        }}
      >
        {t('heroCleanTitle')}
      </Typography>

      {/* Subtitle — plain body text, muted color, generous max-width */}
      <Typography
        component={motion.p}
        variants={heroItem}
        sx={{
          fontFamily: 'OutfitRegular',
          fontSize: { xs: 16, md: 19 },
          lineHeight: 1.55,
          color: theme.palette.text.secondary,
          maxWidth: 620,
          mb: { xs: 4, md: 5 },
        }}
      >
        {t('heroCleanSubtitle')}
      </Typography>

      {/* CTAs — one solid, one text-link (no outlined box for calmer feel). */}
      <Box
        component={motion.div}
        variants={heroItem}
        sx={{
          display: 'flex',
          gap: { xs: 1.5, md: 2.5 },
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          mb: { xs: 3.5, md: 4 },
        }}
      >
        <Button
          onClick={goPrimary}
          variant="contained"
          endIcon={<ArrowForward />}
          sx={{
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            textTransform: 'none',
            fontFamily: 'OutfitMedium',
            fontWeight: 600,
            fontSize: { xs: 15, md: 16 },
            px: { xs: 3, md: 3.5 },
            py: { xs: 1.4, md: 1.6 },
            borderRadius: 2,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: (theme.palette.primary as any).hover || theme.palette.primary.dark,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 0 30px rgba(204,255,0,0.4)'
                  : 'none',
            },
          }}
        >
          {t('startAcceptingCrypto')}
        </Button>
        <Button
          onClick={openVideo}
          variant="text"
          startIcon={<PlayArrow />}
          sx={{
            color: theme.palette.text.primary,
            textTransform: 'none',
            fontFamily: 'OutfitMedium',
            fontWeight: 500,
            fontSize: { xs: 15, md: 16 },
            px: 1.5,
            py: 1,
          }}
        >
          {t('heroWatchDemo')}
        </Button>
      </Box>

      {/* Single subtle trust line, country-personalized. Replaces the row of pill trust badges. */}
      <Typography
        component={motion.p}
        variants={heroItem}
        sx={{
          fontSize: 14,
          color: theme.palette.text.secondary,
          fontFamily: 'OutfitRegular',
          opacity: 0.85,
        }}
      >
        {trustLine}
      </Typography>

      <DemoVideoModal open={videoOpen} onClose={closeVideo} />
    </Box>
  );
};

export default memo(HeroClean);
