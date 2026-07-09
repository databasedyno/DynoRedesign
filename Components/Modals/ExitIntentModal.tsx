import React, { memo, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Button, useTheme } from '@mui/material';
import { Close, ContentCopy, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

/**
 * ExitIntentModal (item N) — fires when the mouse leaves the top of the
 * window (a strong desktop signal the user is about to leave). Offers the
 * sandbox key + docs link + "$500 fee-free" one-click signup path.
 *
 * Guards:
 *  - Never shown on mobile (no reliable exit-intent signal there).
 *  - Never shown more than once per session (sessionStorage flag).
 *  - Only fires after 4s on page (avoid catching bounce-back-through visitors).
 *  - Dismissed with Esc or the close button.
 */

const SESSION_KEY = 'dyno_exit_intent_shown_v1';
const SANDBOX_KEY = 'dyno_sk_sandbox_demo_9f621db8';

const ExitIntentModal: React.FC = () => {
  const { t } = useTranslation('landing');
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 900) return; // desktop only
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {}

    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 4000);

    const onMouseOut = (e: MouseEvent) => {
      if (!armed) return;
      // Mouse leaving top edge → exit intent
      if (e.clientY <= 0 && !e.relatedTarget) {
        setOpen(true);
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
        window.removeEventListener('mouseout', onMouseOut);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(armTimer);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const copyKey = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(SANDBOX_KEY);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(4, 6, 24, 0.62)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        p: 2,
      }}
      onClick={() => setOpen(false)}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          borderRadius: '20px',
          background: isDark
            ? 'linear-gradient(180deg, #131628 0%, #0B0D1A 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #F4F5FF 100%)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,4,255,0.10)'}`,
          boxShadow: '0 40px 80px rgba(0,4,255,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Accent gradient header */}
        <Box
          sx={{
            height: 6,
            background: 'linear-gradient(90deg, #4F46E5, #6C7BFF, #22D3EE)',
          }}
        />
        <IconButton
          aria-label="Close"
          onClick={() => setOpen(false)}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: theme.palette.text.secondary,
            zIndex: 2,
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ p: { xs: 3, md: 4 }, pt: { xs: 3, md: 4 } }}>
          <Typography
            sx={{
              fontFamily: 'UrbanistBold',
              fontSize: 11,
              letterSpacing: '1.6px',
              color: theme.palette.primary.main,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Wait — one second
          </Typography>
          <Typography
            id="exit-intent-title"
            component="h3"
            sx={{
              fontFamily: 'var(--font-sans)',
              fontSize: { xs: 22, md: 26 },
              lineHeight: 1.18,
              color: theme.palette.text.primary,
              mb: 1.2,
              letterSpacing: '-0.4px',
            }}
          >
            {t('exitIntentTitle')}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: 14,
              color: theme.palette.text.secondary,
              mb: 2.5,
              lineHeight: 1.5,
            }}
          >
            Grab the sandbox key below and hit our API from your terminal. No
            signup. No card. Real response — same JSON shape as production.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.6,
              py: 1.1,
              borderRadius: '10px',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,4,255,0.2)'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,4,255,0.03)',
              mb: 2.5,
            }}
          >
            <Box
              component="code"
              sx={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: theme.palette.text.primary,
                flex: 1,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {SANDBOX_KEY}
            </Box>
            <Button
              onClick={copyKey}
              size="small"
              startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
              sx={{
                fontFamily: 'UrbanistSemiBold',
                fontSize: 12,
                textTransform: 'none',
                color: theme.palette.primary.main,
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              onClick={() => {
                setOpen(false);
                router.push('/auth/register?ref=exit_intent');
              }}
              sx={{
                fontFamily: 'UrbanistBold',
                textTransform: 'none',
                px: 2.2,
                py: 1,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)',
                boxShadow: '0 8px 22px rgba(0,4,255,0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4F46E5 0%, #4D50FF 100%)',
                },
              }}
            >
              Claim $500 fee-free
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setOpen(false);
                router.push('/documentation');
              }}
              sx={{
                fontFamily: 'UrbanistSemiBold',
                textTransform: 'none',
                px: 2.2,
                py: 1,
                borderRadius: '10px',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                color: theme.palette.text.primary,
              }}
            >
              {t('viewApiDocs')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ExitIntentModal);
