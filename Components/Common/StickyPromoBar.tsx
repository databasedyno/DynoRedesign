import React, { memo, useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close, ArrowForward, CardGiftcardRounded } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

/**
 * StickyPromoBar — a slim, dismissible bar at the very top of the marketing
 * homepage that persistently offers the fee-free trial (Stripe/Notion pattern).
 * 2026-06: restyled to the Tatum-inspired light mint bar (dark teal text).
 * Dismissed state is remembered in localStorage.
 */

const DISMISS_KEY = 'dyno_promo_dismissed_v1';
const PROMO_HEIGHT_PX = 36; // synchronized with the CSS var --dyno-promo-h

const StickyPromoBar: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation('common');
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
      aria-label={t("promoBar.aria")}
      data-testid="promo-bar"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1500, // above FixedHeader (1400)
        height: `${PROMO_HEIGHT_PX}px`,
        width: '100%',
        background: 'linear-gradient(90deg, #E6F4EA 0%, #D1FAE5 50%, #E6F4EA 100%)',
        borderBottom: '1px solid rgba(15,118,110,0.16)',
        color: '#0F766E',
        px: { xs: 2, md: 3 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: { xs: 12.5, md: 13.5 },
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          color: '#0A0F1D',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.8,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        <CardGiftcardRounded sx={{ fontSize: 18, color: '#0F766E' }} aria-hidden />
        {/* Shorter copy on mobile so the whole bar fits in one line at 375px iPhone width. */}
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {t("promoBar.desktop")}
        </Box>
        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
          {t("promoBar.mobile")}
        </Box>
      </Typography>

      <Box
        component="button"
        onClick={onClaim}
        data-testid="promo-bar-claim"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          border: 'none',
          cursor: 'pointer',
          bgcolor: '#0F766E',
          color: '#fff',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: { xs: 12, md: 12.5 },
          px: { xs: 1.2, md: 1.6 },
          py: { xs: 0.3, md: 0.4 },
          borderRadius: '999px',
          transition: 'background 0.2s ease, transform 0.15s ease',
          '&:hover': { bgcolor: '#0D5C56', transform: 'translateY(-1px)' },
        }}
      >
        {t("promoBar.claim")} <ArrowForward sx={{ fontSize: 14 }} />
      </Box>

      <IconButton
        aria-label={t("promoBar.dismiss")}
        size="small"
        onClick={onDismiss}
        data-testid="promo-bar-dismiss"
        sx={{
          color: 'rgba(15,118,110,0.7)',
          p: 0.4,
          position: { xs: 'static', md: 'absolute' },
          right: { md: 12 },
          '&:hover': { color: '#0F766E', bgcolor: 'rgba(15,118,110,0.10)' },
        }}
      >
        <Close sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

export default memo(StickyPromoBar);
