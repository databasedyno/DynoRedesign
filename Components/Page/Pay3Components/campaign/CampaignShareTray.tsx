/**
 * CampaignShareTray — social share row for a donation/crowdfunding page.
 *
 * Compact icon-only tray (X, Threads, WhatsApp, LinkedIn, Copy link) with
 * a pre-composed message that already includes the campaign title and URL.
 * The Copy button flashes a snackbar on success.
 *
 * Keep it visually restrained — the page's main CTAs are pledge/donate.
 */
import React, { useState } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Snackbar,
  useTheme,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import copyToClipboard from "@/helpers/copyToClipboard";

interface Props {
  title: string;
  url: string;
  ariaLabel?: string;
}

const X_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2H21.5l-7.5 8.573L22.75 22h-6.813l-5.34-6.98L4.5 22H1.24l8.023-9.171L1.25 2h6.984l4.83 6.4L18.244 2Zm-1.194 18.11h1.836L6.99 3.789H5.02l12.03 16.32Z" />
  </svg>
);

const THREADS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.19 21.35c-3.4-.02-6.01-1.15-7.75-3.34-1.55-1.95-2.35-4.66-2.38-8.06.03-3.4.83-6.11 2.38-8.06C6.18 1.7 8.79.58 12.19.55c3.42.02 6.06 1.13 7.85 3.31 1.03 1.25 1.71 2.75 2.03 4.47l-1.9.49c-.26-1.34-.79-2.5-1.58-3.44-1.42-1.71-3.53-2.6-6.4-2.61-2.86.02-4.94.9-6.36 2.6-1.34 1.62-2.02 3.98-2.05 7.03.03 3.05.71 5.41 2.05 7.02 1.42 1.71 3.5 2.58 6.36 2.6 2.53-.02 4.29-.61 5.66-1.9 1.55-1.46 1.53-3.25 1.03-4.33-.29-.63-.83-1.16-1.55-1.53-.18 1.24-.6 2.24-1.26 2.97-.87.97-2.11 1.5-3.68 1.6-1.2.07-2.35-.21-3.26-.79-1.06-.68-1.69-1.72-1.75-2.94-.14-2.42 1.79-4.16 4.82-4.33.9-.05 1.75-.01 2.55.12-.11-.65-.34-1.16-.66-1.5-.44-.47-1.12-.71-2.03-.71h-.02c-.72 0-1.7.2-2.32 1.13l-1.62-1.09c.83-1.24 2.18-1.93 3.94-1.93h.03c2.95.02 4.7 1.83 4.87 4.99.1.04.19.09.29.13 1.34.63 2.32 1.58 2.85 2.74.72 1.62.79 4.26-1.35 6.28-1.63 1.54-3.61 2.23-6.42 2.25zm.85-8.61c-.24 0-.48.01-.72.02-1.79.1-2.87.95-2.8 2.15.07 1.27 1.46 1.86 2.79 1.78 1.22-.07 2.83-.55 3.06-3.7-.65-.14-1.36-.24-2.33-.25z" />
  </svg>
);

const WHATSAPP_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05.02C5.53.02.24 5.31.24 11.83c0 2.09.55 4.13 1.6 5.93L.14 24l6.42-1.68a11.8 11.8 0 0 0 5.49 1.4h.01c6.52 0 11.81-5.29 11.81-11.81 0-3.16-1.23-6.13-3.46-8.36zM12.06 21.94h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.81 1 1.02-3.71-.24-.38a9.85 9.85 0 0 1-1.5-5.24c0-5.44 4.43-9.87 9.88-9.87a9.82 9.82 0 0 1 6.98 2.89 9.83 9.83 0 0 1 2.89 6.98c0 5.45-4.43 9.88-9.88 9.88zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.21 3.09.15.2 2.09 3.19 5.06 4.48.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
  </svg>
);

const LINKEDIN_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .78 0 1.73v20.53C0 23.22.79 24 1.77 24h20.44c.98 0 1.79-.78 1.79-1.74V1.73C24 .78 23.2 0 22.22 0Z" />
  </svg>
);

export default function CampaignShareTray({ title, url, ariaLabel }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [copied, setCopied] = useState(false);

  const shareText = `Back "${title}" on Dynopay — help this campaign hit its goal.`;
  const encoded = encodeURIComponent(`${shareText} ${url}`);
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);

  const links = {
    x: `https://twitter.com/intent/tweet?text=${encoded}`,
    threads: `https://www.threads.net/intent/post?text=${encoded}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encoded}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&text=${encodedText}`,
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const btnSx = {
    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.72)",
    bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
    width: 32,
    height: 32,
    "&:hover": {
      bgcolor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
      transform: "translateY(-1px)",
    },
    transition: "all 0.15s ease",
  };

  return (
    <Box
      aria-label={ariaLabel || "Share this campaign"}
      data-testid="campaign-share-tray"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
      }}
    >
      <Tooltip title="Share on X">
        <IconButton
          size="small"
          component="a"
          href={links.x}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          sx={btnSx}
          data-testid="campaign-share-x"
        >
          {X_ICON}
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on Threads">
        <IconButton
          size="small"
          component="a"
          href={links.threads}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Threads"
          sx={btnSx}
          data-testid="campaign-share-threads"
        >
          {THREADS_ICON}
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on WhatsApp">
        <IconButton
          size="small"
          component="a"
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          sx={btnSx}
          data-testid="campaign-share-whatsapp"
        >
          {WHATSAPP_ICON}
        </IconButton>
      </Tooltip>
      <Tooltip title="Share on LinkedIn">
        <IconButton
          size="small"
          component="a"
          href={links.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
          sx={btnSx}
          data-testid="campaign-share-linkedin"
        >
          {LINKEDIN_ICON}
        </IconButton>
      </Tooltip>
      <Tooltip title="Copy link">
        <IconButton
          size="small"
          onClick={handleCopy}
          aria-label="Copy campaign link"
          sx={btnSx}
          data-testid="campaign-share-copy"
        >
          <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Snackbar
        open={copied}
        autoHideDuration={2200}
        onClose={() => setCopied(false)}
        message="Link copied"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
