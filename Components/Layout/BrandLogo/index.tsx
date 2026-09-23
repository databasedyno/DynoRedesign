import React from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import Logo from "@/assets/Icons/Logo";

const BrandLogo = ({ redirect = true, variant }: { redirect?: boolean; variant?: "onDark" | "onLight" }) => {
  const router = useRouter();
  return (
    <>
      <Box
        sx={{
          mt: 2,
          display: { lg: "block", xs: "none" },
          cursor: "pointer",
          lineHeight: 0,
        }}
        onClick={() => redirect && router.push("/")}
      >
        <Logo width={40} height={40} variant={variant} />
      </Box>
    </>
  );
};

export default BrandLogo;
