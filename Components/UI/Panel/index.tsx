import React from "react";
import { Card, SxProps } from "@mui/material";
interface PanelProps {
  children: JSX.Element | JSX.Element[] | string;
  radius?: number;
  padding?: number;
  sx?: SxProps;
  onClick?: any;
}
const Panel = ({
  children,
  radius = 4,
  padding = 3,
  sx,
  onClick,
}: PanelProps) => {
  return (
    <Card
      variant="outlined"
      sx={{ p: padding, borderRadius: `${radius}px`, ...sx }}
      onClick={onClick && onClick}
    >
      {children}
    </Card>
  );
};

export default Panel;
