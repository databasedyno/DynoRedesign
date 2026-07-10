import React, { memo, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Button, useTheme } from '@mui/material';
import { Close, PlayArrow, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

/**
 * DemoVideoModal (item I) — opens when the visitor clicks "Watch demo" in the
 * hero. We don't have a produced video yet, so this shows a lightweight,
 * auto-advancing 3-step product tour rendered in SVG + text. Same conversion
 * function as a video walkthrough: prospect sees the end-to-end flow in ~30s
 * without leaving the page.
 *
 * When the produced video ships, swap the storyboard for an iframe:
 *   <iframe src={videoUrl} allow="autoplay" .../>
 * Keep the same open/close plumbing.
 */

export interface DemoVideoModalProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  n: number;
  title: string;
  detail: string;
  color: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Create a payment link',
    detail: 'One POST to /api/pay/payment-links — or one click in your dashboard. Set amount, currency, description. That’s it.',
    color: '#4F46E5',
    accent: '#6C7BFF',
  },
  {
    n: 2,
    title: 'Customer picks any chain',
    detail: 'They open the link. Choose USDT-TRC20, USDC-Polygon, BTC — 15+ chains supported. Confirm and pay from their wallet.',
    color: '#7C3AED',
    accent: '#A78BFA',
  },
  {
    n: 3,
    title: 'You settle in stablecoins',
    detail: 'Funds land in your DynoPay wallet in stablecoin. Withdraw to bank, spend, or hold. Fees from 0.5% (drops with volume). No chargebacks, ever.',
    color: '#10B981',
    accent: '#34D399',
  },
];

const DemoVideoModal: React.FC<DemoVideoModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation('landing');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4500);

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    return () => {
      clearInterval(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const s = STEPS[step];

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-video-title"
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(4, 6, 24, 0.7)',
        backdropFilter: 'blur(6px)',
        p: 2,
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          borderRadius: '22px',
          overflow: 'hidden',
          background: isDark ? '#0B0D1A' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,4,255,0.10)'}`,
          boxShadow: '0 40px 80px rgba(0,4,255,0.25)',
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: '#fff',
            bgcolor: 'rgba(0,0,0,0.35)',
            zIndex: 2,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Storyboard "video" area */}
        <Box
          sx={{
            position: 'relative',
            height: { xs: 320, md: 400 },
            background: `linear-gradient(135deg, ${s.color} 0%, ${s.accent} 100%)`,
            transition: 'background 0.6s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Big numeric step badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 20,
              px: 1.4,
              py: 0.4,
              borderRadius: '999px',
              bgcolor: 'rgba(255,255,255,0.18)',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              letterSpacing: '1px',
              backdropFilter: 'blur(4px)',
            }}
          >
            STEP {s.n} / {STEPS.length}
          </Box>

          {/* Animated glyph — changes per step */}
          <Box
            key={step}
            sx={{
              width: { xs: 120, md: 160 },
              height: { xs: 120, md: 160 },
              borderRadius: '32px',
              bgcolor: 'rgba(255,255,255,0.16)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontSize: { xs: 56, md: 72 },
              animation: 'dyno-demo-pop 0.5s ease-out',
              '@keyframes dyno-demo-pop': {
                '0%':   { transform: 'scale(0.6)', opacity: 0 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          >
            {s.n}
          </Box>

          {/* Step title */}
          <Typography
            id="demo-video-title"
            sx={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24,
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontSize: { xs: 22, md: 28 },
              lineHeight: 1.2,
              textShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {s.title}
          </Typography>
        </Box>

        {/* Detail + step dots + CTA */}
        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-sans)',
              fontSize: { xs: 14, md: 15 },
              color: theme.palette.text.primary,
              lineHeight: 1.5,
              mb: 2,
              minHeight: { md: 48 },
            }}
          >
            {s.detail}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              {STEPS.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setStep(i)}
                  sx={{
                    width: i === step ? 26 : 8,
                    height: 6,
                    borderRadius: 999,
                    bgcolor: i === step ? s.color : theme.palette.text.disabled,
                    opacity: i === step ? 1 : 0.35,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </Box>
            <Button
              variant="contained"
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              onClick={() => { onClose(); router.push('/auth/register?ref=demo_video'); }}
              sx={{
                fontFamily: 'var(--font-sans)',
                textTransform: 'none',
                px: 2.2,
                py: 0.9,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)',
              }}
            >
              {t('startFree')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(DemoVideoModal);
