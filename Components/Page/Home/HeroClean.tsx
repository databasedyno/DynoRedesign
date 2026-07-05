import React, { memo, useCallback, useState } from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { ArrowForward, PlayArrow } from '@mui/icons-material';
import { useRouter } from 'next/router';
import useCountry from '@/hooks/useCountry';
import DemoVideoModal from '@/Components/Modals/DemoVideoModal';

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
  const [videoOpen, setVideoOpen] = useState(false);

  const goPrimary = useCallback(() => {
    router.push('/auth/register?ref=hero_clean');
  }, [router]);

  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  // Country flag from IP geo — falls back gracefully if lookup is still in-flight.
  const trustLine =
    country?.country && country?.flag
      ? `${country.flag} Trusted by merchants in ${country.country} and 40+ countries`
      : 'Trusted by merchants in 40+ countries';

  return (
    <Box
      component="section"
      id="hero"
      aria-labelledby="hero-heading"
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
        Crypto payments infrastructure
      </Typography>

      {/* H1 — single color, no gradient. Two short lines instead of one long one. */}
      <Typography
        id="hero-heading"
        component="h1"
        sx={{
          fontFamily: 'OutfitMedium',
          fontWeight: 500,
          color: theme.palette.text.primary,
          fontSize: { xs: 40, sm: 52, md: 68 },
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          maxWidth: 820,
          mb: { xs: 2.5, md: 3 },
        }}
      >
        Accept crypto. Get paid in stablecoins.
      </Typography>

      {/* Subtitle — plain body text, muted color, generous max-width */}
      <Typography
        component="p"
        sx={{
          fontFamily: 'OutfitRegular',
          fontSize: { xs: 16, md: 19 },
          lineHeight: 1.55,
          color: theme.palette.text.secondary,
          maxWidth: 620,
          mb: { xs: 4, md: 5 },
        }}
      >
        Accept 13 chains from customers in 40+ countries and settle in USDT/USDC in
        minutes. Non-custodial. 0.5% flat — no chargebacks.
      </Typography>

      {/* CTAs — one solid, one text-link (no outlined box for calmer feel). */}
      <Box
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
            color: '#fff',
            textTransform: 'none',
            fontFamily: 'OutfitMedium',
            fontWeight: 600,
            fontSize: { xs: 15, md: 16 },
            px: { xs: 3, md: 3.5 },
            py: { xs: 1.4, md: 1.6 },
            borderRadius: 2,
            boxShadow: 'none',
            '&:hover': { bgcolor: theme.palette.primary.dark, boxShadow: 'none' },
          }}
        >
          Start accepting crypto
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
          Watch 90s demo
        </Button>
      </Box>

      {/* Single subtle trust line, country-personalized. Replaces the row of pill trust badges. */}
      <Typography
        component="p"
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
