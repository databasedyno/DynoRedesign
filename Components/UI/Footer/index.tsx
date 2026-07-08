'use client'

import { Box, Typography, useTheme } from '@mui/material'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');

  return (
    <Box
      component='footer'
      sx={{
        width: '100%',
        py: 1.5,
        textAlign: 'center',
        background: isDark
          ? 'linear-gradient(180deg, #0d0d1a 0%, #141428 100%)'
          : 'linear-gradient(180deg, #242428 0%, #1a1a1e 100%)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box display='flex' alignItems='center' justifyContent='center' gap={2}>
        <Link
          href='/pay/terms-of-service'
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '11.5px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: "'Urbanist', sans-serif",
            letterSpacing: '0.2px',
            transition: 'color 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        >
          {t('footer.termsOfService')}
        </Link>
        <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>•</Typography>
        <Link
          href='/pay/aml-policy'
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '11.5px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: "'Urbanist', sans-serif",
            letterSpacing: '0.2px',
            transition: 'color 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        >
          {t('footer.amlPolicy')}
        </Link>
        <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>•</Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '11px',
            fontFamily: "'Urbanist', sans-serif",
            letterSpacing: '0.2px',
          }}
        >
          {t("poweredByDynopay")}
        </Typography>
      </Box>
    </Box>
  )
}
