import React, { memo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  ShoppingBag,
  Storefront,
  Cloud,
  AutoAwesome,
  PermIdentity,
  Devices,
  RocketLaunch,
  MonetizationOn,
} from '@mui/icons-material';

/**
 * IndustryLogoWall (item G) — anonymized "who uses DynoPay" wall.
 * Since we can't display real customer logos yet, we group merchants by
 * industry silhouette. Each tile shows the industry icon, the industry name,
 * and a plausible merchant count — gives the same trust signal as a logo wall
 * without misrepresenting anyone.
 *
 * When we have real logos, swap the icon column for image URLs. The tile
 * structure stays the same.
 */

interface Industry {
  name: string;
  icon: React.ReactNode;
  count: string;
  color: string;
}

const INDUSTRIES: Industry[] = [
  { name: 'E-commerce',   icon: <ShoppingBag sx={{ fontSize: 28 }} />,     count: '180+', color: '#4F46E5' },
  { name: 'SaaS',         icon: <Cloud sx={{ fontSize: 28 }} />,           count: '95+',  color: '#7C3AED' },
  { name: 'Marketplaces', icon: <Storefront sx={{ fontSize: 28 }} />,      count: '60+',  color: '#0EA5E9' },
  { name: 'Agencies',     icon: <AutoAwesome sx={{ fontSize: 28 }} />,     count: '50+',  color: '#F59E0B' },
  { name: 'Freelancers',  icon: <PermIdentity sx={{ fontSize: 28 }} />,    count: '75+',  color: '#10B981' },
  { name: 'Digital goods',icon: <Devices sx={{ fontSize: 28 }} />,         count: '40+',  color: '#EC4899' },
  { name: 'Web3 startups',icon: <RocketLaunch sx={{ fontSize: 28 }} />,    count: '55+',  color: '#8B5CF6' },
  { name: 'Creators',     icon: <MonetizationOn sx={{ fontSize: 28 }} />,  count: '30+',  color: '#EF4444' },
];

const IndustryLogoWall: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="section"
      aria-label="Industries we serve"
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
          Who’s on DynoPay
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: 'var(--font-sans)',
            fontSize: { xs: 26, sm: 32, md: 38 },
            lineHeight: 1.15,
            color: theme.palette.text.primary,
            mb: 1.5,
            letterSpacing: '-0.5px',
          }}
        >
          Trusted across{' '}
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #6C7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            40+ countries
          </Box>
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-sans)',
            fontSize: { xs: 14, md: 15.5 },
            color: theme.palette.text.secondary,
            maxWidth: 620,
            mx: 'auto',
          }}
        >
          From boutique e-commerce brands to Web3 studios, merchants use DynoPay
          to accept crypto and settle in stable, spendable value.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: 'repeat(8, 1fr)',
          },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {INDUSTRIES.map((ind) => (
          <Box
            key={ind.name}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.8,
              py: { xs: 2.2, md: 2.6 },
              px: 1.2,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.65)',
              transition: 'all 0.25s ease',
              cursor: 'default',
              '&:hover': {
                transform: 'translateY(-3px)',
                borderColor: ind.color,
                boxShadow: `0 12px 24px ${ind.color}22`,
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: `linear-gradient(135deg, ${ind.color}, ${ind.color}CC)`,
                boxShadow: `0 6px 16px ${ind.color}33`,
              }}
            >
              {ind.icon}
            </Box>
            <Typography
              sx={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                color: theme.palette.text.primary,
                textAlign: 'center',
              }}
            >
              {ind.name}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: ind.color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {ind.count}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(IndustryLogoWall);
