import { Box } from "@mui/material";
import React from "react";
import Spinner from "@/Components/UI/Spinner";

/**
 * Full-page centered loader used as a route/Suspense fallback.
 * The spinner itself now comes from the shared <Spinner/> primitive.
 */
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
      <Spinner size={44} />
    </Box>
  );
};

export default Loader;
