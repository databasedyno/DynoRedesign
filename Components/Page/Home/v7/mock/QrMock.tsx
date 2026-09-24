import React from "react";
import { Box } from "@mui/material";

/* Deterministic pseudo-QR (finder patterns + hashed data cells) baked into one SVG data URI. */
const N = 21;
const finder = (x: number, y: number): 0 | 1 | null => {
  for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
    const dx = x - fx;
    const dy = y - fy;
    if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      return ring === 3 || ring <= 1 ? 1 : 0;
    }
  }
  return null;
};
const cell = (x: number, y: number) => finder(x, y) ?? ((x * 7 + y * 11 + x * y * 3) % 5 < 2 ? 1 : 0);
const rects: string[] = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cell(x, y)) rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
const QR_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" fill="#0F1013">${rects.join("")}</svg>`,
)}`;

export const QrMock: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <Box aria-hidden data-testid="mock-qr" sx={{ width: size, height: size, p: `${Math.round(size * 0.08)}px`, borderRadius: "10px", background: "#FFFFFF", flexShrink: 0 }}>
    <Box sx={{ width: "100%", height: "100%", backgroundImage: `url("${QR_URI}")`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
  </Box>
);
