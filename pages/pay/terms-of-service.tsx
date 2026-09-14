import React from 'react';
import {
  Box,
  Typography,
  Container,
  useTheme,
} from '@mui/material';
import Pay3Layout from '@/Components/Layout/Pay3Layout';
import BackButton from '@/Components/Page/Pay3Components/backButton';
import { useTranslation } from 'react-i18next';

const TermsOfService = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  
  const sectionKeys = [
    'overview',
    'eligibility', 
    'userAccount',
    'permittedUse',
    'paymentsFees',
    'riskDisclosure',
    'amlKyc',
    'suspension',
    'intellectualProperty',
    'disclaimer',
    'liability',
    'modifications',
    'governingLaw',
    'contact'
  ];

  return (
    <Pay3Layout>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <BackButton onClick={() => history.back()} />

        <Box sx={{ mt: '26px' }}>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ 
              color: isDark ? theme.palette.secondary.main : '#2D3282', 
              fontFamily: 'var(--font-sans)', 
              fontSize: { xs: '36px', sm: '50px' } 
            }}
          >
            {t('terms.title')}
          </Typography>
          <Typography 
            variant="body2" 
            color={isDark ? theme.palette.text.secondary : '#707070'} 
            sx={{ mt: '12px' }}
          >
            {t('terms.lastUpdated')} January 11, 2025
          </Typography>
        </Box>

        <Box sx={{ mt: '12px' }}>
          <Typography 
            variant="body1" 
            mb={2} 
            sx={{ fontFamily: 'var(--font-sans)', color: theme.palette.text.primary }}
          >
            {t('terms.intro')}
          </Typography>

          {sectionKeys.map((key) => (
            <Box key={key} sx={{ mt: '24px' }}>
              <Typography
                variant="subtitle1"
                fontWeight={500}
                sx={{ mb: '12px', fontFamily: 'var(--font-sans)', color: theme.palette.text.primary }}
              >
                {t(`terms.sections.${key}.title`)}
              </Typography>
              <Typography
                variant="body2"
                sx={{ 
                  whiteSpace: 'pre-line', 
                  fontSize: "16px", 
                  lineHeight: 1.6, 
                  fontFamily: 'var(--font-sans)', 
                  color: theme.palette.text.primary 
                }}
              >
                {t(`terms.sections.${key}.content`)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Pay3Layout>
  );
};

export default TermsOfService;
