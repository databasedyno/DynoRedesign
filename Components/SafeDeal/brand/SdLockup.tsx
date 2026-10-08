import React from "react";
import { SD_LOCKUP, SD_WORDMARK } from "./sdLogoData";
import { SdMark, SdMarkMarkup, SD_BRAND_GOLD, SD_BRAND_INK } from "./SdMark";

/** "SafeDeal" wordmark outline, sized by cap height in px. */
export const SdWordmark = ({ cap = 16, color = SD_BRAND_INK }: { cap?: number; color?: string }) => {
  const s = cap / 100;
  // nudge so the cap height (not the ascenders) is what centres against the mark
  const nudge = (SD_WORDMARK.base - 50 - SD_WORDMARK.h / 2) * s;
  return (
    <svg
      width={SD_WORDMARK.w * s}
      height={SD_WORDMARK.h * s}
      viewBox={`0 0 ${SD_WORDMARK.w} ${SD_WORDMARK.h}`}
      aria-hidden
      style={{ display: "block", flexShrink: 0, transform: `translateY(${-nudge}px)` }}
    >
      <path d={SD_WORDMARK.d} fill={color} />
    </svg>
  );
};

type Props = { mark: SdMarkMarkup; cap?: number; ink?: string; gold?: string | null; testId?: string };

/** Full logo: symbol + one-colour wordmark. */
export const SdLockup = ({ mark, cap = 16, ink = SD_BRAND_INK, gold = SD_BRAND_GOLD, testId }: Props) => (
  <span
    role="img"
    aria-label="SafeDeal"
    data-testid={testId}
    style={{ display: "inline-flex", alignItems: "center", gap: SD_LOCKUP.gapPerCap * cap, lineHeight: 0 }}
  >
    <SdMark mark={mark} size={SD_LOCKUP.markPerCap * cap} ink={ink} gold={gold} />
    <SdWordmark cap={cap} color={ink} />
  </span>
);
