import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import { useUnreadNotificationsCount } from "@/hooks/useUnreadNotificationsCount";

/**
 * NotificationsBell — the inbox's new home in the header (audit F8).
 *
 * Notifications used to occupy a permanent nav row, which is expensive real
 * estate for something that is checked, not navigated. The row is gone; this
 * bell keeps the inbox one tap away (law 6: a route that leaves the nav must
 * still have a home) and carries the same unread badge the sidebar had.
 *
 * The count comes from the existing shared hook, which caches for 45s, dedupes
 * concurrent callers and polls once a minute — so moving the badge here adds no
 * new request.
 */
const NotificationsBell: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const unread = useUnreadNotificationsCount();
  const label = t("notifications", { defaultValue: "Notifications" });

  return (
    <Tooltip
      title={unread > 0 ? `${label} (${unread > 99 ? "99+" : unread})` : label}
      arrow
    >
      <Link href="/notifications" aria-label={label} data-testid="header-notifications-bell">
        <IconButton
          size="small"
          aria-label={label}
          sx={{ position: "relative", width: { xs: 40, sm: 44 }, height: 44, color: theme.palette.text.secondary }}
        >
          <NotificationsNoneRounded sx={{ fontSize: 21 }} />
          {unread > 0 && (
            <Box
              component="span"
              data-testid="header-notifications-badge"
              aria-label={`${unread} unread notifications`}
              sx={{
                position: "absolute",
                top: 1,
                right: 0,
                minWidth: 17,
                height: 17,
                px: unread > 9 ? 0.4 : 0,
                borderRadius: 999,
                backgroundColor: "#E11D48",
                color: "#FFFFFF",
                fontSize: 9.5,
                fontFamily: "var(--font-sans), sans-serif",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${theme.palette.background.paper || "#FFFFFF"}`,
                lineHeight: 1,
              }}
            >
              {unread > 99 ? "99+" : unread}
            </Box>
          )}
        </IconButton>
      </Link>
    </Tooltip>
  );
};

export default NotificationsBell;
