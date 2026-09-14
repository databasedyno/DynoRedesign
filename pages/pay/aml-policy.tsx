import React from 'react';
import {
  Box,
  Typography,
  Container,
  List,
  ListItem,
  ListItemText,
  useTheme,
} from '@mui/material';
import Pay3Layout from '@/Components/Layout/Pay3Layout';
import BackButton from '@/Components/Page/Pay3Components/backButton';
import { useTranslation } from 'react-i18next';

const AMLPolicyPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  
  const sectionKeys = [
    'purpose',
    'riskBased',
    'kyc',
    'monitoring',
    'reporting',
    'training',
    'records',
    'crypto',
    'userResponsibility'
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
            gutterBottom
          >
            {t('aml.title')}
          </Typography>
          <Typography 
            variant="body2" 
            color={isDark ? theme.palette.text.secondary : '#707070'} 
            sx={{ mt: '12px' }}
          >
            {t('aml.lastUpdated')} January 11, 2025
          </Typography>
        </Box>

        <Box sx={{ mt: '12px' }}>
          <Typography 
            variant="body1" 
            sx={{ fontFamily: 'var(--font-sans)', color: theme.palette.text.primary }}
          >
            {t('aml.intro')}
          </Typography>
          <List dense sx={{ listStyle: 'disc', pl: 4, mb: 2, pt: 0 }}>
            <ListItem sx={{ display: 'list-item', py: 0 }}>
              <ListItemText 
                primary={t('aml.services.wallet')} 
                sx={{ '& .MuiListItemText-primary': { color: theme.palette.text.primary } }} 
              />
            </ListItem>
            <ListItem sx={{ display: 'list-item', py: 0 }}>
              <ListItemText 
                primary={t('aml.services.bank')} 
                sx={{ '& .MuiListItemText-primary': { color: theme.palette.text.primary } }} 
              />
            </ListItem>
            <ListItem sx={{ display: 'list-item', py: 0 }}>
              <ListItemText 
                primary={t('aml.services.crypto')} 
                sx={{ '& .MuiListItemText-primary': { color: theme.palette.text.primary } }} 
              />
            </ListItem>
          </List>

          {sectionKeys.map((key) => (
            <Box key={key} sx={{ mt: '24px' }}>
              <Typography
                variant="subtitle1"
                fontWeight={500}
                sx={{ mb: '12px', fontFamily: 'var(--font-sans)', color: theme.palette.text.primary }}
              >
                {t(`aml.sections.${key}.title`)}
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
                {t(`aml.sections.${key}.content`)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Pay3Layout>
  );
};

export default AMLPolicyPage;
