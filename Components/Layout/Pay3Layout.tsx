import Header from '@/Components/Page/Pay3Components/header';
import Footer from '@/Components/UI/Footer';
import EmbedBridge from '@/Components/Common/EmbedBridge';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Box } from '@mui/material';
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

    return (
        <Box
            sx={{
                minHeight: embed ? 'auto' : '100vh',
                display: 'flex',
                flexDirection: 'column',
                // Quiet Money: flat pale-grey canvas (no decorative orbs) so the
                // single white checkout card is the only thing that reads.
                background: isDark ? '#0B0F19' : '#F4F5F9',
                transition: 'background 0.3s ease',
                position: 'relative',
                // `clip` keeps stray decorations contained WITHOUT creating a scroll
                // container, so `position: sticky` (checkout summary bar) still works.
                overflow: 'clip',
            }}
        >
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
