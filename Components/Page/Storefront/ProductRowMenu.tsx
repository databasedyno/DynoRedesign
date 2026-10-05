import React, { useState } from "react";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import type { ProductRow } from "./productTypes";

interface Props {
  product: ProductRow;
  canOpenPublic: boolean;
  onQuickSell: (p: ProductRow) => void;
  onSales: () => void;
  onOpenPublic: (p: ProductRow) => void;
  onArchive: (id: number) => void;
}

/** Labeled "⋯" menu for a product row — replaces four unlabeled icon buttons. */
const ProductRowMenu: React.FC<Props> = ({ product: p, canOpenPublic, onQuickSell, onSales, onOpenPublic, onArchive }) => {
  const { t } = useTranslation("common");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const items = [
    p.status === "live" && { id: "quicksell", icon: "lucide:zap", label: t("products.menu.quickSell", { defaultValue: "Create a payment link" }), onClick: run(() => onQuickSell(p)) },
    { id: "orders", icon: "lucide:receipt", label: t("products.menu.sales", { defaultValue: "View sales" }), onClick: run(onSales) },
    canOpenPublic && { id: "open", icon: "lucide:external-link", label: t("products.menu.openPublic", { defaultValue: "Open public page" }), onClick: run(() => onOpenPublic(p)) },
    p.status !== "archived" && { id: "delete", icon: "lucide:archive", label: t("products.menu.archive", { defaultValue: "Archive" }), onClick: run(() => onArchive(p.product_id)) },
  ].filter(Boolean) as Array<{ id: string; icon: string; label: string; onClick: () => void }>;

  return (
    <>
      <Tooltip title={t("products.menu.more", { defaultValue: "More actions" })} arrow>
        <IconButton size="small" aria-label={t("products.menu.more", { defaultValue: "More actions" }) as string} aria-haspopup="menu" data-testid={`product-row-menu-${p.product_id}`} onClick={(e) => setAnchor(e.currentTarget)}>
          <Icon name="ellipsis" size={18} />
        </IconButton>
      </Tooltip>
      <Menu
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 220, borderRadius: "12px", mt: 0.5 } } }}
      >
        {items.map((it) => (
          <MenuItem key={it.id} data-testid={`product-row-${it.id}-${p.product_id}`} onClick={it.onClick} sx={{ fontSize: 14, color: it.id === "delete" ? "error.main" : undefined }}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <Icon name={it.icon} size={16} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)" }}>{it.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ProductRowMenu;
