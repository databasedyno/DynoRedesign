import { TokenData } from "@/utils/types";
import {
  AddBoxOutlined,
  AddCircleOutlineRounded,
  ApiRounded,
  AssignmentRounded,
  BusinessRounded,
  DescriptionRounded,
  DraftsRounded,
  GroupsRounded,
  HomeRounded,
  InsertDriveFileRounded,
  InsightsRounded,
  MonetizationOnRounded,
  PhotoLibraryRounded,
  ReceiptLongRounded,
  RocketLaunchRounded,
  RssFeedRounded,
  SmsRounded,
  WalletRounded,
  AccountBalanceWallet,
} from "@mui/icons-material";

import {
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Popover,
  Typography,
} from "@mui/material";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useTokenData from "@/hooks/useTokenData";

const navItems = [
  {
    icon: <HomeRounded color="inherit" />,
    name: "Home",
    link: "/",
  },
  {
    icon: <BusinessRounded color="inherit" />,
    name: "Company",
    link: "/company",
  },
  {
    icon: <WalletRounded color="inherit" />,
    name: "Wallet",
    link: "/wallet",
  },
  {
    icon: <ApiRounded color="inherit" />,
    name: "API",
    link: "/developer-keys",
  },
  {
    icon: <ReceiptLongRounded color="inherit" />,
    name: "Transactions",
    link: "/transactions",
  },
  {
    icon: <DescriptionRounded color="inherit" />,
    name: "Invoices & Tax",
    link: "/invoices",
  },
  {
    icon: <AccountBalanceWallet color="inherit" />,
    name: "Wallet Address",
    link: "/wallet",
  },
];

const adminMenus = [
  {
    icon: <HomeRounded color="inherit" />,
    name: "Overview",
    link: "/admin",
  },
  {
    icon: <SmsRounded color="inherit" />,
    name: "Support Inbox",
    link: "/admin/support",
  },
  {
    icon: <GroupsRounded color="inherit" />,
    name: "Merchants",
    link: "/admin/merchants",
  },
  {
    icon: <ReceiptLongRounded color="inherit" />,
    name: "Transactions",
    link: "/admin/transactions",
  },
  {
    icon: <RssFeedRounded color="inherit" />,
    name: "Live Console",
    link: "/admin/live-console",
  },
];

const Menus = ({ type = "user" }: { type: string }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const tokenData = useTokenData();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [popOverItem, setPopOverItem] = useState("");

  const [localItems, setLocalItems] = useState(navItems);
  const handlePopoverOpen = (
    event: React.MouseEvent<HTMLElement>,
    name?: string
  ) => {
    setAnchorEl(event.currentTarget);
    setPopOverItem(name ?? "");
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    if (type === "user") {
      setLocalItems(navItems);
    } else {
      setLocalItems(adminMenus);
    }
  }, [tokenData, type]);

  const open = Boolean(anchorEl);

  return (
    <>
      {/* Tooltip popup */}
      <Popover
        id="mouse-over-popover"
        sx={{
          pointerEvents: "none",
          display: { lg: "block", xs: "none" },
          "& .MuiPaper-root": {
            background: "transparent !important",
            boxShadow: "none",
          },
        }}
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
        onClose={handlePopoverClose}
      >
        <Box
          sx={{
            "&::before": {
              content: '" "',
              position: "absolute",
              background: (theme) => theme.palette.primary.main,
              width: "10px",
              height: "10px",
              top: "50%",
              left: 0,
              transform: "rotate(45deg) translateY(-50%)",
            },
          }}
        >
          <Typography
            sx={{
              p: 2,
              ml: 1,
              background: (theme) => theme.palette.primary.main,
              borderRadius: "4px",
              color: "#fff",
            }}
          >
            {popOverItem}
          </Typography>
        </Box>
      </Popover>
      {/* Tooltip popup */}
      <List>
        {localItems.map((item) => (
          <ListItem
            key={item.name}
            disablePadding
            data-testid={`sidebar-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
            sx={{ position: "relative" }}
            onClick={(e) => {
              router.push(item?.link ?? "/");
            }}
          >
            <ListItemButton
              aria-owns={open ? "mouse-over-popover" : undefined}
              aria-haspopup="true"
              onMouseEnter={(e) => {
                handlePopoverOpen(e, item.name);
              }}
              onMouseLeave={() => {
                handlePopoverClose();
              }}
              className="customMenu"
              sx={{
                py: 2,
                px: 2.5,
                minHeight: 7,
                justifyContent: "center",
                color: "#88898D",
                lineHeight: 0,
              }}
              selected={item.link === router.pathname}
              disableRipple
            >
              {item.icon}
            </ListItemButton>
            <ListItem sx={{ display: { lg: "none", sm: "block" }, px: 0 }}>
              {item.name}
            </ListItem>
          </ListItem>
        ))}
      </List>
    </>
  );
};

export default Menus;
