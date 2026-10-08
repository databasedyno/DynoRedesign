import React from "react";
import { Button, Stack } from "@mui/material";
import { Icon } from "@iconify/react";
import { ghostBtn } from "./sdStyles";

interface Props {
  url: string;
  /** e.g. "Logo design package · $120.00" */
  summary: string;
  onCopy: () => void;
  testidPrefix?: string;
  /** Override the share message (defaults to the deal-invite text). */
  text?: string;
  /** Also offer X (Twitter). */
  withX?: boolean;
  /** Dark surface: light outline buttons. */
  dark?: boolean;
  children?: React.ReactNode;
}

const openShare = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

/** Share sheet for an invite link — Telegram first, then WhatsApp, (X), copy, native share (E2E audit SD-05). */
export default function ShareInviteButtons({ url, summary, onCopy, testidPrefix = "sd-share", text, withX = false, dark = false, children }: Props) {
  const msg = text || `Join my SafeDeal escrow deal — ${summary}. Your money is held safely until it's delivered.`;
  const canNative = typeof navigator !== "undefined" && typeof (navigator as Navigator & { share?: unknown }).share === "function";
  const native = () => navigator.share({ title: "SafeDeal invite", text: msg, url }).catch(() => undefined);
  const btn = {
    ...ghostBtn,
    flexShrink: 0,
    whiteSpace: "nowrap",
    ...(dark ? { color: "#fff", borderColor: "rgba(255,255,255,0.28)", "&:hover": { borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.06)" } } : {}),
  } as const;
  const copyTestid = testidPrefix === "sd-share" ? "sd-copy-invite" : `${testidPrefix}-copy`;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap data-testid={`${testidPrefix}-row`}>
      <Button variant="contained" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(msg)}`)} data-testid={`${testidPrefix}-telegram`}
        startIcon={<Icon icon="mdi:send" />} sx={{ ...ghostBtn, flexShrink: 0, whiteSpace: "nowrap", color: "#fff", backgroundColor: "#229ED9", "&:hover": { backgroundColor: "#1B8AC0" } }}>
        Telegram
      </Button>
      <Button variant="outlined" onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}`)} data-testid={`${testidPrefix}-whatsapp`} startIcon={<Icon icon="mdi:whatsapp" />} sx={btn}>
        WhatsApp
      </Button>
      {withX && (
        <Button variant="outlined" onClick={() => openShare(`https://x.com/intent/post?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(url)}`)} data-testid={`${testidPrefix}-x`} startIcon={<Icon icon="ri:twitter-x-fill" />} sx={btn}>
          Post on X
        </Button>
      )}
      <Button variant="outlined" onClick={onCopy} data-testid={copyTestid} startIcon={<Icon icon="mdi:content-copy" />} sx={btn}>
        Copy link
      </Button>
      {canNative && (
        <Button variant="outlined" onClick={() => void native()} data-testid={`${testidPrefix}-native`} startIcon={<Icon icon="mdi:share-variant-outline" />} sx={btn}>
          More…
        </Button>
      )}
      {children}
    </Stack>
  );
}
