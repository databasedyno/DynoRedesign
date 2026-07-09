import React from "react";
import { Box, Tooltip } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";

interface UptimeDay {
  date: string;
  status: string;
}

interface BarsProps {
  dailyStatus?: UptimeDay[];
}

const Bars: React.FC<BarsProps> = ({ dailyStatus }) => {
  const isMobile = useIsMobile();

  const BAR_WIDTH = isMobile ? 1.27 : 5.27;
  const BAR_GAP = 2;
  const BAR_HEIGHT = 32;
  const TOTAL_DAYS = 90;
  const BAR_RADIUS = isMobile ? 0.8 : 3;

  // Use real data if provided, otherwise generate placeholder
  const uptimeData: UptimeDay[] = dailyStatus && dailyStatus.length > 0
    ? dailyStatus
    : Array.from({ length: TOTAL_DAYS }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (TOTAL_DAYS - 1 - i));
        return {
          date: date.toISOString().split("T")[0],
          status: "no_data",
        };
      });

  const svgWidth = uptimeData.length * (BAR_WIDTH + BAR_GAP);

  const getColor = (status: string) => {
    switch (status) {
      case "operational":
        return "#22C55E";
      case "degraded":
        return "#F59E0B";
      case "outage":
        return "#EF4444";
      case "no_data":
      default:
        return "#E5E7EB";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "outage":
        return "Outage";
      case "no_data":
      default:
        return "No data";
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: "2px",
        mt: "16px",
        fontFamily: "var(--font-sans)",
        opacity: 0.9,
      }}
    >
      <svg
        width="100%"
        height={BAR_HEIGHT}
        viewBox={`0 0 ${svgWidth} ${BAR_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {uptimeData.map((day, index) => {
          const x = index * (BAR_WIDTH + BAR_GAP);

          return (
            <Tooltip
              key={index}
              title={`${day.date} — ${getStatusLabel(day.status)}`}
              arrow
              placement="top"
            >
              <rect
                x={x}
                y={0}
                width={BAR_WIDTH}
                height={BAR_HEIGHT}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={getColor(day.status)}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.2s ease",
                  borderRadius: "8px",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.7")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = "1")
                }
              />
            </Tooltip>
          );
        })}
      </svg>
    </Box>
  );
};

export default Bars;
