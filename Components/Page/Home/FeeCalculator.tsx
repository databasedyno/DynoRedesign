import React, { memo, useMemo, useState } from 'react';
import { Box, Typography, Slider, useTheme, Select, MenuItem, InputBase, FormControl } from '@mui/material';
import { TrendingDown, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';

/**
 * FeeCalculator (item B) — the highest-impact conversion element on payment
 * landing pages per Wise/Ramp/Deel public case studies.
 *
 * Left column: a slider for "monthly processing volume" (bounded).
 * Right column: side-by-side comparison card that shows:
 *   - What DynoPay costs at that volume (0.5% flat)
 *   - What the alternative costs (user-picked: Stripe / Coinbase Commerce /
 *     BitPay / PayPal / typical credit card processor)
 *   - The savings, monthly and annualised
 *
 * Section id="fee-calculator" so the nav in the site header can scroll-spy.
 */

interface Alternative {
  id: string;
  name: string;
  percent: number;
  fixed: number;
  txPerMonth: number;
  note: string;
}

// Assume $75 average transaction → volume / 75, clamped to [10, 5000].
const txCount = (volume: number) => Math.max(10, Math.min(5000, Math.round(volume / 75)));

const ALTERNATIVES: Omit<Alternative, 'txPerMonth'>[] = [
  { id: 'stripe',  name: 'Stripe',                percent: 2.9,  fixed: 0.30, note: '2.9% + $0.30 per successful card charge' },
  { id: 'cb',      name: 'Coinbase Commerce',     percent: 1.0,  fixed: 0.00, note: '1% fee (after $1M lifetime volume)' },
  { id: 'bitpay',  name: 'BitPay',                percent: 1.0,  fixed: 0.00, note: '1% base + ~$0.25 miner fee typical' },
  { id: 'paypal',  name: 'PayPal',                percent: 3.49, fixed: 0.49, note: '3.49% + $0.49 for digital transactions' },
  { id: 'credit',  name: 'Credit card (typical)', percent: 2.5,  fixed: 0.10, note: 'Effective total incl. interchange + assessment' },
];

const DYNOPAY_PERCENT = 0.5;
const DYNOPAY_FIXED = 0;

const formatUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 });

const FeeCalculator: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const router = useRouter();

  const [volume, setVolume] = useState<number>(10_000);
  const [altId, setAltId] = useState<string>('stripe');

  const alt: Alternative = useMemo(() => {
    const base = ALTERNATIVES.find((a) => a.id === altId)!;
    return { ...base, txPerMonth: txCount(volume) };
  }, [altId, volume]);

  const dynopayCost = useMemo(() => (volume * DYNOPAY_PERCENT) / 100 + DYNOPAY_FIXED * alt.txPerMonth, [volume, alt.txPerMonth]);
  const altCost     = useMemo(() => (volume * alt.percent) / 100 + alt.fixed * alt.txPerMonth, [volume, alt]);
  const monthlySavings = Math.max(0, altCost - dynopayCost);
  const yearlySavings  = monthlySavings * 12;
  const savingsPct = altCost > 0 ? (monthlySavings / altCost) * 100 : 0;

  const primaryColor = '#0004FF';
  const altColor = '#EF4444';

  return (
    <Box
      id="fee-calculator"
      component="section"
      aria-label="Fee calculator"
      sx={{
        py: { xs: 6, md: 10 },
        px: { xs: 2, md: 4 },
        maxWidth: 1200,
        mx: 'auto',
      }}
    >
      {/* Header */}
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
          Fee calculator
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: 'OutfitBold',
            fontSize: { xs: 28, sm: 34, md: 42 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            letterSpacing: '-0.5px',
            mb: 1.5,
          }}
        >
          See what you&apos;ll save.{' '}
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, #0004FF 0%, #6C7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            No math required.
          </Box>
        </Typography>
        <Typography
          sx={{
            fontFamily: 'UrbanistMedium',
            fontSize: { xs: 14, md: 16 },
            color: theme.palette.text.secondary,
            maxWidth: 620,
            mx: 'auto',
          }}
        >
          Drag the slider. Pick your current processor. We&apos;ll show you the
          difference in your monthly and annual costs.
        </Typography>
      </Box>

      {/* Body */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 3, md: 4 },
          alignItems: 'stretch',
        }}
      >
        {/* ==== LEFT: inputs ==== */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: '20px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
          }}
        >
          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: 12.5,
              color: theme.palette.text.disabled,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              mb: 1,
            }}
          >
            Monthly processing volume
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
            <Typography
              sx={{
                fontFamily: 'OutfitBold',
                fontSize: { xs: 40, md: 52 },
                color: theme.palette.text.primary,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {formatUSD(volume)}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'UrbanistMedium',
                fontSize: 15,
                color: theme.palette.text.secondary,
              }}
            >
              /month
            </Typography>
          </Box>
          <Slider
            aria-label="Monthly processing volume"
            value={volume}
            min={500}
            max={500_000}
            step={500}
            onChange={(_, v) => setVolume(Array.isArray(v) ? v[0] : v)}
            sx={{
              color: primaryColor,
              height: 8,
              '& .MuiSlider-thumb': { width: 22, height: 22, boxShadow: '0 4px 12px rgba(0,4,255,0.35)' },
              '& .MuiSlider-track':  { background: 'linear-gradient(90deg, #0004FF, #6C7BFF)' },
              '& .MuiSlider-rail':   { opacity: isDark ? 0.18 : 0.12 },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 11.5, color: theme.palette.text.disabled }}>
              $500
            </Typography>
            <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 11.5, color: theme.palette.text.disabled }}>
              $500K
            </Typography>
          </Box>

          {/* Alternative picker */}
          <Typography
            sx={{
              fontFamily: 'UrbanistMedium',
              fontSize: 12.5,
              color: theme.palette.text.disabled,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              mt: 3.5,
              mb: 1,
            }}
          >
            Compare against
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={altId}
              onChange={(e) => setAltId(String(e.target.value))}
              input={
                <InputBase
                  sx={{
                    px: 1.6,
                    py: 1.2,
                    borderRadius: '10px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                    fontFamily: 'UrbanistSemiBold',
                    fontSize: 14,
                    color: theme.palette.text.primary,
                    '& .MuiSelect-icon': { color: theme.palette.text.primary, mr: 1 },
                  }}
                />
              }
            >
              {ALTERNATIVES.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ mt: 1, fontFamily: 'UrbanistMedium', fontSize: 11.5, color: theme.palette.text.disabled }}>
            {alt.note}
          </Typography>

          <Typography
            sx={{
              mt: 3,
              fontFamily: 'UrbanistMedium',
              fontSize: 11.5,
              color: theme.palette.text.disabled,
              lineHeight: 1.5,
            }}
          >
            Assumes $75 average transaction → <Box component="span" sx={{ fontFamily: 'UrbanistBold' }}>~{alt.txPerMonth.toLocaleString()}</Box> transactions/month. Real numbers depend on your business mix.
          </Typography>
        </Box>

        {/* ==== RIGHT: side-by-side results ==== */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${isDark ? '#12132A' : '#F4F5FF'} 0%, ${isDark ? '#0B0D1A' : '#ffffff'} 100%)`,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,4,255,0.10)'}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Compare bars */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, mb: 3 }}>
            <CostBar
              label="DynoPay"
              subtitle={`0.5% flat · ${alt.txPerMonth.toLocaleString()} tx`}
              amount={dynopayCost}
              max={Math.max(dynopayCost, altCost, 1)}
              color={primaryColor}
              isBest
            />
            <CostBar
              label={alt.name}
              subtitle={`${alt.percent}%${alt.fixed ? ` + ${formatUSD(alt.fixed)}/tx` : ''}`}
              amount={altCost}
              max={Math.max(dynopayCost, altCost, 1)}
              color={altColor}
            />
          </Box>

          {/* Savings hero */}
          <Box
            sx={{
              px: 2.2, py: 2.4,
              borderRadius: '14px',
              background: `linear-gradient(135deg, ${primaryColor}, #6C7BFF)`,
              color: '#fff',
              display: 'flex', flexDirection: 'column', gap: 1,
              mb: 2,
              boxShadow: '0 12px 30px rgba(0,4,255,0.25)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, opacity: 0.9 }}>
              <TrendingDown sx={{ fontSize: 15 }} />
              <Typography sx={{ fontFamily: 'UrbanistBold', fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                You save
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: 'OutfitBold', fontSize: { xs: 32, md: 40 }, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {formatUSD(monthlySavings)}
              </Typography>
              <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 14, opacity: 0.85 }}>
                per month
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: 'UrbanistSemiBold', fontSize: 13, opacity: 0.95, mt: 0.4 }}>
              That&apos;s {formatUSD(yearlySavings)}/yr · {savingsPct.toFixed(1)}% less than {alt.name}
            </Typography>
          </Box>

          <Box
            component="button"
            onClick={() => router.push('/auth/register?ref=fee_calc')}
            sx={{
              alignSelf: 'flex-start',
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 2.2, py: 1,
              border: 'none', cursor: 'pointer',
              borderRadius: '10px',
              fontFamily: 'UrbanistBold', fontSize: 14, color: '#fff',
              background: 'linear-gradient(135deg, #0004FF 0%, #3D40FF 100%)',
              boxShadow: '0 8px 22px rgba(0,4,255,0.25)',
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-1px)' },
            }}
          >
            Start saving today <ArrowForward sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const CostBar: React.FC<{
  label: string;
  subtitle: string;
  amount: number;
  max: number;
  color: string;
  isBest?: boolean;
}> = ({ label, subtitle, amount, max, color, isBest }) => {
  const pct = Math.min(100, (amount / (max || 1)) * 100);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.6 }}>
        <Box>
          <Typography component="span" sx={{ fontFamily: 'UrbanistBold', fontSize: 14, color: (t) => t.palette.text.primary }}>
            {label}
          </Typography>
          {isBest && (
            <Box
              component="span"
              sx={{
                ml: 1,
                px: 0.8, py: 0.15,
                borderRadius: '999px',
                bgcolor: 'rgba(34,197,94,0.12)',
                color: '#16A34A',
                fontFamily: 'UrbanistBold',
                fontSize: 10,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
              }}
            >
              Best
            </Box>
          )}
          <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 11.5, color: (t) => t.palette.text.disabled, mt: 0.2 }}>
            {subtitle}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: 'OutfitBold',
            fontSize: 18,
            color: (t) => t.palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatUSD(amount)}
        </Typography>
      </Box>
      <Box
        sx={{
          height: 8,
          borderRadius: '999px',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${pct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}CC)`,
            transition: 'width 0.4s ease',
            borderRadius: '999px',
          }}
        />
      </Box>
    </Box>
  );
};

export default memo(FeeCalculator);
