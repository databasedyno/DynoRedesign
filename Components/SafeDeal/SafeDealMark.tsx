import React from "react";

/**
 * SafeDeal logo MARK — a golden "secure-exchange" shield on a black squircle.
 * The shield holds two interlocking arrows (a safe two-way exchange) that also
 * read as a checkmark. Pure inline SVG so it stays razor-crisp at every size
 * (favicon 16px → hero 96px) and needs no icon font.
 *
 * `ring` adds a gold hairline + glow so the black tile stays visible when it
 * sits on a dark (SD_INK) surface like the header/hero.
 */
export default function SafeDealMark({ size = 32, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SafeDeal"
      style={ring ? { filter: "drop-shadow(0 4px 14px rgba(255,198,26,0.35))" } : undefined}
    >
      <defs>
        <linearGradient id="sdTile" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A1A1E" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient id="sdGold" x1="12" y1="6" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE07A" />
          <stop offset="0.55" stopColor="#FFC61A" />
          <stop offset="1" stopColor="#F0A500" />
        </linearGradient>
      </defs>

      {/* Black squircle tile */}
      <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#sdTile)" />
      {ring && <rect x="1.75" y="1.75" width="44.5" height="44.5" rx="11.25" stroke="#FFC61A" strokeOpacity="0.55" strokeWidth="1.5" />}

      {/* Golden shield */}
      <path
        d="M24 7.5 L37 12 V24.2 C37 31.6 31.4 37.2 24 40.5 C16.6 37.2 11 31.6 11 24.2 V12 Z"
        fill="url(#sdGold)"
      />
      {/* Inner ink cut so the exchange mark reads cleanly */}
      <path
        d="M24 11 L33.6 14.3 V24.1 C33.6 29.7 29.4 34 24 36.6 C18.6 34 14.4 29.7 14.4 24.1 V14.3 Z"
        fill="#0A0A0B"
        fillOpacity="0.92"
      />
      {/* Two-way exchange arrows (also reads as a check) in gold */}
      <path
        d="M19 21.5 H28 L25.3 18.6"
        stroke="url(#sdGold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 27.5 H20 L22.7 30.4"
        stroke="url(#sdGold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
