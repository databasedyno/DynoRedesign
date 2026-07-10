import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  VerifiedUser,
  PrivacyTip,
  Radar,
  Shield,
} from '@mui/icons-material';
import { FONT_BODY, FONT_TECH, OBSIDIAN } from './swiss';

/**
 * ComplianceLogoStrip — inverted deep-obsidian trust band (Swiss redesign).
 * Same badge content as before, recomposed as a high-contrast full-width strip.
 */

interface Badge {
  label: string;
  labelKey?: string;
  subKey: string;
  icon: React.ReactNode;
}

const BADGES: Badge[] = [
  { label: 'SOC 2', subKey: 'complianceSoc2Sub', icon: <VerifiedUser sx={{ fontSize: 20 }} /> },
  { label: 'GDPR', subKey: 'complianceGdprSub', icon: <PrivacyTip sx={{ fontSize: 20 }} /> },
  { label: 'Non-custodial', labelKey: 'complianceNonCustodialLabel', subKey: 'complianceNonCustodialSub', icon: <Shield sx={{ fontSize: 20 }} /> },
  { label: 'KYT', subKey: 'complianceKytSub', icon: <Radar sx={{ fontSize: 20 }} /> },
  { label: 'Chainalysis', subKey: 'complianceChainalysisSub', icon: <Shield sx={{ fontSize: 20 }} /> },
];

const ComplianceLogoStrip: React.FC = () => {
  const { t } = useTranslation('landing');

  return (
    <Box
      component="section"
      aria-label="Security and compliance"
      data-testid="compliance-strip"
      sx={{
        backgroundColor: OBSIDIAN,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        py: { xs: 5, md: 7 },
        px: { xs: 3, md: 6 },
      }}
    >
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Typography
          sx={{
            fontFamily: FONT_TECH,
            fontSize: 11.5,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            mb: { xs: 3.5, md: 5 },
          }}
        >
          {t('complianceHeader')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
            gap: { xs: 3, md: 0 },
          }}
        >
          {BADGES.map((b, i) => (
            <Box
              key={b.label}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 0.75,
                px: 2,
                borderLeft: { md: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' },
              }}
            >
              <Box sx={{ color: '#CCFF00', display: 'flex', mb: 0.25 }}>{b.icon}</Box>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: '#F5F5F5', lineHeight: 1.2 }}>
                {b.labelKey ? t(b.labelKey) : b.label}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                {t(b.subKey)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ComplianceLogoStrip);
