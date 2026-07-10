import React, { memo, useMemo, useState } from 'react';
import { Box, Typography, Slider, Select, MenuItem, InputBase, FormControl } from '@mui/material';
import { TrendingDown, ArrowForward } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import SwissSectionHead from './SwissSectionHead';
import { FONT_BODY, FONT_HERO, FONT_TECH, OBSIDIAN, useSwiss, SwissTokens } from './swiss';

/**
 * FeeCalculator — Swiss redesign. Same tier logic and comparison math as
 * before; presentation moved to a vertical-bar cost chart so the savings are
 * visceral at a glance.
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
 * `VOLUME_TIER_*` env vars (backend/utils/volumeTierUtils.ts).
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

const CostColumn: React.FC<{
  s: SwissTokens;
  label: string;
  subtitle: string;
  amount: number;
  max: number;
  best?: boolean;
  testId: string;
}> = ({ s, label, subtitle, amount, max, best, testId }) => {
  const pct = Math.max(6, Math.min(100, (amount / (max || 1)) * 100));
  return (
    <Box data-testid={testId} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: { xs: 14, md: 16 }, fontWeight: 500, color: s.txt, fontVariantNumeric: 'tabular-nums', mb: 1 }}>
        {formatUSD(amount)}
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 96, height: 190, display: 'flex', alignItems: 'flex-end' }}>
        <Box
          sx={{
            width: '100%',
            height: `${pct}%`,
            borderRadius: '8px 8px 0 0',
            backgroundColor: best ? s.accent : '#EF4444',
            opacity: best ? 1 : 0.85,
            transition: 'height 0.5s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </Box>
      <Box sx={{ width: '100%', borderTop: `1px solid ${s.lineStrong}`, pt: 1.25, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: s.txt }}>{label}</Typography>
          {best && (
            <Typography component="span" sx={{ fontFamily: FONT_TECH, fontSize: 9, letterSpacing: '0.12em', px: 0.75, py: 0.2, borderRadius: '4px', backgroundColor: s.accent, color: '#0A0A0A', fontWeight: 600 }}>
              BEST
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.faint, mt: 0.4, lineHeight: 1.5 }}>{subtitle}</Typography>
      </Box>
    </Box>
  );
};

const FeeCalculator: React.FC = () => {
  const s = useSwiss();
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

  return (
    <Box
      id="fee-calculator"
      component="section"
      aria-label="Fee calculator"
      data-testid="fee-calculator-section"
      sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: 'auto' }}
    >
      <SwissSectionHead
        num="01"
        eyebrow={t('feeCalcEyebrow')}
        title={`${t('feeCalcTitle')} ${t('feeCalcTitleHighlight')}`}
        highlight={t('feeCalcTitleHighlight')}
        sub={t('feeCalcSubtitle')}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' }, gap: { xs: 2.5, md: 3 }, alignItems: 'stretch', maxWidth: 1180, mx: 'auto' }}>
        {/* ==== LEFT: inputs ==== */}
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: '16px', border: `1px solid ${s.line}`, backgroundColor: s.surface }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: s.faint, mb: 1.5 }}>
            {t('feeCalcVolumeLabel')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2.5 }}>
            <Typography data-testid="fee-calc-volume-value" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 32, md: 42 }, color: s.txt, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {formatUSD(volume)}
            </Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: s.sub }}>
              {t('feeCalcPerMonth')}
            </Typography>
          </Box>
          <Slider
            aria-label="Monthly processing volume"
            data-testid="fee-calc-slider"
            value={volume}
            min={500}
            max={500_000}
            step={500}
            onChange={(_, v) => setVolume(Array.isArray(v) ? v[0] : v)}
            sx={{
              color: s.accent,
              height: 6,
              borderRadius: 0,
              '& .MuiSlider-thumb': {
                width: 18,
                height: 18,
                borderRadius: '5px',
                backgroundColor: s.accent,
                border: '2px solid #0A0A0A',
                boxShadow: 'none',
                '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${s.accentSoft}` },
              },
              '& .MuiSlider-track': { border: 'none', backgroundColor: s.accent },
              '& .MuiSlider-rail': { opacity: 1, backgroundColor: s.dark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,10,0.1)' },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.faint }}>$500</Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.faint }}>$500K</Typography>
          </Box>

          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: s.faint, mt: 4, mb: 1.5 }}>
            {t('feeCalcCompareAgainst')}
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={altId}
              data-testid="fee-calc-alt-select"
              onChange={(e) => setAltId(String(e.target.value))}
              input={
                <InputBase
                  sx={{
                    px: 1.6,
                    py: 1.2,
                    borderRadius: '10px',
                    border: `1px solid ${s.lineStrong}`,
                    fontFamily: FONT_TECH,
                    fontSize: 13.5,
                    color: s.txt,
                    '& .MuiSelect-icon': { color: s.txt, mr: 1 },
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
          <Typography sx={{ mt: 1.25, fontFamily: FONT_TECH, fontSize: 11, color: s.faint, lineHeight: 1.6 }}>
            {altNote(alt.id)}
          </Typography>

          <Typography sx={{ mt: 3, fontFamily: FONT_TECH, fontSize: 11, color: s.faint, lineHeight: 1.6 }}>
            {t('feeCalcAssumption', { count: `~${alt.txPerMonth.toLocaleString()}` })}
          </Typography>
        </Box>

        {/* ==== RIGHT: bar chart + savings ==== */}
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: '16px', border: `1px solid ${s.line}`, backgroundColor: s.surface, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', gap: { xs: 3, md: 6 }, justifyContent: 'center', px: { xs: 0, md: 4 } }}>
            <CostColumn
              s={s}
              label="Dynopay"
              subtitle={`${dynopayTier.percent}% (${dynopayTier.name}) · ${alt.txPerMonth.toLocaleString()} ${t('feeCalcTxAbbrev')}`}
              amount={dynopayCost}
              max={Math.max(dynopayCost, altCost, 1)}
              best
              testId="fee-calc-bar-dynopay"
            />
            <CostColumn
              s={s}
              label={altName(alt)}
              subtitle={`${alt.percent}%${alt.fixed ? ` + ${formatUSD(alt.fixed)}${t('feeCalcPerTx')}` : ''}`}
              amount={altCost}
              max={Math.max(dynopayCost, altCost, 1)}
              testId="fee-calc-bar-alt"
            />
          </Box>

          {/* Savings block — always obsidian */}
          <Box data-testid="fee-calc-savings" sx={{ px: 3, py: 2.75, borderRadius: '12px', backgroundColor: OBSIDIAN, border: '1px solid rgba(204,255,0,0.25)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <TrendingDown sx={{ fontSize: 14, color: '#CCFF00' }} />
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#CCFF00' }}>
                {t('feeCalcYouSave')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 30, md: 38 }, lineHeight: 1, color: '#F5F5F5', fontVariantNumeric: 'tabular-nums' }}>
                {formatUSD(monthlySavings)}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                {t('feeCalcPerMonthLong')}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: 'rgba(255,255,255,0.65)', mt: 1 }}>
              {t('feeCalcSavingsSummary', { yearly: formatUSD(yearlySavings), pct: savingsPct.toFixed(1), alt: altName(alt) })}
            </Typography>
          </Box>

          <Box
            component="button"
            type="button"
            data-testid="fee-calc-cta"
            onClick={() => router.push('/auth/register?ref=fee_calc')}
            sx={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 2.5,
              py: 1.25,
              border: 'none',
              cursor: 'pointer',
              borderRadius: '10px',
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 14,
              color: '#0A0A0A',
              backgroundColor: s.accent,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translate(-2px, -2px)',
                boxShadow: s.dark ? '4px 4px 0 rgba(204,255,0,0.35)' : '4px 4px 0 #0A0A0A',
              },
            }}
          >
            {t('feeCalcCta')} <ArrowForward sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FeeCalculator);
