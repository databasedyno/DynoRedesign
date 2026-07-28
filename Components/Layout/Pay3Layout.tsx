import Header from '@/Components/Page/Pay3Components/header';
import Footer from '@/Components/UI/Footer';
import EmbedBridge from '@/Components/Common/EmbedBridge';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Box, useTheme } from '@mui/material';
import React from 'react';

export default function Pay3Layout({
    children,
    embed = false,
}: {
    children: React.ReactNode;
    /**
     * When true, hides the site header and footer so the checkout card can be
     * embedded inside an iframe (e.g. the homepage TryItNow playground). Also
     * tightens vertical padding to fit smaller iframe heights.
     */
    embed?: boolean;
}) {
    const { mode, toggleTheme, isDark } = useThemeMode();
    const theme = useTheme();

    return (
        <Box
            sx={{
                minHeight: embed ? 'auto' : '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: theme.palette.background.default,
                transition: 'background 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Swiss grid backdrop → aurora-tinted, kept subtle */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: isDark
                        ? 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)'
                        : 'linear-gradient(rgba(10,10,10,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.045) 1px, transparent 1px)',
                    backgroundSize: '54px 54px',
                    maskImage: 'radial-gradient(ellipse 90% 80% at 50% 30%, black 25%, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 30%, black 25%, transparent 80%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            {/* Aurora indigo/violet orb behind card — session 82 migration
                (was: volt-lime radial glow #CCFF00). Matches Landing v3. */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '18%',
                    left: '14%',
                    width: '540px',
                    height: '540px',
                    borderRadius: '50%',
                    background: isDark
                        ? 'radial-gradient(circle, rgba(129,140,248,0.10) 0%, transparent 65%)'
                        : 'radial-gradient(circle, rgba(79,70,229,0.09) 0%, transparent 65%)',
                    filter: 'blur(20px)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    bottom: '10%',
                    right: '10%',
                    width: '460px',
                    height: '460px',
                    borderRadius: '50%',
                    background: isDark
                        ? 'radial-gradient(circle, rgba(124,92,255,0.08) 0%, transparent 65%)'
                        : 'radial-gradient(circle, rgba(124,92,255,0.07) 0%, transparent 65%)',
                    filter: 'blur(20px)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            {!embed && <Header darkMode={isDark} toggleDarkMode={toggleTheme} />}
            {embed && <EmbedBridge />}
            <Box
                component="main"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    py: embed ? { xs: 0.5, sm: 1 } : { xs: 2, sm: 3 },
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {children}
            </Box>
            {!embed && <Footer />}
        </Box>
    );
}
