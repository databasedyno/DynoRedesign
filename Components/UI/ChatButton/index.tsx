'use client';

import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import ChatIcon from "@/assets/Images/chatIcon.png";

const FloatingChatButton = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: isMobile ? 40 : '20%',
        right: isMobile ? 16 : 24,
        zIndex: 1000,
        boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.1)',
        background: 'linear-gradient(to bottom right, #00A1FF, #444CE7)',
        p: 1.2,
        borderTopRightRadius: '50%',
        borderTopLeftRadius: '50%',
        borderBottomLeftRadius: '50%',
        borderBottomRightRadius: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isMobile ? 56 : 64,
        height: isMobile ? 56 : 64,
      }}
    >
      <IconButton
        sx={{
          color: '#fff',
          p: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ChatIcon.src}
          alt="Chat"
          style={{
            width: isMobile ? '28px' : '35px',
            height: isMobile ? '26px' : '30px',
            objectFit: 'contain',
          }}
        />
      </IconButton>
    </Box>
  );
};

export default FloatingChatButton;
