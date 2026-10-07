import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import type { AssetFact } from "./platformFacts";

/* Coin glyph: iconify where available, bundled SVG for RLUSD. */
export const AssetGlyph: React.FC<{ asset: AssetFact; size?: number }> = ({ asset, size = 24 }) =>
  asset.icon ? (
    <Icon icon={asset.icon} width={size} height={size} />
  ) : (
    <Image src={RLUSDIcon} alt="" width={size} height={size} draggable={false} style={{ borderRadius: "50%" }} />
  );
