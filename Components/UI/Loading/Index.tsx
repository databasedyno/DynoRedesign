import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { brandFg } from '@/constants/theme';

const Loading = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="50vh"
      width="100%"
      bgcolor={isDark ? theme.palette.background.default : "#F9FAFB"}
      minHeight={'calc(100vh - 340px)'}
    >
      <CircularProgress size={48} thickness={4} sx={{ color: brandFg(isDark) }} />
      <Typography
        variant="subtitle1"
        color="text.secondary"
        mt={2}
        fontFamily="var(--font-sans)"
      >
        {t('crypto.pleaseWait')}...
      </Typography>
    </Box>
  );
};

export default Loading;
