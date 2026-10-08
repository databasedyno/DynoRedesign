import React from "react";

export const SD_BRAND_INK = "#0A0A0B";
export const SD_BRAND_GOLD = "#FFC61A";
export const SD_BRAND_WHITE = "#FFFFFF";

export type SdMarkMarkup = { color: string; mono: string };

/** Fill a generated 48-grid mark template with colours (gold = null → single-colour version). */
export const paintMark = (m: SdMarkMarkup, ink: string, gold: string | null): string =>
  (gold === null ? m.mono : m.color).split("__INK__").join(ink).split("__GOLD__").join(gold ?? ink);

type Props = {
  mark: SdMarkMarkup;
  size?: number;
  ink?: string;
  gold?: string | null;
  title?: string;
  testId?: string;
};

/** SafeDeal symbol — pure inline SVG from the generated geometry (scripts/brand/safedeal-logo.mjs). */
export const SdMark = ({ mark, size = 32, ink = SD_BRAND_INK, gold = SD_BRAND_GOLD, title = "SafeDeal", testId }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    role="img"
    aria-label={title}
    data-testid={testId}
    style={{ display: "block", flexShrink: 0 }}
    dangerouslySetInnerHTML={{ __html: paintMark(mark, ink, gold) }}
  />
);
