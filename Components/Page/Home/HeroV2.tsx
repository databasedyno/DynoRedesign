import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, useTheme, IconButton, Tooltip } from '@mui/material';
import { ArrowForward, PlayArrow, ContentCopy, Check, Star } from '@mui/icons-material';
import { useRouter } from 'next/router';
import useCountry from '@/hooks/useCountry';
import useIsMobile from '@/hooks/useIsMobile';
import DemoVideoModal from '@/Components/Modals/DemoVideoModal';

/**
 * HeroV2 (items A + J + M combined) — the new landing hero.
 *
 *   A = product-in-hero:  right column has a tabbed live surface
 *                         (Checkout iframe / Dashboard mock / API code).
 *   J = audience switch:  "For merchants" | "For developers" tabs above H1
 *                         swap the headline, subtext, and primary CTA.
 *   M = mesh background:  layered radial gradients with a slow drift for
 *                         a modern Linear/Cursor/Vercel feel.
 *
 * Also injects the country flag from useCountry() (item K) into the trust
 * line so visitors from Brazil see "Trusted in Brazil — accept crypto…".
 *
 * Section id="hero" so the sticky nav scroll-spy can highlight it.
 */

type Audience = 'merchants' | 'developers';
type ProductTab = 'checkout' | 'dashboard' | 'api';

const CURL = `curl -X POST "https://dynopay.com/api/pay/payment-links" \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 49.99,
    "currency": "USD"
  }'`;

const HeroV2: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useIsMobile('md');
  const router = useRouter();
  const { country } = useCountry();

  const [audience, setAudience] = useState<Audience>('merchants');
  const [tab, setTab] = useState<ProductTab>('checkout');
  const [autoRotate, setAutoRotate] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-cycle product tabs every ~5s until the user interacts.
  useEffect(() => {
    if (!autoRotate) return;
    const id = setInterval(() => {
      setTab((t) => (t === 'checkout' ? 'dashboard' : t === 'dashboard' ? 'api' : 'checkout'));
    }, 5000);
    return () => clearInterval(id);
  }, [autoRotate]);

  const pickTab = useCallback((next: ProductTab) => {
    setTab(next);
    setAutoRotate(false);
  }, []);

  const copyCurl = useCallback(async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(CURL);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, []);

  const content = useMemo(() => {
    if (audience === 'developers') {
      return {
        badge: 'For developers',
        h1: 'Payment API for crypto.',
        highlight: 'One integration, 13 chains.',
        sub: 'Ship a checkout in an afternoon. Idempotent REST, webhooks, sandbox, TypeScript SDK. Zero on-chain plumbing.',
        primaryLabel: 'Get sandbox key',
        primaryHref: '/auth/register?ref=hero_dev',
        secondaryLabel: 'Read the docs',
        secondaryHref: '/documentation',
      };
    }
    return {
      badge: 'For merchants',
      h1: 'Accept crypto.',
      highlight: 'Straight to your wallet, or auto-converted to stablecoins.',
      sub: 'Accept 13 chains from customers in 40+ countries. Every payment is forwarded instantly to your own saved wallet — as the original coin, or auto-converted to USDT/USDC if you opt in. Fees from 0.5% — no chargebacks, ever.',
      primaryLabel: 'Start accepting crypto',
      primaryHref: '/auth/register?ref=hero_merchant',
      secondaryLabel: 'Watch 90s demo',
      secondaryHref: '',
    };
  }, [audience]);

  return (
    <Box
      id="hero"
      component="section"
      aria-label="Hero"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 4, md: 6 },
        pb: { xs: 4, md: 8 },
        px: { xs: 2, md: 4 },
      }}
    >
      {/* === M: Animated mesh gradient background === */}
      <MeshGradient isDark={isDark} />

      <Box
        sx={{
          maxWidth: 1240,
          mx: 'auto',
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: { xs: 4, md: 6 },
          alignItems: 'center',
        }}
      >
        {/* ============ LEFT: copy + CTA ============ */}
        <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
          {/* Audience switcher (J) */}
          <Box
            role="tablist"
            aria-label="Choose your audience"
            sx={{
              display: 'inline-flex',
              p: 0.4,
              mb: 2.5,
              borderRadius: '999px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {(['merchants', 'developers'] as Audience[]).map((a) => {
              const active = audience === a;
              return (
                <Box
                  key={a}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAudience(a)}
                  sx={{
                    px: { xs: 1.6, md: 2.2 },
                    py: 0.6,
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontFamily: 'UrbanistBold',
                    fontSize: { xs: 12.5, md: 13 },
                    letterSpacing: '0.4px',
                    color: active ? '#fff' : theme.palette.text.secondary,
                    background: active ? 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)' : 'transparent',
                    transition: 'all 0.25s ease',
                  }}
                >
                  For {a === 'merchants' ? 'merchants' : 'developers'}
                </Box>
              );
            })}
          </Box>

          {/* Trust line — uses geolocated country (K) */}
          <Typography
            sx={{
              fontFamily: 'UrbanistSemiBold',
              fontSize: 12,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              color: theme.palette.primary.main,
              mb: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              justifyContent: { xs: 'center', md: 'flex-start' },
              width: '100%',
            }}
            component="span"
          >
            {country ? (
              <>
                <Box component="span" sx={{ fontSize: 15 }}>{country.flag}</Box>
                Trusted in {country.country} — {content.badge.toLowerCase()}
              </>
            ) : (
              <>🌐 Global crypto payments — {content.badge.toLowerCase()}</>
            )}
          </Typography>

          {/* H1 with highlight */}
          <Typography
            component="h1"
            sx={{
              fontFamily: 'OutfitBold',
              fontSize: { xs: 36, sm: 44, md: 54, lg: 60 },
              lineHeight: 1.05,
              letterSpacing: '-1px',
              color: theme.palette.text.primary,
              mb: 2,
            }}
          >
            {content.h1}{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #6C7BFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline',
              }}
            >
              {content.highlight}
            </Box>
          </Typography>

          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: { xs: 15.5, md: 17 },
              color: theme.palette.text.secondary,
              lineHeight: 1.55,
              mb: 3,
              maxWidth: 520,
              mx: { xs: 'auto', md: 0 },
            }}
          >
            {content.sub}
          </Typography>

          {/* CTAs */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', md: 'flex-start' },
            }}
          >
            <Button
              variant="contained"
              endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
              onClick={() => router.push(content.primaryHref)}
              sx={{
                fontFamily: 'UrbanistBold',
                textTransform: 'none',
                fontSize: 15,
                px: 3,
                py: 1.2,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)',
                boxShadow: '0 10px 28px rgba(0,4,255,0.28)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4F46E5 0%, #4D50FF 100%)',
                  boxShadow: '0 12px 32px rgba(0,4,255,0.35)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {content.primaryLabel}
            </Button>
            <Button
              variant="outlined"
              startIcon={audience === 'merchants' ? <PlayArrow sx={{ fontSize: 18 }} /> : undefined}
              onClick={() => {
                if (audience === 'merchants') setVideoOpen(true);
                else router.push(content.secondaryHref);
              }}
              sx={{
                fontFamily: 'UrbanistSemiBold',
                textTransform: 'none',
                fontSize: 15,
                px: 3,
                py: 1.2,
                borderRadius: '12px',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: isDark ? 'rgba(108,123,255,0.06)' : 'rgba(0,4,255,0.04)',
                },
              }}
            >
              {content.secondaryLabel}
            </Button>
          </Box>

          {/* Micro-trust row */}
          <Box
            sx={{
              mt: 3,
              display: 'flex',
              gap: 2.5,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', md: 'flex-start' },
            }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} sx={{ fontSize: 15, color: '#F59E0B' }} />
              ))}
              <Typography component="span" sx={{ ml: 0.5, fontFamily: 'UrbanistSemiBold', fontSize: 12.5, color: theme.palette.text.secondary }}>
                4.9 from 200+ merchants
              </Typography>
            </Box>
            <Typography component="span" sx={{ fontFamily: 'UrbanistMedium', fontSize: 12.5, color: theme.palette.text.secondary }}>
              🔒 Non-custodial settlement
            </Typography>
            <Typography component="span" sx={{ fontFamily: 'UrbanistMedium', fontSize: 12.5, color: theme.palette.text.secondary }}>
              ⚡ Under 2-minute payouts
            </Typography>
          </Box>
        </Box>

        {/* ============ RIGHT: product tabs (A) ============ */}
        <Box sx={{ position: 'relative' }}>
          {/* Tab row */}
          <Box sx={{ display: 'flex', gap: 0.6, mb: 1.5, justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap' }}>
            {([
              { id: 'checkout',  label: 'Checkout' },
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'api',       label: 'API' },
            ] as { id: ProductTab; label: string }[]).map((t) => {
              const active = tab === t.id;
              return (
                <Box
                  key={t.id}
                  onClick={() => pickTab(t.id)}
                  sx={{
                    px: 1.6,
                    py: 0.6,
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontFamily: 'UrbanistSemiBold',
                    fontSize: 12.5,
                    color: active ? '#fff' : theme.palette.text.secondary,
                    background: active
                      ? 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)'
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    transition: 'all 0.25s ease',
                    userSelect: 'none',
                  }}
                >
                  {t.label}
                </Box>
              );
            })}
            {autoRotate && (
              <Box
                aria-hidden
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  ml: 0.4,
                  px: 1,
                  py: 0.5,
                  borderRadius: '999px',
                  bgcolor: isDark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.08)',
                }}
              >
                <Box
                  sx={{
                    width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E',
                    animation: 'dyno-hero-live 1.6s infinite',
                    '@keyframes dyno-hero-live': { '0%': { opacity: 1 }, '50%': { opacity: 0.35 }, '100%': { opacity: 1 } },
                  }}
                />
                <Typography component="span" sx={{ fontFamily: 'UrbanistBold', fontSize: 10.5, color: '#16A34A' }}>
                  LIVE
                </Typography>
              </Box>
            )}
          </Box>

          {/* Surface */}
          <Box
            sx={{
              position: 'relative',
              borderRadius: '20px',
              overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(11,13,26,0.7)' : 'rgba(255,255,255,0.75)',
              boxShadow: isDark
                ? '0 30px 60px rgba(0,0,0,0.45)'
                : '0 24px 60px rgba(0,4,255,0.12)',
              minHeight: { xs: 420, md: 500 },
              transition: 'all 0.5s ease',
            }}
          >
            {tab === 'checkout' && (
              <Box
                component="iframe"
                src="/pay/demo?embed=1"
                title="DynoPay checkout demo"
                loading="eager"
                sx={{
                  display: 'block',
                  width: '100%',
                  height: { xs: 500, md: 560 },
                  border: 'none',
                }}
              />
            )}
            {tab === 'dashboard' && <DashboardMock isDark={isDark} />}
            {tab === 'api' && (
              <ApiSnippet isDark={isDark} copied={copied} onCopy={copyCurl} />
            )}
          </Box>
        </Box>
      </Box>

      <DemoVideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </Box>
  );
};

/* ============================================================
 * Sub-components
 * ============================================================ */

const MeshGradient: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        '&::before, &::after': { content: '""', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)' },
        '&::before': {
          width: 640, height: 640, top: -160, left: -120,
          background: isDark
            ? 'radial-gradient(circle, rgba(0,4,255,0.30) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(0,4,255,0.15) 0%, transparent 65%)',
          animation: 'dyno-mesh-1 22s ease-in-out infinite',
        },
        '&::after': {
          width: 560, height: 560, bottom: -160, right: -140,
          background: isDark
            ? 'radial-gradient(circle, rgba(108,123,255,0.22) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 65%)',
          animation: 'dyno-mesh-2 26s ease-in-out infinite',
        },
        '@keyframes dyno-mesh-1': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%':      { transform: 'translate(60px, 40px) scale(1.08)' },
        },
        '@keyframes dyno-mesh-2': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%':      { transform: 'translate(-40px,-30px) scale(1.06)' },
        },
      }}
    />
  );
};

const DashboardMock: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const bars = [30, 55, 42, 68, 82, 76, 92];
  return (
    <Box sx={{ p: { xs: 2.4, md: 3 } }}>
      {/* Top row — fake nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4F46E5' }} />
        <Typography sx={{ fontFamily: 'UrbanistBold', fontSize: 14, color: (t) => t.palette.text.primary }}>
          Dashboard
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{
          px: 1, py: 0.3, borderRadius: '999px',
          fontFamily: 'UrbanistSemiBold', fontSize: 10,
          bgcolor: 'rgba(34,197,94,0.12)', color: '#16A34A',
        }}>Live</Box>
      </Box>

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
        {[
          { label: 'Volume (7d)', value: '$47,320', delta: '+18.2%', color: '#4F46E5' },
          { label: 'Payments',    value: '1,247',   delta: '+9.1%',  color: '#7C3AED' },
          { label: 'Avg. settle', value: '48s',     delta: '-6s',    color: '#10B981' },
        ].map((k) => (
          <Box
            key={k.label}
            sx={{
              p: { xs: 1.4, md: 1.8 },
              borderRadius: '12px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)',
            }}
          >
            <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 11, color: (t) => t.palette.text.disabled }}>
              {k.label}
            </Typography>
            <Typography sx={{ fontFamily: 'OutfitBold', fontSize: 20, color: (t) => t.palette.text.primary, mt: 0.2 }}>
              {k.value}
            </Typography>
            <Typography sx={{ fontFamily: 'UrbanistSemiBold', fontSize: 11, color: k.color }}>
              {k.delta}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Bar chart */}
      <Typography sx={{ fontFamily: 'UrbanistSemiBold', fontSize: 12, color: (t) => t.palette.text.secondary, mb: 1 }}>
        Volume, last 7 days
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 100, mb: 2.2 }}>
        {bars.map((h, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${h}%`,
              borderRadius: '6px 6px 3px 3px',
              background: 'linear-gradient(180deg, #6C7BFF 0%, #4F46E5 100%)',
              animation: `dyno-bar-in 0.6s ${i * 0.08}s ease-out both`,
              '@keyframes dyno-bar-in': {
                '0%':   { transform: 'scaleY(0)', transformOrigin: 'bottom' },
                '100%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
              },
            }}
          />
        ))}
      </Box>

      {/* Recent tx list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {[
          { flag: '🇧🇷', amount: '84 USDT',  chain: 'TRC20', ago: '2m' },
          { flag: '🇩🇪', amount: '250 USDC', chain: 'ERC20', ago: '6m' },
          { flag: '🇳🇬', amount: '12.5 USDT',chain: 'TRC20', ago: '11m' },
        ].map((r, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.2, py: 0.8, borderRadius: '10px',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <Typography component="span" sx={{ fontSize: 15 }}>{r.flag}</Typography>
            <Typography component="span" sx={{ fontFamily: 'UrbanistSemiBold', fontSize: 12.5, color: (t) => t.palette.text.primary, flex: 1 }}>
              Received {r.amount}
            </Typography>
            <Typography component="span" sx={{ fontFamily: 'UrbanistMedium', fontSize: 11.5, color: (t) => t.palette.text.disabled }}>
              {r.chain} · {r.ago}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ApiSnippet: React.FC<{ isDark: boolean; copied: boolean; onCopy: () => void }> = ({ isDark, copied, onCopy }) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0D17' }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1.2,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
        ))}
        <Typography component="span" sx={{ ml: 1, fontFamily: 'UrbanistMedium', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          POST /api/pay/payment-links
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={onCopy} sx={{ color: '#fff' }}>
            {copied ? <Check sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2.2,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          color: '#E6E9F2',
          lineHeight: 1.55,
          overflow: 'auto',
          whiteSpace: 'pre',
          flex: 1,
        }}
      >
        {CURL}
      </Box>
      <Box
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          px: 2, py: 1.2,
          bgcolor: '#0A0C1A',
          display: 'flex', alignItems: 'center', gap: 1,
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E' }} />
        <Typography component="span" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#B7E4C7' }}>
          200 OK · id: plink_a1b2c3… · status: awaiting_payment
        </Typography>
      </Box>
    </Box>
  );
};

export default memo(HeroV2);
