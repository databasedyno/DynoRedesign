import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import LinkIcon from "@/assets/Icons/link-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import DeleteWalletModal from "@/Components/UI/DeleteWalletModal";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import PanelCard from "@/Components/UI/PanelCard";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { WalletDataType } from "@/utils/types/wallet";
import { getNetworkLabel, isTokenOnOtherChain } from "@/utils/networkLabels";
import { Icon, MONO } from "@/styles/uiKit";
import { getAssetColor } from "@/helpers/assetColor";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Box, Grid, Skeleton, Tooltip, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { CopyButton } from "../Transactions/TransactionDetailsModal.styled";
import WalletTotalHero from "./WalletTotalHero";
import copyToClipboard from "@/helpers/copyToClipboard";
import {
  HeaderIcon,
  WalletCardBody,
  WalletCardBodyRow,
  WalletEditButton,
  WalletHeaderAction,
  WalletLabel,
} from "./styled";

const Wallet = ({ onAddWallet }: { onAddWallet?: () => void }) => {
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  const tWallet = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "walletScreen", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );

  const router = useRouter();
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editWalletCrypto, setEditWalletCrypto] = useState("");
  const [editWalletId, setEditWalletId] = useState<string | number | undefined>(undefined);
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; type: string; address: string } | null>(null);

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { refetchWallets } = useWalletStore();

  const { walletLoading, walletData } = useWalletData();

  const copyAddressToClipboard = (address: string) => {
    copyToClipboard(address);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: tWallet("addressCopied"),
        severity: "success",
      },
    });
  };

  const handleEdit = (wallet: WalletDataType) => {
    setEditWalletCrypto(wallet.walletTitle);
    setEditWalletId(wallet.id);
    setEditWalletName(wallet.name);
    setEditWalletAddress(wallet.walletAddress);
    setOpenEditModal(true);
  };

  const handleDelete = (wallet: WalletDataType) => {
    setDeleteTarget({ id: wallet.id, type: wallet.walletTitle, address: wallet.walletAddress });
    setOpenDeleteModal(true);
  };

  const handleWalletDeleted = () => {
    dispatch({
      type: TOAST_SHOW,
      payload: { message: "Wallet deleted successfully", severity: "success" },
    });
    // Re-fetch wallets
    refetchWallets();
  };

  if (walletLoading && walletData.length === 0) {
    // Skeleton grid mirroring the wallet-card layout — shown on first load AND
    // the instant a merchant switches company (SWR key changes → cache miss),
    // so the refresh feels immediate instead of a blank spinner.
    return (
      <Box
        data-testid="wallet-list-skeleton"
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          mt: isMobile ? 1 : 0,
          pb: { xs: "70px", lg: "0" },
        }}
      >
        <Skeleton
          variant="rounded"
          height={isMobile ? 110 : 132}
          sx={{ borderRadius: "16px" }}
        />
        <Grid container spacing={isMobile ? "12px" : 2.7}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton
                variant="rounded"
                height={isMobile ? 190 : 220}
                sx={{ borderRadius: "16px" }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (walletData.length === 0 && !walletLoading) {
    return (
      <>
        <EmptyDataModel pageName="wallet" onAddWallet={onAddWallet} />
      </>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        mt: isMobile ? 1 : 0,
        pb: { xs: "70px", lg: "0" },
      }}
    >
      {/* Aurora total-processed hero — 2026-08-05 design audit Phase 3.
          Only render when the user actually has wallets configured, so first-
          time visitors see the empty-state warning banner (already surfaced
          via setPageWarning) instead of an unhelpful "$0.00" hero. */}
      {walletData.length > 0 && <WalletTotalHero />}
      <Grid container spacing={isMobile ? "12px" : 2.7}>
        {walletData.map((wallet, index) => {
          const accent = getAssetColor(wallet.walletTitle);
          return (
          <Grid
            item
            xs={12}
            md={6}
            xl={4}
            key={index}
            sx={{
              opacity: 0,
              transform: "translateY(20px)",
              animation: "cardFadeUp 0.5s ease forwards",
              animationDelay: `${index * 0.12}s`,

              "@keyframes cardFadeUp": {
                "0%": {
                  opacity: 0,
                  transform: "translateY(20px)",
                },
                "100%": {
                  opacity: 1,
                  transform: "translateY(0)",
                },
              },
            }}
          >
            <PanelCard
              sx={{
                position: "relative",
                overflow: "hidden",
                backgroundColor: dark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
                border: `1px solid ${dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
                // Coin brand-colour top accent — identifies each chain at a glance.
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
                  zIndex: 2,
                },
              }}
              title={wallet.name}
              headerIcon={
                <HeaderIcon
                  sx={{
                    backgroundColor: `${accent}1F`,
                    borderColor: `${accent}3D`,
                    "&:hover": { backgroundColor: `${accent}2E` },
                  }}
                >
                  <Image
                    src={wallet.icon}
                    alt={wallet.name}
                    draggable={false}
                  />
                </HeaderIcon>
              }
              showHeaderBorder={false}
              // H3 — tighter mobile padding so 13 wallet cards don't require a mile of scroll.
              headerPadding={
                isMobile
                  ? theme.spacing(1.25, 1.75, 0, 1.75)
                  : theme.spacing(2.5, 2.5, 0, 2.5)
              }
              bodyPadding={
                isMobile
                  ? theme.spacing(1, 1.75, 1.5, 1.75)
                  : theme.spacing(3, 2.5, 2.5, 2.5)
              }
              headerAction={
                <WalletHeaderAction>
                  <Image
                    src={wallet.icon}
                    alt={wallet.name}
                    draggable={false}
                  />
                  <span>
                    {wallet.name === "USDT-TRC20" ||
                    wallet.name === "USDT-ERC20"
                      ? "USDT"
                      : wallet.walletTitle}
                  </span>
                  {/* Network chip — prevents wrong-chain send mistakes. */}
                  {(() => {
                    const netLabel = getNetworkLabel(wallet.name);
                    if (!netLabel) return null;
                    const tokenOnOther = isTokenOnOtherChain(wallet.name);
                    return (
                      <Tooltip
                        placement="top"
                        arrow
                        title={
                          tokenOnOther
                            ? tWallet("networkTokenChipTooltip", "Token on this network — only send on the matching chain.")
                            : tWallet("networkChipTooltip", "Network / chain this address belongs to.")
                        }
                      >
                        <Box
                          component="span"
                          data-testid={`wallet-network-chip-${wallet.name}`}
                          sx={{
                            ml: 0.75,
                            fontFamily: "var(--font-sans), sans-serif",
                            fontWeight: 600,
                            fontSize: isMobile ? 10 : 11,
                            lineHeight: 1,
                            letterSpacing: "0.2px",
                            padding: isMobile ? "3px 6px" : "3px 8px",
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            border: `1px solid ${tokenOnOther ? theme.palette.warning?.main || "#F59E0B" : theme.palette.border?.main || theme.palette.divider}`,
                            color: tokenOnOther
                              ? theme.palette.warning?.main || "#F59E0B"
                              : theme.palette.text.secondary,
                            backgroundColor: tokenOnOther
                              ? (theme.palette.mode === "dark" ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.08)")
                              : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
                            textTransform: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {netLabel}
                        </Box>
                      </Tooltip>
                    );
                  })()}
                </WalletHeaderAction>
              }
            >
              <WalletCardBody>
                <WalletCardBodyRow>
                  {isMobile ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <WalletLabel>
                        <Image src={LinkIcon} alt="Address" draggable={false} className="themed-icon" />
                        <span>{tWallet("address")}</span>
                      </WalletLabel>
                      <Typography
                        title={wallet.walletAddress}
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: theme.palette.text.primary,
                          letterSpacing: "0.2px",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: `1px solid ${theme.palette.border.main}`,
                          backgroundColor: theme.palette.background.paper,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          // Show first 8 + last 6 chars via a CSS unicode-bidi trick: keep it simple here,
                          // we just truncate from the middle by combining two spans.
                        }}
                      >
                        {wallet.walletAddress && wallet.walletAddress.length > 18
                          ? `${wallet.walletAddress.slice(0, 8)}…${wallet.walletAddress.slice(-6)}`
                          : wallet.walletAddress}
                      </Typography>
                    </Box>
                  ) : (
                    <InputField
                      value={wallet.walletAddress}
                      readOnly
                      label={
                        <WalletLabel>
                          <Image src={LinkIcon} alt="Address" draggable={false} className="themed-icon" />
                          <span>{tWallet("address")}</span>
                        </WalletLabel>
                      }
                      sx={{
                        gap: isMobile ? 1 : 1.25,
                        width: "100%",
                      }}
                    />
                  )}
                  <CopyButton
                    onClick={() => copyAddressToClipboard(wallet.walletAddress)}
                  >
                    <Image
                      src={CopyIcon}
                      alt="Copy Icon"
                      width={isMobile ? 12 : 14}
                      height={isMobile ? 12 : 14}
                      draggable={false}
                      style={{
                        filter: theme.palette.mode === "dark"
                          ? "brightness(0) saturate(100%) invert(70%)"
                          : "none",
                      }}
                    />
                  </CopyButton>
                </WalletCardBodyRow>
                <WalletCardBodyRow>
                  {isMobile ? (
                    /* H3 — MOBILE: inline "Total processed" label + value on one row
                       instead of stacked, saving ~30px per card. Was
                       ~205px tall, now ~150px. */
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 1,
                      }}
                    >
                      <WalletLabel sx={{ margin: 0 }}>
                        <Image
                          src={RoundedStackIcon}
                          alt="Total processed"
                          draggable={false}
                        />
                        <span>{tWallet("totalProcessed")}</span>
                      </WalletLabel>
                      <Typography
                        sx={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: theme.palette.text.primary,
                          lineHeight: "18px",
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {getCurrencySymbol(
                          "USD",
                          formatNumberWithComma(wallet.totalProcessed),
                        )}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.25,
                      }}
                    >
                      <WalletLabel>
                        <Image
                          src={RoundedStackIcon}
                          alt="Total processed"
                          draggable={false}
                        />
                        <span>{tWallet("totalProcessed")}</span>
                      </WalletLabel>
                      <Typography
                        sx={{
                          fontSize: "20px",
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                          lineHeight: "24px",
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {getCurrencySymbol(
                          "USD",
                          formatNumberWithComma(wallet.totalProcessed),
                        )}
                      </Typography>
                    </Box>
                  )}
                </WalletCardBodyRow>

                <Box sx={{ marginTop: isMobile ? "0px" : "4px" }}>
                  <WalletCardBodyRow>
                    <CustomButton
                      onClick={() => {
                        router.push(`/transactions?wallet=${encodeURIComponent(wallet.walletTitle)}`);
                      }}
                      label={tWallet("viewTransactions")}
                      variant="outlined"
                      endIcon={<Icon name="arrow-up-right" size={isMobile ? 13 : 16} />}
                      sx={{
                        backgroundColor: theme.palette.background.paper,
                        color: brandFg(theme.palette.mode === "dark"),
                        border: `1px solid ${theme.palette.primary.main}`,
                        borderRadius: "6px",
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        fontFamily: "var(--font-sans)",
                        lineHeight: "18px",
                        px: isMobile ? "12px" : "24px",
                        py: isMobile ? "5px" : "11px",
                        height: isMobile ? "28px" : "40px",
                        gap: isMobile ? "6px" : "10px",
                        "&:hover": {
                          backgroundColor: theme.palette.background.paper,
                          color: brandFg(theme.palette.mode === "dark"),
                          border: `1px solid ${theme.palette.primary.main}`,
                        },
                      }}
                    />

                    <WalletEditButton onClick={() => handleEdit(wallet)}>
                      <Icon
                        name="pencil"
                        size={isMobile ? 14 : 16}
                        color={theme.palette.text.primary}
                      />
                    </WalletEditButton>

                    <WalletEditButton
                      onClick={() => handleDelete(wallet)}
                      sx={{
                        "&:hover": {
                          backgroundColor: "#FEE2E2",
                          borderColor: "#FECACA",
                        },
                      }}
                    >
                      <Icon
                        name="trash-2"
                        size={isMobile ? 15 : 18}
                        color="#DC2626"
                      />
                    </WalletEditButton>
                  </WalletCardBodyRow>
                </Box>
              </WalletCardBody>
            </PanelCard>
          </Grid>
          );
        })}
      </Grid>

      {/* <Dialog
        open={true}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: "12px" }
        }}
      >
        <DialogContent sx={{ px: "30px", pt: "30px" }}>
          <Box sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Image src={WalletIcon} alt="wallet" width={14} height={14} className="themed-icon" />
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "20px",
                lineHeight: "100%"
              }}
            >
              {t("noActiveWalletsTitle")}
            </Typography>
          </Box>

          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              lineHeight: "140%",
              mt: "12px",
              color: theme.palette.text.secondary
            }}
          >
            {t("noActiveWalletsBody")}
          </Typography>
        </DialogContent>

        <DialogActions  
          sx={{
            px: "30px",
            pb: "30px",
            display: "flex",
            gap: "20px"
          }}
        >
          <Button
            fullWidth
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.divider}`,
              py: "11px",
              borderRadius: "6px"
            }}
          >
            Cancel
          </Button>

          <Button
            fullWidth
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              color: "primary.contrastText",
              backgroundColor: "primary.main",
              py: "11px",
              borderRadius: "6px",
              "&:hover": {
                backgroundColor: "primary.dark"
              }
            }}
          >
            {t("goToWallets")}
          </Button>
        </DialogActions>
      </Dialog> */}

      <AddWalletModal
        open={openEditModal}
        currentCryptocurrency={editWalletCrypto}
        editMode={true}
        editWalletId={editWalletId != null ? Number(editWalletId) : undefined}
        editWalletName={editWalletName}
        editWalletAddress={editWalletAddress}
        onClose={() => {
          setOpenEditModal(false);
          setEditWalletCrypto("");
          setEditWalletId(undefined);
          setEditWalletName("");
          setEditWalletAddress("");
        }}
      />

      <DeleteWalletModal
        open={openDeleteModal}
        onClose={() => {
          setOpenDeleteModal(false);
          setDeleteTarget(null);
        }}
        walletId={deleteTarget?.id != null ? Number(deleteTarget.id) : null}
        walletType={deleteTarget?.type ?? ""}
        walletAddress={deleteTarget?.address ?? ""}
        companyId={selectedCompanyId ?? undefined}
        onDeleted={handleWalletDeleted}
      />

      {/* Session 74 P1-4: mobile-only bottom spacer so the last wallet's
          action row and the "Add wallet" button clear the ~80px bottom-nav
          + 68px chat-FAB gutter. Desktop is 0-height (no impact). */}
      <Box
        data-testid="wallet-mobile-spacer"
        sx={{ height: { xs: 180, md: 0 }, flexShrink: 0 }}
      />
    </Box>
  );
};

export default Wallet;
