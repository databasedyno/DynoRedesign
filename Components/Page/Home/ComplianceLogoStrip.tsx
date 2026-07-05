import React, { memo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  VerifiedUser,
  PrivacyTip,
  Radar,
  Shield,
} from '@mui/icons-material';

/**
 * ComplianceLogoStrip (item F) — monochrome infra/compliance badge row that
 * replaces the emoji-based trust indicators. Modern SaaS pattern from Stripe,
 * Plaid, MoonPay, Bridge — reads as "we take security seriously" on scan.
 *
 * Note: badges are represented with material icons + text labels rather than
 * official 3rd-party logos to avoid trademark issues on stuff we haven't
 * formally partnered with. Ordered from most-recognized to most-technical.
 */

interface Badge {
  label: string;
  sub: string;
  icon: React.ReactNode;
}

const BADGES: Badge[] = [
  {
    label: 'SOC 2',
    sub: 'Type II in progress',
    icon: <VerifiedUser sx={{ fontSize: 22 }} />,
  },
  {
    label: 'GDPR',
    sub: 'EU data compliant',
    icon: <PrivacyTip sx={{ fontSize: 22 }} />,
  },
  // 2026-07-05 — Removed PCI DSS badge. PCI DSS is a card-industry data-security
  // standard (Visa/Mastercard/etc). DynoPay is a non-custodial crypto gateway —
  // we don't touch card PANs, so claiming PCI DSS compliance is (a) misleading
  // and (b) irrelevant to merchants evaluating crypto rails.
  {
    label: 'Non-custodial',
    sub: 'Funds go direct to your wallet',
    icon: <Shield sx={{ fontSize: 22 }} />,
  },
  {
    label: 'KYT',
    sub: 'Know-your-transaction',
    icon: <Radar sx={{ fontSize: 22 }} />,
  },
  {
    label: 'Chainalysis',
    sub: 'On-chain monitoring',
    icon: <Shield sx={{ fontSize: 22 }} />,
  },
];

const ComplianceLogoStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="section"
      aria-label="Security and compliance"
      sx={{
        py: { xs: 3, md: 4 },
        px: { xs: 2, md: 4 },
        maxWidth: 1200,
        mx: 'auto',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'UrbanistBold',
          fontSize: 11,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: theme.palette.text.disabled,
          textAlign: 'center',
          mb: 2.5,
        }}
      >
        Enterprise-grade security · built on regulated infrastructure
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: { xs: 1.5, md: 2 },
          alignItems: 'stretch',
        }}
      >
        {BADGES.map((b) => (
          <Box
            key={b.label}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              py: { xs: 1.6, md: 2 },
              px: 1.2,
              borderRadius: '12px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
              filter: 'grayscale(1)',
              opacity: 0.85,
              transition: 'filter 0.25s ease, opacity 0.25s ease, transform 0.25s ease',
              '&:hover': { filter: 'grayscale(0)', opacity: 1, transform: 'translateY(-2px)' },
            }}
          >
            <Box sx={{ color: theme.palette.text.primary, opacity: 0.85 }}>{b.icon}</Box>
            <Typography
              sx={{
                fontFamily: 'UrbanistBold',
                fontSize: 13,
                color: theme.palette.text.primary,
                lineHeight: 1.2,
                letterSpacing: '0.3px',
              }}
            >
              {b.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'UrbanistMedium',
                fontSize: 10.5,
                color: theme.palette.text.disabled,
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {b.sub}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(ComplianceLogoStrip);
