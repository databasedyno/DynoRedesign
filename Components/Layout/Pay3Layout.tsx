import Header from '@/Components/Page/Pay3Components/header';
import Footer from '@/Components/UI/Footer';
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
            {/* Subtle radial glow behind card */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '30%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: isDark
                        ? 'radial-gradient(circle, rgba(204,255,0,0.06) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(204,255,0,0.10) 0%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            {/* Secondary glow accent */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '60%',
                    left: '30%',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: isDark
                        ? 'radial-gradient(circle, rgba(88,101,242,0.05) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(10,10,10,0.03) 0%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            {!embed && <Header darkMode={isDark} toggleDarkMode={toggleTheme} />}
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
