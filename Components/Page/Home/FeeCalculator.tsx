import React, { memo, useMemo, useState } from 'react';
import { Box, Typography, Slider, useTheme, Select, MenuItem, InputBase, FormControl } from '@mui/material';
import { TrendingDown, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

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

const DYNOPAY_FIXED = 0;

/**
 * Volume-tier ladder used by the landing calculator. Must mirror the backend
 * `VOLUME_TIER_*` env vars (backend/utils/volumeTierUtils.ts). We keep this as
 * a client-side copy so the calculator can render instantly without an API
 * round-trip; if backend tiers change, update here too.
 * Volume is interpreted as ANNUAL/lifetime — matches `annualVolume = volume * 12`.
 */
const DYNOPAY_TIERS: Array<{ minAnnual: number; percent: number; name: string }> = [
  { minAnnual: 0,      percent: 1.5, name: 'Starter'    },
  { minAnnual: 10000,  percent: 1.0, name: 'Growth'     },
  { minAnnual: 100000, percent: 0.7, name: 'Scale'      },
  { minAnnual: 500000, percent: 0.5, name: 'Enterprise' },
];

const dynopayTierFor = (monthlyVolume: number) => {
  const annual = monthlyVolume * 12;
  return [...DYNOPAY_TIERS].reverse().find((t) => annual >= t.minAnnual) ?? DYNOPAY_TIERS[0];
};

const formatUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 });

const FeeCalculator: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const router = useRouter();
  const { t } = useTranslation('landing');
  const altName = (a: { id: string; name: string }) =>
    a.id === 'credit' ? t('feeCalcCreditCardName') : a.name;
  const altNote = (id: string) =>
    t(`feeCalcNote${id.charAt(0).toUpperCase()}${id.slice(1)}`);

  const [volume, setVolume] = useState<number>(10_000);
  const [altId, setAltId] = useState<string>('stripe');

  const alt: Alternative = useMemo(() => {
    const base = ALTERNATIVES.find((a) => a.id === altId)!;
    return { ...base, txPerMonth: txCount(volume) };
  }, [altId, volume]);

  const dynopayTier = useMemo(() => dynopayTierFor(volume), [volume]);
  const dynopayCost = useMemo(() => (volume * dynopayTier.percent) / 100 + DYNOPAY_FIXED * alt.txPerMonth, [volume, alt.txPerMonth, dynopayTier.percent]);
  const altCost     = useMemo(() => (volume * alt.percent) / 100 + alt.fixed * alt.txPerMonth, [volume, alt]);
  const monthlySavings = Math.max(0, altCost - dynopayCost);
  const yearlySavings  = monthlySavings * 12;
  const savingsPct = altCost > 0 ? (monthlySavings / altCost) * 100 : 0;

  const primaryColor = theme.palette.primary.main;
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
          {t('feeCalcEyebrow')}
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: "'Unbounded', 'OutfitBold', system-ui, sans-serif",
            fontSize: { xs: 28, sm: 34, md: 42 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            letterSpacing: '-0.02em',
            mb: 1.5,
          }}
        >
          {t('feeCalcTitle')}{' '}
          <Box
            component="span"
            sx={{
              color: theme.palette.primary.main,
            }}
          >
            {t('feeCalcTitleHighlight')}
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
          {t('feeCalcSubtitle')}
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
            {t('feeCalcVolumeLabel')}
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
              {t('feeCalcPerMonth')}
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
              '& .MuiSlider-thumb': { width: 22, height: 22, boxShadow: isDark ? '0 4px 14px rgba(204,255,0,0.4)' : '0 4px 12px rgba(10,10,10,0.25)' },
              '& .MuiSlider-track':  { border: 'none', backgroundColor: primaryColor },
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
            {t('feeCalcCompareAgainst')}
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
                  {altName(a)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ mt: 1, fontFamily: 'UrbanistMedium', fontSize: 11.5, color: theme.palette.text.disabled }}>
            {altNote(alt.id)}
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
            {t('feeCalcAssumption', { count: `~${alt.txPerMonth.toLocaleString()}` })}
          </Typography>
        </Box>

        {/* ==== RIGHT: side-by-side results ==== */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: '20px',
            background: isDark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.10)'}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Compare bars */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, mb: 3 }}>
            <CostBar
              label="DynoPay"
              subtitle={`${dynopayTier.percent}% (${dynopayTier.name}) · ${alt.txPerMonth.toLocaleString()} ${t('feeCalcTxAbbrev')}`}
              amount={dynopayCost}
              max={Math.max(dynopayCost, altCost, 1)}
              color={primaryColor}
              isBest
            />
            <CostBar
              label={altName(alt)}
              subtitle={`${alt.percent}%${alt.fixed ? ` + ${formatUSD(alt.fixed)}${t('feeCalcPerTx')}` : ''}`}
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
              background: primaryColor,
              color: theme.palette.primary.contrastText,
              display: 'flex', flexDirection: 'column', gap: 1,
              mb: 2,
              boxShadow: isDark ? '0 12px 34px rgba(204,255,0,0.28)' : '0 12px 30px rgba(10,10,10,0.18)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, opacity: 0.9 }}>
              <TrendingDown sx={{ fontSize: 15 }} />
              <Typography sx={{ fontFamily: 'UrbanistBold', fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                {t('feeCalcYouSave')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: 'OutfitBold', fontSize: { xs: 32, md: 40 }, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {formatUSD(monthlySavings)}
              </Typography>
              <Typography sx={{ fontFamily: 'UrbanistMedium', fontSize: 14, opacity: 0.85 }}>
                {t('feeCalcPerMonthLong')}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: 'UrbanistSemiBold', fontSize: 13, opacity: 0.95, mt: 0.4 }}>
              {t('feeCalcSavingsSummary', { yearly: formatUSD(yearlySavings), pct: savingsPct.toFixed(1), alt: altName(alt) })}
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
              fontFamily: 'UrbanistBold', fontSize: 14, color: theme.palette.primary.contrastText,
              background: primaryColor,
              boxShadow: isDark ? '0 8px 24px rgba(204,255,0,0.3)' : '0 8px 22px rgba(10,10,10,0.2)',
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-1px)' },
            }}
          >
            {t('feeCalcCta')} <ArrowForward sx={{ fontSize: 16 }} />
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
  const { t } = useTranslation('landing');
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
              {t('feeCalcBest')}
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
