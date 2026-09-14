import React from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import Logo from "@/assets/Icons/Logo";

const BrandLogo = ({ redirect = true }: { redirect?: boolean }) => {
  const router = useRouter();
  return (
    <Box
      data-testid="brand-logo"
      sx={{
        mt: 2,
        display: { lg: "block", xs: "none" },
        cursor: "pointer",
      }}
      onClick={() => redirect && router.push("/")}
    >
      <Logo width={40} height={48} />
    </Box>
  );
};

export default BrandLogo;
