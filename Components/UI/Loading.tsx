import { Box } from "@mui/material";
import React from "react";
import { BRAND_ACCENT } from "@/constants/theme";

const Loader = () => {
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "4px solid white",
          borderTop: `4px solid ${BRAND_ACCENT}`,
          animation: "spin 0.9s linear infinite",

          "@keyframes spin": {
            "0%": {
              transform: "rotate(0deg)",
            },
            "100%": {
              transform: "rotate(360deg)",
            },
          },
        }}
      />
    </Box>
  );
};

export default Loader;