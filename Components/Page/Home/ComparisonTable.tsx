import React, { memo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Check, Close, StarRate } from '@mui/icons-material';

/**
 * ComparisonTable (item L) — head-to-head against the crypto payment
 * competitors Dynopay actually runs into (Coinbase Commerce, BitPay) plus
 * Stripe as the credit-card baseline for merchants who haven't tried crypto.
 *
 * Highlights the Dynopay column with a subtle accent and adds a "Best" badge.
 * Facts here are the generally-known publicly documented positions of each
 * product as of 2026-07. Update if any provider changes their pricing.
 */

type Feature = {
  label: string;
  values: (string | boolean)[]; // one per column: Dynopay, Coinbase Commerce, BitPay, Stripe
};

const COLUMNS = ['Dynopay', 'Coinbase Commerce', 'BitPay', 'Stripe'] as const;

const FEATURES: Feature[] = [
  { label: 'Transaction fee',      values: ['0.5%–1.5% by volume', '1% (after $1M)',   '1% + miner fee',   '2.9% + $0.30']  },
  { label: 'Supported chains',     values: ['15+ chains',           '5 chains',         '8 chains',         'None (fiat only)'] },
  { label: 'Stablecoin settlement',values: [true,                  true,                true,               false] },
  { label: 'Bank-account settlement',values:[true,                 false,               true,               true]  },
  { label: 'Fiat off-ramp built-in',values:[true,                  false,               true,               true]  },
  { label: 'Settlement time',      values: ['< 2 min',             '1–2 days',          '~1 day',           '2 business days'] },
  { label: 'Non-custodial option', values: [true,                  false,               false,              false] },
  { label: 'Chargebacks',          values: ['Impossible',          'Impossible',        'Impossible',       'Frequent'] },
  { label: 'Chargeback fees',      values: ['—',                    '—',                 '—',                '$15 per dispute'] },
  { label: 'KYC required',         values: ['Optional (merchant)', 'Required',          'Required',         'Required'] },
  { label: 'Developer API',        values: ['REST + SDKs + WHs',   'REST + WHs',        'REST + WHs',       'REST + SDKs + WHs'] },
  { label: 'Embeddable checkout',  values: [true,                  true,                true,               true]  },
  { label: 'Recurring billing',    values: [true,                  false,               true,               true]  },
  { label: 'Free tier',            values: ['$500 fee-free trial', false,               false,              false] },
];

const BEST_COL = 0;

const ValueCell: React.FC<{ v: string | boolean; isBest: boolean }> = ({ v, isBest }) => {
  if (typeof v === 'boolean') {
    return v ? (
      <Check sx={{ color: isBest ? '#4F46E5' : '#22C55E', fontSize: 20 }} />
    ) : (
      <Close sx={{ color: '#EF4444', fontSize: 20, opacity: 0.55 }} />
    );
  }
  return (
    <Typography
      sx={{
        fontFamily: isBest ? 'var(--font-sans)' : 'var(--font-sans)',
        fontSize: 13,
        color: (theme) => (isBest ? theme.palette.primary.main : theme.palette.text.primary),
        lineHeight: 1.35,
        textAlign: 'center',
      }}
    >
      {v}
    </Typography>
  );
};

const ComparisonTable: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const highlight = 'linear-gradient(180deg, rgba(0,4,255,0.05), rgba(108,123,255,0.03))';

  return (
    <Box
      component="section"
      aria-label="Comparison to alternatives"
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
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            letterSpacing: '1.5px',
            color: theme.palette.primary.main,
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          Comparison
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: 'var(--font-sans)',
            fontSize: { xs: 26, sm: 32, md: 40 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            letterSpacing: '-0.5px',
            mb: 1.5,
          }}
        >
          How we stack up
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-sans)',
            fontSize: { xs: 14, md: 16 },
            color: theme.palette.text.secondary,
            maxWidth: 620,
            mx: 'auto',
          }}
        >
          Dynopay vs. the crypto-payment options merchants usually consider,
          plus Stripe as the credit-card baseline.
        </Typography>
      </Box>

      <Box
        sx={{
          borderRadius: '18px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          overflow: 'auto',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
        }}
      >
        <Box sx={{ minWidth: 720 }}>
          {/* Grid header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '160px repeat(4, 1fr)', md: '260px repeat(4, 1fr)' },
              alignItems: 'stretch',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ p: { xs: 1.6, md: 2.2 } }} />
            {COLUMNS.map((c, i) => {
              const isBest = i === BEST_COL;
              return (
                <Box
                  key={c}
                  sx={{
                    p: { xs: 1.4, md: 2 },
                    textAlign: 'center',
                    background: isBest ? highlight : 'transparent',
                    position: 'relative',
                    borderLeft: isBest ? `1px solid ${isDark ? 'rgba(108,123,255,0.15)' : 'rgba(0,4,255,0.12)'}` : 'none',
                    borderRight: isBest ? `1px solid ${isDark ? 'rgba(108,123,255,0.15)' : 'rgba(0,4,255,0.12)'}` : 'none',
                  }}
                >
                  {isBest && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -1,
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        px: 1, py: 0.15,
                        borderRadius: '999px',
                        background: 'linear-gradient(135deg, #4F46E5 0%, #3D40FF 100%)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.4,
                        fontFamily: 'var(--font-sans)',
                        fontSize: 10,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <StarRate sx={{ fontSize: 10 }} />
                      Best value
                    </Box>
                  )}
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: { xs: 12, md: 14 },
                      color: isBest ? theme.palette.primary.main : theme.palette.text.primary,
                      letterSpacing: '0.3px',
                      lineHeight: 1.25,
                    }}
                  >
                    {c}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Rows */}
          {FEATURES.map((f, ri) => (
            <Box
              key={f.label}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '160px repeat(4, 1fr)', md: '260px repeat(4, 1fr)' },
                alignItems: 'stretch',
                borderTop: ri === 0 ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                transition: 'background 0.2s ease',
                '&:hover': { background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,4,255,0.02)' },
              }}
            >
              <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: { xs: 12.5, md: 13.5 },
                    color: theme.palette.text.primary,
                    lineHeight: 1.3,
                  }}
                >
                  {f.label}
                </Typography>
              </Box>
              {f.values.map((v, i) => {
                const isBest = i === BEST_COL;
                return (
                  <Box
                    key={i}
                    sx={{
                      p: { xs: 1.3, md: 1.8 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      background: isBest ? highlight : 'transparent',
                      borderLeft: isBest ? `1px solid ${isDark ? 'rgba(108,123,255,0.10)' : 'rgba(0,4,255,0.08)'}` : 'none',
                      borderRight: isBest ? `1px solid ${isDark ? 'rgba(108,123,255,0.10)' : 'rgba(0,4,255,0.08)'}` : 'none',
                    }}
                  >
                    <ValueCell v={v} isBest={isBest} />
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      <Typography
        sx={{
          mt: 2,
          fontFamily: 'var(--font-sans)',
          fontSize: 11.5,
          color: theme.palette.text.disabled,
          textAlign: 'center',
        }}
      >
        Comparison based on each provider&apos;s publicly documented pricing as of 2026-07. &ldquo;Typical&rdquo; fees
        reflect industry averages for card-not-present transactions and can vary by merchant category.
      </Typography>
    </Box>
  );
};

export default memo(ComparisonTable);
