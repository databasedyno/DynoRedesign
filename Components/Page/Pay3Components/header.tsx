'use client';

import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Drawer,
  Stack,
  Button,
  useMediaQuery,
  useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useTranslation } from 'react-i18next';
import Logo from "@/assets/Icons/Logo";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";

const Header = ({
  darkMode,
  toggleDarkMode
}: {
  darkMode: boolean;
  toggleDarkMode: () => void;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation('common');

  const toggleDrawer = () => setDrawerOpen(!drawerOpen);

  return (
    <>
      <AppBar
        position='static'
        elevation={0}
        sx={{
          background: darkMode
            ? `linear-gradient(90deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`
            : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
          height: '60px',
          justifyContent: 'center',
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            minHeight: '60px !important',
            px: { xs: 2, md: 4 },
          }}
        >
          {/* Left: Logo */}
          <Box display='flex' alignItems='center'>
            <Logo width={36} height={42} color="#FFFFFF" />
          </Box>

          {/* Right */}
          {isMobile ? (
            <IconButton onClick={toggleDrawer} sx={{ color: 'white' }}>
              <MenuIcon />
            </IconButton>
          ) : (
            <Stack direction='row' spacing={2} alignItems='center'>
              {/* Wallet */}
              <Button
                startIcon={<Icon icon="solar:wallet-linear" width="18" height="18" />}
                variant='contained'
                size='small'
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 20,
                  px: 2,
                  py: 0.75,
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: 'none',
                  backdropFilter: 'blur(8px)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    boxShadow: 'none',
                  },
                  height: '36px',
                }}
              >
                {t('header.wallet')}
              </Button>

              {/* Language Switcher with flag icons */}
              <LanguageSwitcher />

              {/* Theme Toggle — compact */}
              <Box
                onClick={toggleDarkMode}
                sx={{
                  width: 60,
                  height: 30,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: !darkMode ? '#fff' : 'transparent',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <WbSunnyIcon sx={{ fontSize: 14, color: !darkMode ? '#0A0A0A' : 'rgba(255,255,255,0.5)' }} />
                </Box>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: darkMode ? '#fff' : 'transparent',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <BedtimeIcon sx={{ fontSize: 14, color: darkMode ? '#0A0A0A' : 'rgba(255,255,255,0.5)' }} />
                </Box>
              </Box>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor='right'
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            width: 240,
            p: 2,
            backgroundColor: theme.palette.background.paper,
          },
        }}
      >
        <Stack spacing={2} mt={1}>
          <Button
            startIcon={<Icon icon="solar:wallet-linear" width="18" height="18" />}
            variant='outlined'
            size='small'
            sx={{
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              borderRadius: 20,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {t('header.wallet')}
          </Button>

          {/* Language Switcher with flag icons */}
          <LanguageSwitcher showBig />

          <Box
            onClick={() => { toggleDarkMode(); toggleDrawer(); }}
            sx={{
              width: 52,
              height: 28,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : theme.palette.border.main,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: darkMode ? 'flex-end' : 'flex-start',
              px: '3px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                backgroundColor: theme.palette.primary.main,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.palette.primary.contrastText,
                transition: 'all 0.3s ease',
              }}
            >
              {darkMode ? <BedtimeIcon sx={{ fontSize: 13 }} /> : <WbSunnyIcon sx={{ fontSize: 13 }} />}
            </Box>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
};

export default Header;
