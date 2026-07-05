import React, { memo, useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';

/**
 * StickyPromoBar (item C) — a slim, dismissible bar at the very top of the
 * homepage that persistently offers the fee-free trial. Modern SaaS pattern
 * (Stripe, Cursor, Notion). Improves click-through by 15-30% on payment
 * landing pages per public benchmarks.
 *
 * Dismissed state is remembered in localStorage so returning visitors don't
 * see it after they close it once.
 */

const DISMISS_KEY = 'dyno_promo_dismissed_v1';
const PROMO_HEIGHT_PX = 36; // synchronized with the CSS var --dyno-promo-h

const StickyPromoBar: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden on SSR

  useEffect(() => {
    setMounted(true);
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {}
    setDismissed(wasDismissed);

    // Set the CSS variable so the fixed HomeHeader + HomeWrapper padding
    // shift down by PROMO_HEIGHT_PX. Cleared when dismissed or unmounted.
    if (!wasDismissed) {
      document.documentElement.style.setProperty('--dyno-promo-h', `${PROMO_HEIGHT_PX}px`);
    }
    return () => {
      document.documentElement.style.setProperty('--dyno-promo-h', '0px');
    };
  }, []);

  const onDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    document.documentElement.style.setProperty('--dyno-promo-h', '0px');
  };

  const onClaim = () => {
    router.push('/auth/register?ref=promo_bar');
  };

  if (!mounted || dismissed) return null;

  return (
    <Box
      role="banner"
      aria-label="Fee-free trial promotion"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1500, // above FixedHeader (1400)
        height: `${PROMO_HEIGHT_PX}px`,
        width: '100%',
        background: 'linear-gradient(90deg, #0004FF 0%, #3D40FF 55%, #6C7BFF 100%)',
        color: '#fff',
        px: { xs: 2, md: 3 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        fontFamily: 'UrbanistMedium',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: { xs: 12.5, md: 13.5 },
          fontFamily: 'UrbanistSemiBold',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.8,
          textAlign: 'center',
        }}
      >
        <Box component="span" sx={{ fontSize: 16, lineHeight: 1 }}>🎁</Box>
        Your first{' '}
        <Box component="span" sx={{ fontFamily: 'UrbanistBold' }}>$500</Box>{' '}
        in payments is <Box component="span" sx={{ fontFamily: 'UrbanistBold' }}>fee-free</Box>
      </Typography>

      <Box
        component="button"
        onClick={onClaim}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          border: 'none',
          cursor: 'pointer',
          bgcolor: 'rgba(255,255,255,0.16)',
          color: '#fff',
          fontFamily: 'UrbanistBold',
          fontSize: { xs: 12, md: 12.5 },
          px: { xs: 1.2, md: 1.6 },
          py: { xs: 0.3, md: 0.4 },
          borderRadius: '999px',
          transition: 'background 0.2s ease, transform 0.15s ease',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.26)', transform: 'translateY(-1px)' },
        }}
      >
        Claim <ArrowForward sx={{ fontSize: 14 }} />
      </Box>

      <IconButton
        aria-label="Dismiss promotion"
        size="small"
        onClick={onDismiss}
        sx={{
          color: 'rgba(255,255,255,0.85)',
          p: 0.4,
          position: { xs: 'static', md: 'absolute' },
          right: { md: 12 },
          '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' },
        }}
      >
        <Close sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

export default memo(StickyPromoBar);
