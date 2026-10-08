import React, { useState } from "react";
import { Box, Popover, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import NavIcon from "./NavIcon";
import { MenuLink, RailGroupButton } from "./styled";
import { GROUP_ICON, type SidebarItem, type SidebarSection } from "./navSections";
import SetupProgressItem from "./SetupProgressItem";

interface Props {
  sections: SidebarSection[];
  isActiveRoute: (path: string) => boolean;
  isDenied: (item: SidebarItem) => boolean;
  prefetch: (item: SidebarItem) => void;
}

/** Touch-tablet rail (§8.1): 5 labelled groups; a multi-item group opens a fly-out list. */
const LabelledRail: React.FC<Props> = ({ sections, isActiveRoute, isDenied, prefetch }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const [flyout, setFlyout] = useState<{ el: HTMLElement; key: string } | null>(null);
  const open = sections.find((s) => s.key === flyout?.key);

  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "none" }}>
      <li><SetupProgressItem collapsed /></li>
      {sections.map((s) => {
        const active = s.items.some((i) => isActiveRoute(i.path));
        const label = s.label || t("navHome", { defaultValue: "Home" });
        const single = s.items.length === 1;
        return (
          <li key={s.key}>
            <RailGroupButton
              type="button"
              active={active}
              aria-current={active ? "page" : undefined}
              aria-haspopup={single ? undefined : "menu"}
              aria-expanded={single ? undefined : flyout?.key === s.key}
              data-testid={`rail-group-${s.key}`}
              onClick={(e) => {
                if (single) {
                  if (!isDenied(s.items[0])) router.push(s.items[0].path);
                  return;
                }
                setFlyout({ el: e.currentTarget, key: s.key });
              }}
            >
              <NavIcon name={GROUP_ICON[s.key]} color={active ? theme.palette.primary.main : theme.palette.text.secondary} size={22} />
              <span>{label}</span>
            </RailGroupButton>
          </li>
        );
      })}
      <Popover
        open={!!open}
        anchorEl={flyout?.el}
        onClose={() => setFlyout(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { "data-testid": "rail-flyout", sx: { ml: 1, p: 1, minWidth: 220, borderRadius: "14px", backgroundColor: theme.palette.background.paper, backgroundImage: "none", border: `1px solid ${theme.palette.divider}` } } as any }}
      >
        {open && (
          <Box role="menu" aria-label={open.label} sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Box sx={{ px: 1.5, pt: 0.5, pb: 0.75, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
              {open.label || t("navHome", { defaultValue: "Home" })}
            </Box>
            {open.items.map((item) => {
              const active = isActiveRoute(item.path);
              const denied = isDenied(item);
              return (
                <MenuLink
                  key={item.path}
                  href={item.path}
                  role="menuitem"
                  active={active}
                  aria-current={active ? "page" : undefined}
                  aria-disabled={denied || undefined}
                  data-testid={`rail-flyout-item-${item.icon}`}
                  onMouseEnter={() => prefetch(item)}
                  onClick={(e: React.MouseEvent) => {
                    if (denied) e.preventDefault();
                    setFlyout(null);
                  }}
                  sx={{ minHeight: 44, ...(denied ? { opacity: 0.45 } : {}) }}
                >
                  <NavIcon name={item.icon} color={active ? theme.palette.primary.main : theme.palette.text.secondary} />
                  <Box component="span" sx={{ fontSize: 14, fontFamily: "var(--font-sans)" }}>{item.label}</Box>
                </MenuLink>
              );
            })}
          </Box>
        )}
      </Popover>
    </Box>
  );
};

export default LabelledRail;
