import React, { useState } from "react";
import { Box, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography, useTheme } from "@mui/material";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { getAssetColor } from "@/helpers/assetColor";
import { getNetworkLabel, isTokenOnOtherChain } from "@/utils/networkLabels";
import { buildSharedAddressMap, sharedNetworksFor } from "@/utils/sharedAddresses";
import SharedAddressTag from "@/Components/UI/SharedAddressTag";
import CopyInline from "@/Components/UX/CopyInline";
import { maskAddress } from "@/helpers/maskAddress";
import { formatWithSeparators } from "@/utils/currencyFormat";
import type { WalletDataType } from "@/utils/types/wallet";
import type { PayoutWallet } from "@/Components/Page/Payouts/useDashboardPayouts";
import { AddressFormatBadge, LastForwardRow } from "./WalletCardMeta";
import WalletOwnershipRow from "./WalletOwnershipRow";

/**
 * Payout addresses as ONE calm list (2026-10 UX audit #1).
 *
 * Replaces the 15-card grid (6 buttons per card, rainbow top borders, a "Format OK"
 * chip + a gold "View Transactions" button on every card). Each row: coin · masked
 * address (reveal + copy) · total processed · last payout · one ⋯ menu
 * (View transactions / Edit / Remove). Every data-testid from the card grid is kept.
 */

/** Base ticker for the coin chip — long variant codes (USDT-POLYGON) used to overflow. */
const tickerFor = (w: WalletDataType) => {
  const n = w.name || "";
  if (n.startsWith("USDT")) return "USDT";
  if (n.startsWith("USDC")) return "USDC";
  if (n.startsWith("RLUSD")) return "RLUSD";
  if (w.walletTitle === "POLYGON") return "POL";
  return w.walletTitle;
};

/** Always two decimals ($1,962.40 / $0.00) — was "$1,962.4" / "$0". */
export const formatUsd2 = (n: unknown) => `$${formatWithSeparators(Number(n) || 0, "USD", 2)}`;

interface Props {
  wallets: WalletDataType[];
  isMobile: boolean;
  sharedMap: ReturnType<typeof buildSharedAddressMap>;
  isHighlighted: (w: WalletDataType) => boolean;
  highlightActive: boolean;
  onToggleHighlight: (w: WalletDataType) => void;
  isRevealed: (id: string | number) => boolean;
  onToggleReveal: (id: string | number) => void;
  payoutFor: (id: string | number) => PayoutWallet | undefined;
  payoutsLoading: boolean;
  paySym: string;
  payCur: string;
  onEdit: (w: WalletDataType) => void;
  onDelete: (w: WalletDataType) => void;
  onVerified: () => void;
  onCopyFailed: () => void;
}

const WalletList: React.FC<Props> = ({
  wallets,
  isMobile,
  sharedMap,
  isHighlighted,
  highlightActive,
  onToggleHighlight,
  isRevealed,
  onToggleReveal,
  payoutFor,
  payoutsLoading,
  paySym,
  payCur,
  onEdit,
  onDelete,
  onVerified,
  onCopyFailed,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("walletScreen");
  const [menu, setMenu] = useState<{ anchor: HTMLElement; wallet: WalletDataType } | null>(null);

  const border = dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const surface = dark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light;
  const muted = theme.palette.text.secondary;
  const ring = dark ? "#FFD100" : "#8B5E00";
  // Fits a 720px content column (iPad landscape / 1024 laptops) so the ⋯ actions never fall off-screen (UX audit S4c).
  const COLS = "minmax(150px, 1.1fr) minmax(160px, 1.7fr) minmax(96px, 0.7fr) minmax(140px, 1.3fr) 44px";

  const eyebrow = {
    fontFamily: "var(--font-tech), monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: muted,
  };

  const iconBtnSx = {
    width: 32,
    height: 32,
    minWidth: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    border: `1px solid ${border}`,
    background: "transparent",
    color: theme.palette.text.primary,
    cursor: "pointer",
    flexShrink: 0,
    "&:hover": { backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
    "&:focus-visible": { outline: `2px solid ${ring}`, outlineOffset: 1 },
    [theme.breakpoints.down("md")]: { width: 40, height: 40, minWidth: 40, borderRadius: "10px" },
  };

  const coinCell = (w: WalletDataType) => {
    const accent = getAssetColor(w.walletTitle);
    const netLabel = getNetworkLabel(w.name);
    const tokenOnOther = isTokenOnOtherChain(w.name);
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: `${accent}1F`, "& img": { width: 20, height: 20 } }}>
          <Image src={w.icon} alt="" draggable={false} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: theme.palette.text.primary, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {w.name}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: "2px" }}>
            <Box component="span" sx={{ fontFamily: MONO, fontSize: 11.5, color: muted }}>{tickerFor(w)}</Box>
            {netLabel && (
              <Tooltip
                arrow
                placement="top"
                title={
                  tokenOnOther
                    ? t("networkTokenChipTooltip", { defaultValue: "Token on this network — only send on the matching chain." })
                    : t("networkChipTooltip", { defaultValue: "Network / chain this address belongs to." })
                }
              >
                <Box
                  component="span"
                  data-testid={`wallet-network-chip-${w.name}`}
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 600,
                    fontSize: 11,
                    lineHeight: 1,
                    px: "7px",
                    py: "3px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    border: `1px solid ${tokenOnOther ? theme.palette.warning.main : border}`,
                    color: tokenOnOther ? theme.palette.warning.main : muted,
                  }}
                >
                  {netLabel}
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  const addressCell = (w: WalletDataType, lit: boolean) => (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
        <Typography
          data-testid={`wallet-address-${w.id}`}
          data-revealed={isRevealed(w.id) ? "true" : "false"}
          title={isRevealed(w.id) ? w.walletAddress : undefined}
          sx={{
            fontFamily: MONO,
            fontSize: 13,
            color: theme.palette.text.primary,
            letterSpacing: "0.2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            userSelect: isRevealed(w.id) ? "text" : "none",
          }}
        >
          {isRevealed(w.id) ? w.walletAddress : maskAddress(w.walletAddress)}
        </Typography>
        <Tooltip title={isRevealed(w.id) ? t("hideAddress", { defaultValue: "Hide address" }) : t("revealAddress", { defaultValue: "Show full address" })}>
          <Box
            component="button"
            type="button"
            onClick={() => onToggleReveal(w.id)}
            aria-pressed={isRevealed(w.id)}
            aria-label={(isRevealed(w.id) ? t("hideAddress", { defaultValue: "Hide address" }) : t("revealAddress", { defaultValue: "Show full address" })) as string}
            data-testid={`wallet-address-reveal-${w.id}`} data-touch-44="square"
            sx={iconBtnSx}
          >
            <Icon name={isRevealed(w.id) ? "eye-off" : "eye"} size={15} />
          </Box>
        </Tooltip>
        <CopyInline
          variant="boxed"
          value={w.walletAddress}
          size={15}
          testId={`wallet-address-copy-${w.id}`}
          copyLabel={t("copyAddress", { defaultValue: "Copy address" }) as string}
          copiedLabel={t("addressCopied") as string}
          onCopied={(ok) => {
            if (!ok) onCopyFailed();
          }}
          sx={{ width: 32, height: 32, borderRadius: "8px", [theme.breakpoints.down("md")]: { width: 40, height: 40 } }}
        />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: "4px", flexWrap: "wrap", minHeight: 0, "&:empty": { display: "none" } }}>
        <SharedAddressTag
          networks={sharedNetworksFor(sharedMap, w)}
          size="sm"
          testId={`wallet-shared-tag-${w.id}`}
          active={lit}
          onClick={() => onToggleHighlight(w)}
        />
        <AddressFormatBadge chain={w.walletTitle} address={w.walletAddress} testId={`wallet-address-format-${w.id}`} compact />
        <WalletOwnershipRow wallet={w} onVerified={onVerified} />
      </Box>
    </Box>
  );

  const amountCell = (w: WalletDataType, align: "left" | "right") => (
    <Typography
      data-testid={`wallet-total-${w.id}`}
      sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: isMobile ? 15 : 14, fontWeight: 600, color: theme.palette.text.primary, textAlign: align, whiteSpace: "nowrap" }}
    >
      {formatUsd2(w.totalProcessed)}
    </Typography>
  );

  const moreBtn = (w: WalletDataType) => (
    <Tooltip title={t("moreActions", { defaultValue: "More actions" })}>
      <Box
        component="button"
        type="button"
        aria-haspopup="menu"
        aria-label={t("moreActions", { defaultValue: "More actions" }) as string}
        data-testid={`wallet-more-${w.id}`} data-touch-44="square"
        onClick={(e: React.MouseEvent<HTMLElement>) => setMenu({ anchor: e.currentTarget, wallet: w })}
        sx={iconBtnSx}
      >
        <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
      </Box>
    </Tooltip>
  );

  return (
    <Box
      data-testid="wallet-list"
      sx={{ border: `1px solid ${border}`, borderRadius: "16px", backgroundColor: surface, overflow: "hidden" }}
    >
      {!isMobile && (
        <Box sx={{ display: "grid", gridTemplateColumns: COLS, columnGap: 2, alignItems: "center", px: 2.5, py: 1.5, borderBottom: `1px solid ${border}` }}>
          <Box component="span" sx={eyebrow}>{t("colCoin", { defaultValue: "Coin" })}</Box>
          <Box component="span" sx={eyebrow}>{t("address")}</Box>
          <Box component="span" sx={{ ...eyebrow, textAlign: "right" }}>{t("colNetReceived", { defaultValue: "Net received" })}</Box>
          <Box component="span" sx={eyebrow}>{t("colLastPayout", { defaultValue: "Last payout" })}</Box>
          <span />
        </Box>
      )}

      {wallets.map((w, index) => {
        const lit = isHighlighted(w);
        const dimmed = highlightActive && !lit;
        const rowSx = {
          position: "relative" as const,
          borderTop: index === 0 ? "none" : `1px solid ${border}`,
          opacity: dimmed ? 0.38 : 1,
          backgroundColor: lit ? (dark ? "rgba(255,209,0,0.06)" : "rgba(139,94,0,0.05)") : "transparent",
          boxShadow: lit ? `inset 3px 0 0 ${ring}` : "none",
          transition: "opacity 220ms ease, background-color 220ms ease",
          scrollMarginTop: "120px",
        };
        const rowKey = w.id ?? index;
        const common = {
          id: `wallet-card-${w.id}`,
          "data-testid": `wallet-card-${w.id}`,
          "data-highlight": lit ? "true" : dimmed ? "dimmed" : "none",
        };
        if (isMobile) {
          return (
            <Box key={rowKey} {...common} sx={{ ...rowSx, px: 2, py: 1.75, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                {coinCell(w)}
                {amountCell(w, "right")}
              </Box>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>{addressCell(w, lit)}</Box>
                {moreBtn(w)}
              </Box>
              <LastForwardRow wallet={payoutFor(w.id)} loading={payoutsLoading} symbol={paySym} currency={payCur} testId={`wallet-last-forward-${w.id}`} />
            </Box>
          );
        }
        return (
          <Box key={rowKey} {...common} sx={{ ...rowSx, display: "grid", gridTemplateColumns: COLS, columnGap: 2, alignItems: "center", px: 2.5, py: 1.5, minHeight: 68, "&:hover": { backgroundColor: lit ? undefined : dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)" } }}>
            {coinCell(w)}
            {addressCell(w, lit)}
            {amountCell(w, "right")}
            <LastForwardRow wallet={payoutFor(w.id)} loading={payoutsLoading} symbol={paySym} currency={payCur} testId={`wallet-last-forward-${w.id}`} stacked />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{moreBtn(w)}</Box>
          </Box>
        );
      })}

      <Menu
        open={!!menu}
        anchorEl={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        data-testid="wallet-row-menu"
        slotProps={{ paper: { sx: { minWidth: 220, borderRadius: "12px", backgroundImage: "none", border: `1px solid ${border}` } } }}
      >
        {menu && (
          <MenuItem
            data-testid={`wallet-view-tx-${menu.wallet.id}`}
            onClick={() => {
              const w = menu.wallet;
              setMenu(null);
              router.push(`/transactions?wallet=${encodeURIComponent(w.walletTitle)}`);
            }}
          >
            <ListItemIcon><Icon name="arrow-up-right" size={16} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)" }}>{t("viewTransactions")}</ListItemText>
          </MenuItem>
        )}
        {menu && (
          <MenuItem
            data-testid="wallet-edit-btn"
            onClick={() => {
              const w = menu.wallet;
              setMenu(null);
              onEdit(w);
            }}
          >
            <ListItemIcon><Icon name="pencil" size={16} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)" }}>{t("editWalletTitle")}</ListItemText>
          </MenuItem>
        )}
        {menu && (
          <MenuItem
            data-testid="wallet-delete-btn"
            onClick={() => {
              const w = menu.wallet;
              setMenu(null);
              onDelete(w);
            }}
            sx={{ color: theme.palette.error.main }}
          >
            <ListItemIcon sx={{ color: theme.palette.error.main }}><Icon name="trash-2" size={16} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 14, fontFamily: "var(--font-sans)", color: theme.palette.error.main }}>
              {t("deleteWallet", { defaultValue: "Remove payout address" })}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default WalletList;
