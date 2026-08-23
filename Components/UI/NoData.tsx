import React from "react";
import NoDataImage from "@/assets/Images/noData.png";
import { Box, Typography } from "@mui/material";
const NoData = ({
  customText,
  subText,
  maxHeight = true,
}: {
  customText?: string;
  subText?: string;
  maxHeight?: boolean;
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        height: "50vh",
        ...(maxHeight && { maxHeight: "320px" }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        "& img": {
          width: "250px",
          height: "auto",
        },
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static local illustration; MUI sx sizing, next/image adds no value here */}
      <img src={NoDataImage.src} width={NoDataImage.width} height={NoDataImage.height} alt="no data" loading="lazy" decoding="async" />
      <Typography fontWeight={500} fontSize={20} marginTop={2.5}>
        {customText ?? "No Data Available"}
      </Typography>
      {subText && (
        <Typography
          fontWeight={400}
          color={"text.secondary"}
          fontSize={15}
          marginTop={1}
        >
          {subText}
        </Typography>
      )}
    </Box>
  );
};

export default NoData;
