import useIsMobile from "@/hooks/useIsMobile";
import { SxProps, Theme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { CardBody, StyledCard } from "./styled";

export interface HomeCardProps {
  children: React.ReactNode;
  bodyPadding?: number | string;
  sx?: SxProps<Theme>;
  bodySx?: SxProps<Theme>;
  onClick?: () => void;
  height?: number | string;
  width?: number | string;
}

const HomeCard: React.FC<HomeCardProps> = ({
  children,
  bodyPadding,
  sx,
  bodySx,
  onClick,
  height,
  width,
}) => {
  const isMobile = useIsMobile("md");

  const cardSx = useMemo<SxProps<Theme> | undefined>(() => {
    const hasSize = width !== undefined || height !== undefined;
    if (!sx && !hasSize) return undefined;
    return [
      ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ...(hasSize ? [{ width, height }] : []),
    ];
  }, [sx, width, height]);

  const mergedBodySx = useMemo<SxProps<Theme> | undefined>(() => {
    const hasPadding = bodyPadding !== undefined;
    if (!bodySx && !hasPadding) return undefined;
    return [
      ...(bodySx ? (Array.isArray(bodySx) ? bodySx : [bodySx]) : []),
      ...(hasPadding ? [{ padding: bodyPadding }] : []),
    ];
  }, [bodySx, bodyPadding]);

  void isMobile;

  return (
    <StyledCard sx={cardSx} onClick={onClick}>
      <CardBody sx={mergedBodySx}>{children}</CardBody>
    </StyledCard>
  );
};

export default memo(HomeCard);
