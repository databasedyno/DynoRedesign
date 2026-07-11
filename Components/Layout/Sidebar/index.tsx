import { Box } from "@mui/material";
import React, { useEffect, useState } from "react";

import { BottomBullets } from "./styled";
import { useRouter } from "next/router";
import {
  InfoRounded,
  LoupeOutlined,
  SettingsRounded,
} from "@mui/icons-material";
import useTokenData from "@/hooks/useTokenData";
import Menus from "../Menus";
import BrandLogo from "../BrandLogo";

interface SideBarProps {
  handleDrawerToggle: Function;
  type?: string;
}

const SideBar = ({ handleDrawerToggle, type = "user" }: SideBarProps) => {
  const router = useRouter();
  const tokenData = useTokenData();

  return (
    <Box
      onClick={() => handleDrawerToggle()}
      sx={{
        textAlign: "center",
        color: "#fff",
        display: "flex",
        flexFlow: "column",
        zIndex: 1,
        height: "100vh",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <BrandLogo redirect={false} />
        <Menus type={type} />
      </Box>
      {type === "user" && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexDirection: { lg: "column", sm: "row" },
            mx: "auto",
            mb: 2,
          }}
        >
          <BottomBullets onClick={() => router.push("/settings?section=profile")}>
            <SettingsRounded fill="#fff" />
          </BottomBullets>
          <BottomBullets onClick={() => router.push("/help")}>
            <InfoRounded fill="#fff" />
          </BottomBullets>
        </Box>
      )}
      {type === "admin" && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexDirection: { lg: "column", sm: "row" },
            mx: "auto",
            mb: 2,
          }}
        >
          <BottomBullets onClick={() => router.push("/admin/profile")}>
            <SettingsRounded fill="#fff" />
          </BottomBullets>
        </Box>
      )}
    </Box>
  );
};

export default SideBar;
